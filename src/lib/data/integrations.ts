// Workstream 8 — Integrations service layer.
// Provides connector abstraction, event bus, webhook emission,
// idempotent import/export/delivery workflows, and API adapter.

import type {
  DataSnapshot, DomainEvent, DomainEventKind, IntegrationConnection,
  WebhookEndpoint, WebhookDelivery, WebhookDeliveryStatus,
  ImportJob, ExportJob, DeliveryPackage, DeliveryRun,
  SyncMapping, ExternalReference, ExportPackageKind,
} from "./schema";

// ------------------ ID helpers ------------------

function nextId(prefix: string, existing: string[]): string {
  const nums = existing
    .map(id => {
      const m = id.match(/(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter(n => !Number.isNaN(n));
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

// ------------------ Secret redaction ------------------

const SECRET_KEY_PATTERNS = /(api[_-]?key|secret|token|password|authorization|bearer)/i;

export function redactPayload(payload: unknown): unknown {
  if (payload === null || typeof payload !== "object") return payload;
  if (Array.isArray(payload)) return payload.map(redactPayload);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if (SECRET_KEY_PATTERNS.test(k)) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = redactPayload(v);
    }
  }
  return out;
}

// ------------------ Event bus ------------------

export interface EmitEventInput {
  kind: DomainEventKind;
  entityType: string;
  entityId: string;
  actor: string;
  correlationId?: string;
  payload?: Record<string, unknown>;
  releaseIds?: string[];
  manufacturingStage?: string;
  upstreamEventIds?: string[];
}

export function buildDomainEvent(s: DataSnapshot, input: EmitEventInput): DomainEvent {
  const id = nextId("EVT", s.domainEvents.map(e => e.id));
  return {
    id,
    kind: input.kind,
    occurredAt: new Date().toISOString(),
    actor: input.actor,
    entityType: input.entityType,
    entityId: input.entityId,
    correlationId: input.correlationId ?? `corr-${id}`,
    schemaVersion: 1,
    payloadVersion: "1.0",
    traceability: {
      releaseIds: input.releaseIds ?? [],
      upstreamEventIds: input.upstreamEventIds ?? [],
      manufacturingStage: input.manufacturingStage,
    },
    payload: (redactPayload(input.payload ?? {}) as Record<string, unknown>),
  };
}

// ------------------ Webhook idempotency + delivery ------------------

export function webhookIdempotencyKey(endpointId: string, eventId: string): string {
  return `${endpointId}:${eventId}`;
}

export function alreadyDelivered(s: DataSnapshot, endpointId: string, eventId: string): boolean {
  const key = webhookIdempotencyKey(endpointId, eventId);
  return s.webhookDeliveries.some(d => d.idempotencyKey === key && d.status !== "failed");
}

export interface EmitWebhookResult {
  delivery: WebhookDelivery | null;
  skipped: "duplicate" | "endpoint-disabled" | "no-subscription" | null;
  errors: string[];
}

// Local-demo: simulates delivery. In production, this would enqueue an HTTP call.
export function emitWebhook(
  s: DataSnapshot,
  endpoint: WebhookEndpoint,
  event: DomainEvent,
): EmitWebhookResult {
  const errors: string[] = [];
  if (!endpoint.enabled) return { delivery: null, skipped: "endpoint-disabled", errors };
  if (!endpoint.events.includes(event.kind)) return { delivery: null, skipped: "no-subscription", errors };
  if (alreadyDelivered(s, endpoint.id, event.id)) {
    return { delivery: null, skipped: "duplicate", errors };
  }
  // Deterministic simulated outcome: fail if endpoint has recent failures > 0.
  const willFail = endpoint.failureCount > endpoint.successCount;
  const now = new Date().toISOString();
  const status: WebhookDeliveryStatus = willFail ? "failed" : "delivered";
  const delivery: WebhookDelivery = {
    id: nextId("WD", s.webhookDeliveries.map(d => d.id)),
    endpointId: endpoint.id,
    eventId: event.id,
    eventKind: event.kind,
    correlationId: event.correlationId,
    payloadVersion: event.payloadVersion,
    status,
    attempts: [{
      attempt: 1, at: now, status,
      httpStatus: status === "delivered" ? 200 : 502,
      responseSummary: status === "delivered" ? "ok (simulated)" : "bad gateway (simulated)",
      errorMessage: status === "delivered" ? null : "Simulated failure in local-demo mode.",
      durationMs: 120,
    }],
    idempotencyKey: webhookIdempotencyKey(endpoint.id, event.id),
    redactedPayloadPreview: JSON.stringify(event.payload).slice(0, 240),
    simulated: true,
    createdAt: now, updatedAt: now,
  };
  return { delivery, skipped: null, errors };
}

// ------------------ Import validation ------------------

export interface ImportValidationReport {
  ok: boolean;
  issues: ImportJob["issues"];
  mappingPreview: ImportJob["mappingPreview"];
}

export function validateImportPackage(s: DataSnapshot, pkg: {
  concepts?: Array<{ id: string; frameworkIds?: string[] }>;
  frameworks?: Array<{ id: string }>;
}): ImportValidationReport {
  const issues: ImportJob["issues"] = [];
  const mappingPreview: ImportJob["mappingPreview"] = [];
  const existingConceptIds = new Set(s.concepts.map(c => c.id));
  const existingFrameworkIds = new Set(s.frameworks.map(f => f.id));

  for (const c of pkg.concepts ?? []) {
    const collide = existingConceptIds.has(c.id);
    mappingPreview.push({
      kind: "concept", incomingId: c.id,
      targetId: collide ? c.id : null,
      action: collide ? "block" : "create",
    });
    if (collide) {
      issues.push({ code: "id-collision", entityId: c.id, kind: "concept", message: `Concept ${c.id} already exists.`, severity: "error" });
    }
    for (const fid of c.frameworkIds ?? []) {
      if (!existingFrameworkIds.has(fid) && !(pkg.frameworks ?? []).some(f => f.id === fid)) {
        issues.push({ code: "broken-reference", entityId: c.id, kind: "concept", message: `Referenced framework ${fid} not found.`, severity: "error" });
      }
    }
  }
  const ok = issues.every(i => i.severity !== "error");
  return { ok, issues, mappingPreview };
}

// ------------------ Export packaging ------------------

export interface BuildExportInput {
  kind: ExportPackageKind;
  entityId: string;
  requestedBy: string;
}

export function buildExportManifest(s: DataSnapshot, input: BuildExportInput): {
  manifest: DeliveryPackage["manifest"];
  dependencies: string[];
  readinessScore: number;
  version: string;
  title: string;
  validationReport: string;
} {
  const { kind, entityId } = input;
  let entityType = "publications";
  let dependencies: string[] = [];
  let readinessScore = 0;
  let version = "1.0.0";
  let title = entityId;

  switch (kind) {
    case "publication": {
      const p = s.publications.find(x => x.id === entityId);
      if (!p) throw new Error(`Publication ${entityId} not found.`);
      entityType = "publications"; version = p.version; title = p.title;
      const cids = new Set<string>(), fids = new Set<string>(), kids = new Set<string>();
      for (const ch of p.chapters) {
        ch.conceptIds.forEach(id => cids.add(id));
        ch.frameworkIds.forEach(id => fids.add(id));
        ch.knowledgeObjectIds.forEach(id => kids.add(id));
      }
      dependencies = [...cids, ...fids, ...kids];
      readinessScore = Math.min(100, 40 + p.chapters.length * 8);
      break;
    }
    case "client-toolkit": {
      const t = s.clientToolkits.find(x => x.id === entityId);
      if (!t) throw new Error(`Toolkit ${entityId} not found.`);
      entityType = "clientToolkits"; version = t.version; title = t.title;
      dependencies = [...t.conceptIds, ...t.frameworkIds, ...t.knowledgeObjectIds];
      readinessScore = t.manufacturingStage === "Canonical" ? 90 : 60;
      break;
    }
    case "ai-pack": {
      const a = s.aiPacks.find(x => x.id === entityId);
      if (!a) throw new Error(`AI Pack ${entityId} not found.`);
      entityType = "aiPacks"; version = a.version; title = a.title;
      dependencies = [...a.conceptIds, ...a.frameworkIds, ...a.knowledgeObjectIds];
      readinessScore = a.manufacturingStage === "Canonical" ? 90 : 55;
      break;
    }
    case "agent": {
      const a = s.agents.find(x => x.id === entityId);
      if (!a) throw new Error(`Agent ${entityId} not found.`);
      entityType = "agents"; version = a.version; title = a.name;
      dependencies = [...a.conceptIds, ...a.frameworkIds];
      readinessScore = a.manufacturingStage === "Canonical" ? 92 : 50;
      break;
    }
    case "release": {
      const r = s.releases.find(x => x.id === entityId);
      if (!r) throw new Error(`Release ${entityId} not found.`);
      entityType = "releases"; version = r.version; title = r.name;
      dependencies = r.manifest.flatMap(m => m.ids);
      readinessScore = r.blockingErrors === 0 ? 95 : 40;
      break;
    }
    case "knowledge-subset": {
      title = `Knowledge subset: ${entityId}`;
      entityType = "knowledgeObjects";
      dependencies = [];
      readinessScore = 70;
      break;
    }
  }

  const manifest: DeliveryPackage["manifest"] = [{ entityType, ids: [entityId] }];
  if (dependencies.length) manifest.push({ entityType: "dependencies", ids: dependencies });

  return {
    manifest, dependencies, readinessScore, version, title,
    validationReport: `Manifest built with ${dependencies.length} dependency reference(s). Readiness=${readinessScore}.`,
  };
}

export function packageHashOf(manifest: DeliveryPackage["manifest"], version: string): string {
  // Deterministic non-cryptographic hash for idempotency.
  const s = JSON.stringify(manifest) + "|" + version;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return `sha-demo-${(h >>> 0).toString(16)}`;
}

// ------------------ Delivery ------------------

export function deliveryIdempotencyKey(packageId: string, connectionId: string, version: string): string {
  return `${packageId}:${connectionId}:${version}`;
}

export function alreadyDelivered_pkg(s: DataSnapshot, packageId: string, connectionId: string, version: string): boolean {
  const key = deliveryIdempotencyKey(packageId, connectionId, version);
  return s.deliveryRuns.some(r => r.idempotencyKey === key && r.status === "delivered");
}

// ------------------ Release integration readiness ------------------

export interface ReleaseIntegrationReadiness {
  releaseId: string;
  requiredPackages: DeliveryPackage[];
  failedDeliveries: DeliveryRun[];
  unresolvedConflicts: SyncMapping[];
  webhookFailuresLast24h: number;
  blocked: boolean;
  reasons: string[];
}

export function releaseIntegrationReadiness(s: DataSnapshot, releaseId: string): ReleaseIntegrationReadiness {
  const requiredPackages = s.deliveryPackages.filter(p => p.requiredForReleaseIds.includes(releaseId));
  const packageIds = new Set(requiredPackages.map(p => p.id));
  const failedDeliveries = s.deliveryRuns.filter(r => packageIds.has(r.packageId) && r.status === "failed");
  const unresolvedConflicts = s.syncMappings.filter(m => m.status === "conflict");
  const webhookFailuresLast24h = s.webhookDeliveries.filter(d => d.status === "failed").length;

  const reasons: string[] = [];
  for (const p of requiredPackages) {
    const anyDelivered = s.deliveryRuns.some(r => r.packageId === p.id && r.status === "delivered");
    if (!anyDelivered) reasons.push(`Required package ${p.id} not yet delivered.`);
  }
  if (failedDeliveries.length) reasons.push(`${failedDeliveries.length} failed delivery attempt(s).`);

  return {
    releaseId, requiredPackages, failedDeliveries, unresolvedConflicts,
    webhookFailuresLast24h,
    blocked: reasons.length > 0,
    reasons,
  };
}

// ------------------ API adapter (local; safe read-only) ------------------

export type APIEndpointId =
  | "registry.list"
  | "knowledge.detail"
  | "release.manifest"
  | "publication.export"
  | "toolkit.export"
  | "aipack.export"
  | "agent.export"
  | "automation.run.status"
  | "import.job.status";

export interface APIError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
}

export function apiError(code: string, message: string, details?: Record<string, unknown>): APIError {
  return { error: { code, message, details, requestId: `req_${Date.now().toString(36)}` } };
}

export interface APIEndpointSpec {
  id: APIEndpointId;
  method: "GET" | "POST";
  path: string;
  description: string;
  scopes: string[];
  requestSchema: string;
  responseShape: string;
  example: string;
}

export const API_CATALOG: APIEndpointSpec[] = [
  {
    id: "registry.list", method: "GET", path: "/api/v1/registry/{kind}",
    description: "List canonical assets by kind (concepts, publications, etc.).",
    scopes: ["registry.read"],
    requestSchema: "{ kind: string, limit?: number }",
    responseShape: "{ items: Array<{ id, title, stage }> }",
    example: "/api/v1/registry/publications?limit=10",
  },
  {
    id: "knowledge.detail", method: "GET", path: "/api/v1/knowledge/{id}",
    description: "Retrieve a knowledge asset with its relationships.",
    scopes: ["knowledge.read"],
    requestSchema: "{ id: string }",
    responseShape: "{ id, kind, relations: [...] }",
    example: "/api/v1/knowledge/CR-001-001",
  },
  {
    id: "release.manifest", method: "GET", path: "/api/v1/releases/{id}/manifest",
    description: "Release manifest and readiness snapshot.",
    scopes: ["release.read"],
    requestSchema: "{ id: string }",
    responseShape: "{ id, manifest, readiness }",
    example: "/api/v1/releases/LKR-1.0.001/manifest",
  },
  {
    id: "publication.export", method: "GET", path: "/api/v1/publications/{id}/export",
    description: "Full publication export package (JSON).",
    scopes: ["publication.read","export.read"],
    requestSchema: "{ id: string }",
    responseShape: "{ manifest, dependencies, readinessScore }",
    example: "/api/v1/publications/PL-101/export",
  },
  {
    id: "toolkit.export", method: "GET", path: "/api/v1/toolkits/{id}/export",
    description: "Client toolkit export package.",
    scopes: ["toolkit.read","export.read"],
    requestSchema: "{ id: string }",
    responseShape: "{ manifest, dependencies }",
    example: "/api/v1/toolkits/TK-001/export",
  },
  {
    id: "aipack.export", method: "GET", path: "/api/v1/ai-packs/{id}/export",
    description: "AI pack export package.",
    scopes: ["aipack.read","export.read"],
    requestSchema: "{ id: string }",
    responseShape: "{ manifest, dependencies }",
    example: "/api/v1/ai-packs/AP-001/export",
  },
  {
    id: "agent.export", method: "GET", path: "/api/v1/agents/{id}/export",
    description: "Agent export package (spec + evaluations).",
    scopes: ["agent.read","export.read"],
    requestSchema: "{ id: string }",
    responseShape: "{ manifest, dependencies }",
    example: "/api/v1/agents/AG-006/export",
  },
  {
    id: "automation.run.status", method: "GET", path: "/api/v1/automations/runs/{id}",
    description: "Automation run status and step history.",
    scopes: ["automation.read"],
    requestSchema: "{ id: string }",
    responseShape: "{ id, status, steps }",
    example: "/api/v1/automations/runs/RUN-001",
  },
  {
    id: "import.job.status", method: "POST", path: "/api/v1/imports",
    description: "Submit an import package for dry-run validation.",
    scopes: ["import.write"],
    requestSchema: "{ package: object, strategy: string, dryRun: boolean }",
    responseShape: "{ jobId, status, issues }",
    example: "POST /api/v1/imports",
  },
];

// Local adapter for the API explorer test console.
export function callLocalAPI(s: DataSnapshot, endpointId: APIEndpointId, params: Record<string, string>): unknown {
  try {
    switch (endpointId) {
      case "registry.list": {
        const kind = params.kind ?? "publications";
        const limit = Math.min(parseInt(params.limit ?? "10", 10) || 10, 50);
        const map: Record<string, Array<{ id: string; title?: string; name?: string; stage?: string }>> = {
          publications: s.publications.map(p => ({ id: p.id, title: p.title, stage: p.manufacturingStage })),
          concepts: s.concepts.map(c => ({ id: c.id, title: c.canonicalName, stage: c.manufacturingStatus })),
          frameworks: s.frameworks.map(f => ({ id: f.id, name: f.name, stage: f.status })),
          releases: s.releases.map(r => ({ id: r.id, name: r.name, stage: r.stage })),
          agents: s.agents.map(a => ({ id: a.id, name: a.name, stage: a.manufacturingStage })),
          clientToolkits: s.clientToolkits.map(t => ({ id: t.id, title: t.title, stage: t.manufacturingStage })),
          aiPacks: s.aiPacks.map(a => ({ id: a.id, title: a.title, stage: a.manufacturingStage })),
        };
        const items = map[kind];
        if (!items) return apiError("unknown-kind", `Unknown kind: ${kind}`);
        return { items: items.slice(0, limit), total: items.length };
      }
      case "knowledge.detail": {
        const id = params.id;
        if (!id) return apiError("missing-param", "id required");
        const found =
          s.concepts.find(c => c.id === id) ??
          s.frameworks.find(f => f.id === id) ??
          s.knowledgeObjects.find(k => k.id === id);
        if (!found) return apiError("not-found", `Asset ${id} not found`);
        return found;
      }
      case "release.manifest": {
        const r = s.releases.find(x => x.id === params.id);
        if (!r) return apiError("not-found", `Release ${params.id} not found`);
        const integrations = releaseIntegrationReadiness(s, r.id);
        return { id: r.id, manifest: r.manifest, blockingErrors: r.blockingErrors, gate: r.gateChecklist, integrations };
      }
      case "publication.export":
      case "toolkit.export":
      case "aipack.export":
      case "agent.export": {
        const kindMap: Record<APIEndpointId, ExportPackageKind> = {
          "publication.export": "publication",
          "toolkit.export": "client-toolkit",
          "aipack.export": "ai-pack",
          "agent.export": "agent",
        } as Record<APIEndpointId, ExportPackageKind>;
        const kind = kindMap[endpointId];
        try {
          return buildExportManifest(s, { kind, entityId: params.id, requestedBy: "api" });
        } catch (e) {
          return apiError("not-found", (e as Error).message);
        }
      }
      case "automation.run.status": {
        const run = s.automationRuns.find(r => r.id === params.id);
        if (!run) return apiError("not-found", `Run ${params.id} not found`);
        return { id: run.id, status: run.status, steps: run.stepRuns, events: run.events };
      }
      case "import.job.status": {
        const job = s.importJobs.find(j => j.id === params.id);
        if (!job) return apiError("not-found", `Job ${params.id} not found`);
        return { id: job.id, status: job.status, issues: job.issues };
      }
      default:
        return apiError("unknown-endpoint", `Endpoint ${endpointId} not implemented`);
    }
  } catch (e) {
    return apiError("internal", (e as Error).message);
  }
}

// ------------------ Factories used by UI ------------------

export function newIntegrationConnection(s: DataSnapshot, seed: Partial<IntegrationConnection> & Pick<IntegrationConnection, "name" | "provider">): IntegrationConnection {
  const id = nextId("IC", s.integrationConnections.map(c => c.id));
  const now = new Date().toISOString();
  return {
    id, name: seed.name, provider: seed.provider,
    environment: seed.environment ?? "local-demo",
    baseUrl: seed.baseUrl ?? "",
    domainScope: seed.domainScope ?? [],
    owner: seed.owner ?? "Ops", steward: seed.steward ?? "Editorial Board",
    status: seed.status ?? "draft", health: seed.health ?? "unknown",
    lastSyncAt: null, failureCount: 0, successCount: 0,
    subscribedEvents: seed.subscribedEvents ?? [],
    credentialReferences: seed.credentialReferences ?? [],
    tags: seed.tags ?? [], description: seed.description ?? "",
    isDemo: seed.environment === "production" ? false : true,
    notes: "", createdAt: now, updatedAt: now,
  };
}

export function newExportJob(s: DataSnapshot, input: BuildExportInput): { job: ExportJob; pkg: DeliveryPackage } {
  const built = buildExportManifest(s, input);
  const now = new Date().toISOString();
  const jobId = nextId("EXP", s.exportJobs.map(j => j.id));
  const pkgId = nextId("PKG", s.deliveryPackages.map(p => p.id));
  const hash = packageHashOf(built.manifest, built.version);
  const pkg: DeliveryPackage = {
    id: pkgId, exportJobId: jobId, title: built.title,
    kind: input.kind, version: built.version,
    bytes: JSON.stringify(built.manifest).length,
    hash, destinationConnectionIds: [], requiredForReleaseIds: [],
    manifest: built.manifest, dependencies: built.dependencies,
    readinessScore: built.readinessScore,
    validationReport: built.validationReport,
    provenanceNotes: `Generated by ${input.requestedBy}.`,
    archived: false, createdAt: now, updatedAt: now,
  };
  const job: ExportJob = {
    id: jobId, requestedBy: input.requestedBy,
    kind: input.kind, entityId: input.entityId, version: built.version,
    manifest: built.manifest, readinessScore: built.readinessScore,
    provenanceNotes: built.validationReport,
    status: "generated", format: "json",
    payloadPreview: JSON.stringify(built.manifest).slice(0, 240),
    packageId: pkgId, generatedAt: now, error: null,
    createdAt: now, updatedAt: now,
  };
  return { job, pkg };
}

// ------------------ Orphaned/stale reference intelligence ------------------

export interface IntegrationHealthSummary {
  connections: { total: number; failing: number; degraded: number };
  webhooks: { endpoints: number; failedDeliveries: number; retryQueue: number };
  syncConflicts: number;
  orphanedReferences: ExternalReference[];
  staleMappings: SyncMapping[];
}

export function integrationHealthSummary(s: DataSnapshot): IntegrationHealthSummary {
  const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 30;
  const staleMappings = s.syncMappings.filter(m => {
    const t = m.lastSyncAt ? Date.parse(m.lastSyncAt) : 0;
    return t < cutoff || m.status === "stale";
  });
  return {
    connections: {
      total: s.integrationConnections.length,
      failing: s.integrationConnections.filter(c => c.health === "failing").length,
      degraded: s.integrationConnections.filter(c => c.health === "degraded").length,
    },
    webhooks: {
      endpoints: s.webhookEndpoints.length,
      failedDeliveries: s.webhookDeliveries.filter(d => d.status === "failed").length,
      retryQueue: s.webhookDeliveries.filter(d => d.status === "retrying" || d.status === "pending").length,
    },
    syncConflicts: s.syncMappings.filter(m => m.status === "conflict").length,
    orphanedReferences: s.externalReferences.filter(r => r.orphaned),
    staleMappings,
  };
}
