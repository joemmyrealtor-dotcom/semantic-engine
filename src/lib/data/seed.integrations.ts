import type {
  IntegrationConnection, WebhookEndpoint, WebhookDelivery, APIClient,
  ImportJob, ExportJob, SyncMapping, ExternalReference,
  DeliveryPackage, DeliveryRun, EventSubscription, DomainEvent,
} from "./schema";

const now = "2026-01-15T10:00:00.000Z";
const ts = { createdAt: now, updatedAt: now };

export const seedIntegrationConnections: IntegrationConnection[] = [
  {
    id: "IC-001", name: "Advisor Notification Webhook (demo)",
    provider: "generic-webhook", environment: "local-demo",
    baseUrl: "https://example-notify.invalid/hook",
    domainScope: ["DOM-001","DOM-008"], owner: "Ops", steward: "Editorial Board",
    status: "active", health: "healthy",
    lastSyncAt: now, failureCount: 0, successCount: 12,
    subscribedEvents: ["release.ready","asset.stage_changed"],
    credentialReferences: [{
      id: "ICR-001", label: "Signing secret",
      kind: "webhook-signing-secret", maskedPreview: "whsec_••••7a12",
      storageLocation: "local-demo-placeholder", rotatedAt: now,
      ownerRole: "Owner", notes: "Local demo placeholder only — never stored.",
    }],
    tags: ["demo","webhook"], description: "Sends release readiness notifications.",
    isDemo: true, notes: "", ...ts,
  },
  {
    id: "IC-002", name: "CRM Sync (demo)",
    provider: "crm", environment: "local-demo",
    baseUrl: "https://example-crm.invalid/api",
    domainScope: ["DOM-008"], owner: "Client Ops", steward: "Editorial Board",
    status: "failed", health: "failing",
    lastSyncAt: now, failureCount: 3, successCount: 22,
    subscribedEvents: ["asset.stage_changed"],
    credentialReferences: [{
      id: "ICR-002", label: "OAuth token", kind: "oauth-token",
      maskedPreview: "oauth_••••ff01", storageLocation: "local-demo-placeholder",
      rotatedAt: null, ownerRole: "Owner", notes: "",
    }],
    tags: ["demo","crm"], description: "Bi-directional CRM contact sync.",
    isDemo: true, notes: "Conflict on mapping SM-001.", ...ts,
  },
];

export const seedWebhookEndpoints: WebhookEndpoint[] = [
  {
    id: "WH-001", connectionId: "IC-001",
    url: "https://example-notify.invalid/hook",
    description: "Release readiness notifications",
    events: ["release.ready","release.blocked"],
    enabled: true, signatureAlgorithm: "hmac-sha256",
    signingSecretRef: "ICR-001",
    retryPolicy: { maxAttempts: 5, backoffSeconds: 60 },
    headerAllowlist: ["content-type","x-lovable-signature"],
    owner: "Ops", lastDeliveryAt: now, failureCount: 1, successCount: 11, ...ts,
  },
];

export const seedWebhookDeliveries: WebhookDelivery[] = [
  {
    id: "WD-001", endpointId: "WH-001",
    eventId: "EVT-001", eventKind: "release.ready", correlationId: "corr-001",
    payloadVersion: "1.0", status: "delivered",
    attempts: [{ attempt: 1, at: now, status: "delivered", httpStatus: 200, responseSummary: "ok", errorMessage: null, durationMs: 82 }],
    idempotencyKey: "WH-001:EVT-001", redactedPayloadPreview: "{release:LKR-1.0.001, ...}",
    simulated: true, ...ts,
  },
  {
    id: "WD-002", endpointId: "WH-001",
    eventId: "EVT-002", eventKind: "release.blocked", correlationId: "corr-002",
    payloadVersion: "1.0", status: "failed",
    attempts: [
      { attempt: 1, at: now, status: "failed", httpStatus: 502, responseSummary: "bad gateway", errorMessage: "timeout", durationMs: 4200 },
      { attempt: 2, at: now, status: "failed", httpStatus: 502, responseSummary: "bad gateway", errorMessage: "timeout", durationMs: 4300 },
    ],
    idempotencyKey: "WH-001:EVT-002", redactedPayloadPreview: "{release:LKR-1.0.002, blockers:2}",
    simulated: true, ...ts,
  },
];

export const seedApiClients: APIClient[] = [
  {
    id: "APIC-001", name: "Advisor Portal (demo)",
    description: "Read-only registry access for the advisor portal.",
    environment: "local-demo", owner: "Ops",
    scopes: ["registry.read","knowledge.read","release.read","publication.read"],
    keyReferenceId: null, keyPrefix: "apik_demo_••••b1c2",
    rateLimitPerMinute: 120, enabled: true,
    lastUsedAt: now, callCount: 148, ipAllowlist: [],
    auditNotes: "Local demo client, no production traffic.", ...ts,
  },
];

export const seedImportJobs: ImportJob[] = [
  {
    id: "IMP-001", submittedBy: "Editor",
    connectionId: null, packageName: "external-concepts-v3.json",
    packageVersion: "3.0.0", strategy: "upsert",
    status: "dry-run-complete", dryRun: true,
    packageHash: "sha256-demo-01", payloadPreview: "{concepts:12, frameworks:2}",
    issues: [
      { code: "id-collision", entityId: "CR-001-001", kind: "concept", message: "Concept id already exists.", severity: "error" },
      { code: "broken-reference", entityId: null, kind: "framework", message: "Framework F-999 not found.", severity: "error" },
    ],
    mappingPreview: [
      { kind: "concept", incomingId: "CR-001-001", targetId: "CR-001-001", action: "block" },
      { kind: "concept", incomingId: "CR-011-001", targetId: null, action: "create" },
    ],
    approvals: [],
    appliedAt: null,
    rollbackPlan: "No changes applied (dry-run).",
    auditLog: [{ at: now, actor: "Editor", message: "Dry-run submitted." }],
    ...ts,
  },
];

export const seedExportJobs: ExportJob[] = [
  {
    id: "EXP-001", requestedBy: "Editorial Board",
    kind: "publication", entityId: "PL-101", version: "1.0.0",
    manifest: [{ entityType: "publications", ids: ["PL-101"] }],
    readinessScore: 82, provenanceNotes: "Seed baseline",
    status: "delivered", format: "json",
    payloadPreview: "{title:'First-Time Buyer Guide', chapters:6}",
    packageId: "PKG-001", generatedAt: now, error: null, ...ts,
  },
];

export const seedDeliveryPackages: DeliveryPackage[] = [
  {
    id: "PKG-001", exportJobId: "EXP-001",
    title: "First-Time Buyer Guide v1.0.0",
    kind: "publication", version: "1.0.0",
    bytes: 48213, hash: "sha256-pkg-001",
    destinationConnectionIds: ["IC-001"],
    requiredForReleaseIds: [],
    manifest: [{ entityType: "publications", ids: ["PL-101"] }],
    dependencies: ["CR-001-001","F-001"],
    readinessScore: 82,
    validationReport: "All manifest ids resolve; readiness ≥ 80.",
    provenanceNotes: "Generated from canonical snapshot.",
    archived: false, ...ts,
  },
];

export const seedDeliveryRuns: DeliveryRun[] = [
  {
    id: "DRN-001", packageId: "PKG-001", connectionId: "IC-001",
    attempts: [{ attempt: 1, at: now, status: "delivered", httpStatus: 200, responseSummary: "ok", errorMessage: null, durationMs: 145 }],
    status: "delivered", idempotencyKey: "PKG-001:IC-001:1.0.0",
    actor: "automation", simulated: true, errorSummary: null, ...ts,
  },
];

export const seedSyncMappings: SyncMapping[] = [
  {
    id: "SM-001", connectionId: "IC-002",
    internalEntityKind: "concept", internalEntityId: "CR-001-001",
    externalId: "crm-concept-4471", externalUrl: "https://example-crm.invalid/records/4471",
    direction: "bidirectional", lastSyncAt: now,
    status: "conflict",
    conflictReason: "External record was updated after last sync; canonical field differs.",
    owner: "Client Ops", ...ts,
  },
];

export const seedExternalReferences: ExternalReference[] = [
  {
    id: "ER-001", internalEntityKind: "publication", internalEntityId: "PL-101",
    provider: "document-repository", externalId: "doc-98211",
    externalUrl: "https://example-docs.invalid/doc-98211",
    label: "Published PDF (demo)", createdBy: "Editorial Board",
    notes: "Traceability to external doc.", orphaned: false, ...ts,
  },
];

export const seedEventSubscriptions: EventSubscription[] = [
  {
    id: "ES-001", name: "Release readiness → CRM",
    connectionId: "IC-002", events: ["release.ready","asset.stage_changed"],
    filter: { entityKinds: ["publication","release"] },
    enabled: true, lastMatchedAt: now, matchCount: 6, ...ts,
  },
];

export const seedDomainEvents: DomainEvent[] = [
  {
    id: "EVT-001", kind: "release.ready", occurredAt: now, actor: "Editorial Board",
    entityType: "release", entityId: "LKR-1.0.001",
    correlationId: "corr-001", schemaVersion: 1, payloadVersion: "1.0",
    traceability: { releaseIds: ["LKR-1.0.001"], upstreamEventIds: [] },
    payload: { readiness: 92 },
  },
  {
    id: "EVT-002", kind: "release.blocked", occurredAt: now, actor: "Editorial Board",
    entityType: "release", entityId: "LKR-1.0.002",
    correlationId: "corr-002", schemaVersion: 1, payloadVersion: "1.0",
    traceability: { releaseIds: ["LKR-1.0.002"], upstreamEventIds: [] },
    payload: { blockers: 2 },
  },
];
