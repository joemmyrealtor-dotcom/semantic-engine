// Workstream 5 — Automation orchestration engine.
// Deterministic, in-application executor. No background workers, no network,
// no arbitrary code execution. All actions go through a governed registry.
import type {
  AutomationRecipe, AutomationRun, AutomationStep, AutomationStepRun,
  AutomationRunEvent, AutomationCondition, AutomationActionKind,
  AutomationEntityScope, DataSnapshot, PublicationBlueprint,
  ClientToolkit, AIPack, Agent, Release, KnowledgeObject,
  AutomationTrigger, AutomationApprovalRecord,
} from "./schema";
import {
  validatePublicationPromotion, validateToolkitPromotion,
  validateAIPackPromotion, validateAgentPromotion,
  publicationCoverage, toolkitCoverage, aiPackCoverage, agentCoverage,
  isAdjacentStageTransition, detectBrokenReferences,
} from "./service";

// ------------------ ID + validation ------------------

function maxNum(ids: string[], prefix: string): number {
  let max = 0;
  const re = new RegExp(`^${prefix}(\\d+)$`);
  for (const id of ids) { const m = id.match(re); if (m) max = Math.max(max, parseInt(m[1], 10)); }
  return max;
}
export function nextRecipeId(s: DataSnapshot): string {
  return `AUT-${String(maxNum(s.automations.map(r => r.id), "AUT-") + 1).padStart(3, "0")}`;
}
export function nextStepId(steps: { id: string }[]): string {
  return `AST-${String(maxNum(steps.map(x => x.id), "AST-") + 1).padStart(3, "0")}`;
}
export function nextCheckpointId(cps: { id: string }[]): string {
  return `AC-${String(maxNum(cps.map(x => x.id), "AC-") + 1).padStart(3, "0")}`;
}
export function nextRunId(s: DataSnapshot): string {
  return `RUN-${String(maxNum(s.automationRuns.map(r => r.id), "RUN-") + 1).padStart(3, "0")}`;
}

export interface RecipeValidation { ok: boolean; errors: string[]; warnings: string[]; }

export function validateRecipe(r: AutomationRecipe): RecipeValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!r.name.trim()) errors.push("Recipe name is required.");
  if (!r.steps.length) errors.push("Recipe must contain at least one step.");
  const stepIds = new Set<string>();
  for (const s of r.steps) {
    if (stepIds.has(s.id)) errors.push(`Duplicate step id: ${s.id}`);
    stepIds.add(s.id);
    if (!s.name.trim()) errors.push(`Step ${s.id} needs a name.`);
  }
  for (const cp of r.approvals) {
    if (cp.afterStepId && !stepIds.has(cp.afterStepId))
      errors.push(`Approval ${cp.id} references unknown step ${cp.afterStepId}.`);
  }
  if (r.retryPolicy.maxAttempts < 1) errors.push("maxAttempts must be >= 1.");
  if (r.retryPolicy.maxAttempts > 5) warnings.push("maxAttempts > 5 may hide systemic errors.");
  if (r.idempotencyWindowMinutes < 0) errors.push("idempotencyWindowMinutes must be >= 0.");
  if (r.trigger.kind === "readiness-threshold" && r.trigger.readinessThreshold === undefined)
    warnings.push("Readiness-threshold trigger has no threshold configured (defaults to 85).");
  return { ok: errors.length === 0, errors, warnings };
}

// ------------------ Concurrency + idempotency ------------------

export function idempotencyKey(recipe: AutomationRecipe, triggerEventId: string, entityIds: string[]): string {
  return `${recipe.id}@${recipe.version}:${triggerEventId}:${entityIds.slice().sort().join(",")}`;
}

export function isConcurrencyBlocked(s: DataSnapshot, recipe: AutomationRecipe, entityIds: string[]): AutomationRun | null {
  const inFlight = s.automationRuns.filter(r =>
    r.recipeId === recipe.id &&
    (r.status === "running" || r.status === "waiting-approval" || r.status === "pending"),
  );
  if (recipe.concurrencyKey === "recipe") return inFlight[0] ?? null;
  // recipe+entity
  const conflict = inFlight.find(r => r.entityIds.some(e => entityIds.includes(e)));
  return conflict ?? null;
}

export function isIdempotencyBlocked(s: DataSnapshot, recipe: AutomationRecipe, key: string): AutomationRun | null {
  if (recipe.idempotencyWindowMinutes <= 0) return null;
  const cutoff = Date.now() - recipe.idempotencyWindowMinutes * 60 * 1000;
  return s.automationRuns.find(r =>
    r.idempotencyKey === key &&
    (r.status === "succeeded" || r.status === "waiting-approval" || r.status === "running") &&
    new Date(r.updatedAt).getTime() >= cutoff,
  ) ?? null;
}

// ------------------ Condition evaluation ------------------

function coerce(v: unknown): string | number | boolean {
  if (typeof v === "boolean" || typeof v === "number" || typeof v === "string") return v;
  return String(v ?? "");
}

export function evaluateCondition(c: AutomationCondition, ctx: Record<string, unknown>): boolean {
  const actual = coerce(ctx[c.field]);
  switch (c.op) {
    case "eq": return actual === c.value;
    case "neq": return actual !== c.value;
    case "gte": return typeof actual === "number" && typeof c.value === "number" && actual >= c.value;
    case "lte": return typeof actual === "number" && typeof c.value === "number" && actual <= c.value;
    case "contains": return String(actual).toLowerCase().includes(String(c.value).toLowerCase());
  }
}

// ------------------ Context building ------------------

function findEntity(s: DataSnapshot, scope: AutomationEntityScope, id: string):
  { kind: AutomationEntityScope; entity: unknown } | null {
  const map: Record<string, () => unknown> = {
    publication: () => s.publications.find(x => x.id === id),
    clientToolkit: () => s.clientToolkits.find(x => x.id === id),
    aiPack: () => s.aiPacks.find(x => x.id === id),
    agent: () => s.agents.find(x => x.id === id),
    concept: () => s.concepts.find(x => x.id === id),
    framework: () => s.frameworks.find(x => x.id === id),
    knowledgeObject: () => s.knowledgeObjects.find(x => x.id === id),
    clientTool: () => s.clientTools.find(x => x.id === id),
    release: () => s.releases.find(x => x.id === id),
  };
  if (scope !== "any") {
    const e = map[scope]?.();
    return e ? { kind: scope, entity: e } : null;
  }
  for (const [k, fn] of Object.entries(map)) {
    const e = fn();
    if (e) return { kind: k as AutomationEntityScope, entity: e };
  }
  return null;
}

function buildEntityContext(s: DataSnapshot, scope: AutomationEntityScope, entityId: string): Record<string, unknown> {
  const found = findEntity(s, scope, entityId);
  if (!found) return { entityId, kind: scope };
  const ctx: Record<string, unknown> = { entityId, kind: found.kind };
  const e = found.entity as Record<string, unknown>;
  ctx.stage = e.manufacturingStage ?? e.stage;
  ctx.status = e.status;
  ctx.humanReviewCompleted = e.humanReviewCompleted;
  ctx.reviewDate = e.reviewDate;
  ctx.owner = e.owner ?? e.steward;
  // readiness where applicable
  switch (found.kind) {
    case "publication":  ctx.readinessScore = publicationCoverage(found.entity as PublicationBlueprint, s).readinessScore; break;
    case "clientToolkit":ctx.readinessScore = toolkitCoverage(found.entity as ClientToolkit, s).readinessScore; break;
    case "aiPack":       ctx.readinessScore = aiPackCoverage(found.entity as AIPack, s).readinessScore; break;
    case "agent":        ctx.readinessScore = agentCoverage(found.entity as Agent, s).readinessScore; break;
    default: ctx.readinessScore = 0;
  }
  return ctx;
}

// ------------------ Action registry ------------------

export interface ActionResult {
  output: string;
  mutations: string[];              // human-readable descriptors of intended mutations
  apply?: (s: DataSnapshot) => DataSnapshot;  // pure snapshot transform (skipped in dry-run)
  error?: string;
  destructive?: boolean;
}

type ActionHandler = (params: Record<string, string|number|boolean|string[]>, ctx: Record<string, unknown>, s: DataSnapshot, entityId: string, dryRun: boolean) => ActionResult;

function nowISO() { return new Date().toISOString(); }

const ACTIONS: Record<AutomationActionKind, ActionHandler> = {
  "generate-readiness-report": (_p, ctx, s, entityId) => {
    const scope = String(ctx.kind);
    const rep = buildEntityContext(s, scope as AutomationEntityScope, entityId);
    return {
      output: `Readiness for ${entityId}: score=${rep.readinessScore} stage=${rep.stage} review=${rep.humanReviewCompleted ? "complete" : "pending"}`,
      mutations: [],
    };
  },
  "assign-review-checkpoint": (p, _c, _s, entityId) => {
    const assignee = String(p.assignee ?? "Editorial Board");
    return { output: `Review checkpoint assigned to ${assignee} for ${entityId}.`, mutations: [] };
  },
  "notify-owner": (p, ctx, _s, entityId) => {
    const message = String(p.message ?? "Attention required.");
    return { output: `Notify ${ctx.owner ?? "owner"} · ${entityId}: ${message}`, mutations: [] };
  },
  "add-release-candidate": (p, _c, s, _entityId) => {
    const releaseId = String(p.releaseId ?? "");
    const kind = String(p.entityType ?? "publications");
    const id = String(p.candidateId ?? "");
    const release = s.releases.find(r => r.id === releaseId);
    if (!release) return { output: "", mutations: [], error: `Release ${releaseId} not found.` };
    if (!id) return { output: "", mutations: [], error: "candidateId required." };
    const already = release.manifest.some(m => m.entityType === kind && m.ids.includes(id));
    if (already) return { output: `${id} already in ${releaseId} manifest.`, mutations: [] };
    return {
      output: `Add ${id} to ${releaseId} manifest (${kind}).`,
      mutations: [`releases.${releaseId}.manifest[${kind}] += ${id}`],
      apply: (snap) => ({
        ...snap,
        releases: snap.releases.map(r => r.id !== releaseId ? r : {
          ...r,
          manifest: r.manifest.some(m => m.entityType === kind)
            ? r.manifest.map(m => m.entityType === kind ? { ...m, ids: Array.from(new Set([...m.ids, id])) } : m)
            : [...r.manifest, { entityType: kind, ids: [id] }],
        }),
      }),
    };
  },
  "remove-release-candidate": (p, _c, s, _entityId) => {
    const releaseId = String(p.releaseId ?? "");
    const kind = String(p.entityType ?? "publications");
    const id = String(p.candidateId ?? "");
    if (!s.releases.find(r => r.id === releaseId)) return { output:"", mutations:[], error:`Release ${releaseId} not found.` };
    return {
      output: `Remove ${id} from ${releaseId} manifest.`,
      mutations: [`releases.${releaseId}.manifest[${kind}] -= ${id}`],
      destructive: true,
      apply: (snap) => ({
        ...snap,
        releases: snap.releases.map(r => r.id !== releaseId ? r : {
          ...r,
          manifest: r.manifest.map(m => m.entityType === kind ? { ...m, ids: m.ids.filter(x => x !== id) } : m),
        }),
      }),
    };
  },
  "block-release": (p, _c, s, _entityId) => {
    const releaseId = String(p.releaseId ?? "");
    const reason = String(p.reason ?? "Automation flagged blocker.");
    const release = s.releases.find(r => r.id === releaseId);
    if (!release) return { output: "", mutations: [], error: `Release ${releaseId} not found.` };
    return {
      output: `Increment blockingErrors on ${releaseId}: ${reason}`,
      mutations: [`releases.${releaseId}.blockingErrors += 1`],
      apply: (snap) => ({
        ...snap,
        releases: snap.releases.map(r => r.id !== releaseId ? r : {
          ...r,
          blockingErrors: r.blockingErrors + 1,
          knownIssues: [...r.knownIssues, `[auto] ${reason}`],
        }),
      }),
    };
  },
  "create-draft-asset": (p, _c, s, entityId) => {
    const title = String(p.title ?? `Draft asset from ${entityId}`);
    const type = String(p.type ?? "Definition");
    const nextIdx = String(s.knowledgeObjects.length + 1).padStart(6, "0");
    const id = `KO-${nextIdx}`;
    return {
      output: `Draft KO ${id} — "${title}" (${type}) linked from ${entityId}.`,
      mutations: [`knowledgeObjects += ${id}`],
      apply: (snap) => ({
        ...snap,
        knowledgeObjects: [...snap.knowledgeObjects, {
          id, type: type as KnowledgeObject["type"], title, body: `[Auto-drafted by automation. Requires human review.]`,
          sourceConceptIds: [], sourceFrameworkIds: [],
          promptId: null, generatedAt: nowISO(),
          humanReviewRequired: true, humanReviewCompleted: false,
          audience: "Internal", status: "Draft", version: "0.1.0", steward: "Editorial Board",
          createdAt: nowISO(), updatedAt: nowISO(),
        }],
      }),
    };
  },
  "link-canonical-asset": (p, ctx, s, entityId) => {
    const targetId = String(p.targetId ?? "");
    const field = String(p.field ?? "conceptIds");
    if (!targetId) return { output: "", mutations: [], error: "targetId required." };
    // Verify target exists
    const known = [...s.concepts, ...s.frameworks, ...s.knowledgeObjects, ...s.clientTools, ...s.publications, ...s.clientToolkits, ...s.aiPacks, ...s.agents];
    if (!known.some(x => x.id === targetId)) return { output: "", mutations: [], error: `Canonical target ${targetId} not found.` };
    const kind = String(ctx.kind);
    return {
      output: `Link ${targetId} into ${entityId}.${field}.`,
      mutations: [`${kind}.${entityId}.${field} += ${targetId}`],
      apply: (snap) => {
        const arrKey = ({
          publication: "publications", clientToolkit: "clientToolkits", aiPack: "aiPacks",
          agent: "agents", concept: "concepts", framework: "frameworks",
        } as Record<string, keyof DataSnapshot>)[kind];
        if (!arrKey) return snap;
        return { ...snap, [arrKey]: (snap[arrKey] as unknown as {id:string;[k:string]:unknown}[]).map(e => {
          if (e.id !== entityId) return e;
          const cur = Array.isArray(e[field]) ? (e[field] as string[]) : [];
          return { ...e, [field]: Array.from(new Set([...cur, targetId])) };
        }) } as DataSnapshot;
      },
    };
  },
  "update-metadata": (p, ctx, _s, entityId) => {
    const field = String(p.field ?? "reviewDate");
    const value = p.value ?? nowISO();
    const kind = String(ctx.kind);
    return {
      output: `Update ${entityId}.${field}.`,
      mutations: [`${kind}.${entityId}.${field} = ${JSON.stringify(value)}`],
      apply: (snap) => {
        const arrKey = ({
          publication: "publications", clientToolkit: "clientToolkits", aiPack: "aiPacks",
          agent: "agents", concept: "concepts", framework: "frameworks", knowledgeObject: "knowledgeObjects",
        } as Record<string, keyof DataSnapshot>)[kind];
        if (!arrKey) return snap;
        return { ...snap, [arrKey]: (snap[arrKey] as unknown as {id:string;[k:string]:unknown}[]).map(e =>
          e.id === entityId ? { ...e, [field]: value, updatedAt: nowISO() } : e,
        ) } as DataSnapshot;
      },
    };
  },
  "export-manifest": (_p, _c, s, entityId) => {
    const release = s.releases.find(r => r.id === entityId);
    if (!release) return { output: "", mutations: [], error: `Release ${entityId} not found.` };
    return { output: JSON.stringify(release.manifest), mutations: [] };
  },
  "request-promotion": (p, ctx, s, entityId) => {
    const kind = String(ctx.kind);
    const target = String(p.targetStage ?? "");
    if (!target) return { output: "", mutations: [], error: "targetStage required." };
    const from = String(ctx.stage ?? "");
    if (!isAdjacentStageTransition(from as never, target as never))
      return { output: "", mutations: [], error: `Promotion ${from}→${target} is not adjacent. Automation cannot skip stages.` };
    let ok = false; let blockers: string[] = [];
    if (kind === "publication") {
      const p2 = s.publications.find(x => x.id === entityId)!;
      const r = validatePublicationPromotion(p2, target as never, s); ok = r.ok; blockers = r.blockers;
    } else if (kind === "clientToolkit") {
      const p2 = s.clientToolkits.find(x => x.id === entityId)!;
      const r = validateToolkitPromotion(p2, target as never, s); ok = r.ok; blockers = r.blockers;
    } else if (kind === "aiPack") {
      const p2 = s.aiPacks.find(x => x.id === entityId)!;
      const r = validateAIPackPromotion(p2, target as never, s); ok = r.ok; blockers = r.blockers;
    } else if (kind === "agent") {
      const p2 = s.agents.find(x => x.id === entityId)!;
      const r = validateAgentPromotion(p2, target as never, s); ok = r.ok; blockers = r.blockers;
    } else {
      return { output: "", mutations: [], error: `Promotion not supported for ${kind}.` };
    }
    if (!ok) return { output: `Promotion blocked: ${blockers.join("; ")}`, mutations: [], error: `Blocked: ${blockers.join("; ")}` };
    const arrKey = ({ publication: "publications", clientToolkit: "clientToolkits", aiPack: "aiPacks", agent: "agents" } as Record<string, keyof DataSnapshot>)[kind]!;
    return {
      output: `Promote ${entityId} to ${target}.`,
      mutations: [`${kind}.${entityId}.manufacturingStage = ${target}`],
      destructive: target === "Canonical" || target === "Released",
      apply: (snap) => ({
        ...snap,
        [arrKey]: (snap[arrKey] as unknown as {id:string; manufacturingStage:string; stageHistory:unknown[]; [k:string]:unknown}[]).map(e =>
          e.id === entityId ? {
            ...e, manufacturingStage: target,
            stageHistory: [...(e.stageHistory as unknown[]), { stage: target, at: nowISO(), actor: "automation", note: "Automation-promoted (approved)." }],
            updatedAt: nowISO(),
          } : e,
        ),
      } as DataSnapshot),
    };
  },
  "escalate-overdue-review": (p, ctx, _s, entityId) => {
    const to = String(p.escalateTo ?? "Owner");
    return { output: `Escalate overdue review for ${entityId} to ${to}. reviewDate=${String(ctx.reviewDate ?? "n/a")}.`, mutations: [] };
  },
  "flag-broken-references": (_p, _c, s, entityId) => {
    const bad = detectBrokenReferences(s).filter(b => b.source === entityId || b.targetId === entityId);
    if (!bad.length) return { output: `No broken references for ${entityId}.`, mutations: [] };
    return { output: `Broken refs (${bad.length}): ${bad.map(b => `${b.source}→${b.targetId}(${b.kind})`).slice(0,5).join(", ")}${bad.length>5?"…":""}`, mutations: [] };
  },
};

const CANONICAL_LIKE_TARGETS = new Set(["Canonical", "Released"]);
export function actionRequiresApproval(action: AutomationActionKind, params: Record<string, unknown>): boolean {
  if (action === "remove-release-candidate") return true;
  if (action === "block-release") return true;
  if (action === "request-promotion" && CANONICAL_LIKE_TARGETS.has(String(params.targetStage))) return true;
  return false;
}

// ------------------ Execution ------------------

export interface ExecutionInput {
  recipe: AutomationRecipe;
  snapshot: DataSnapshot;
  entityIds: string[];                 // targets — must be non-empty; use recipe.trigger.entityIds as fallback
  actor: string;
  dryRun: boolean;
  triggerEventId?: string;             // for idempotency
  ignoreConcurrency?: boolean;
}

export interface ExecutionOutput {
  run: AutomationRun;
  nextSnapshot: DataSnapshot;          // includes the run appended + any applied mutations
  blocked?: "concurrency" | "idempotency" | "invalid";
}

function ev(kind: AutomationRunEvent["kind"], message: string, actor: string): AutomationRunEvent {
  return { at: nowISO(), kind, message, actor };
}

export function executeRecipe(input: ExecutionInput): ExecutionOutput {
  const { recipe, snapshot, actor, dryRun } = input;
  const entityIds = input.entityIds.length ? input.entityIds : recipe.trigger.entityIds;
  const triggerEventId = input.triggerEventId ?? `evt-${Date.now()}`;
  const runId = nextRunId(snapshot);
  const key = idempotencyKey(recipe, triggerEventId, entityIds);

  const validation = validateRecipe(recipe);
  const baseRun: AutomationRun = {
    id: runId, recipeId: recipe.id, recipeVersion: recipe.version,
    recipeSnapshot: JSON.parse(JSON.stringify(recipe)),
    triggerKind: recipe.trigger.kind, triggerEventId, entityIds,
    actor, status: "pending", dryRun, idempotencyKey: key,
    stepRuns: [], events: [ev("created", `Run created by ${actor}${dryRun ? " (dry-run)" : ""}.`, actor)],
    startedAt: null, completedAt: null,
    approvals: recipe.approvals.map(cp => ({ checkpointId: cp.id, approvedBy: null, approvedAt: null, rejected: false, note: "" })),
    errorSummary: null, createdAt: nowISO(), updatedAt: nowISO(),
  };

  if (!validation.ok) {
    const run = { ...baseRun, status: "failed" as const, errorSummary: validation.errors.join("; "),
      events: [...baseRun.events, ev("failed", `Invalid recipe: ${validation.errors.join("; ")}`, actor)],
      completedAt: nowISO() };
    return { run, nextSnapshot: { ...snapshot, automationRuns: [...snapshot.automationRuns, run] }, blocked: "invalid" };
  }

  if (!dryRun) {
    if (!input.ignoreConcurrency) {
      const conflict = isConcurrencyBlocked(snapshot, recipe, entityIds);
      if (conflict) {
        const run = { ...baseRun, status: "cancelled" as const,
          events: [...baseRun.events, ev("concurrency-blocked", `Blocked by in-flight run ${conflict.id}.`, actor)],
          errorSummary: `Concurrency conflict with ${conflict.id}.`, completedAt: nowISO() };
        return { run, nextSnapshot: { ...snapshot, automationRuns: [...snapshot.automationRuns, run] }, blocked: "concurrency" };
      }
    }
    const dup = isIdempotencyBlocked(snapshot, recipe, key);
    if (dup) {
      const run = { ...baseRun, status: "cancelled" as const,
        events: [...baseRun.events, ev("idempotency-skipped", `Duplicate of ${dup.id} within window.`, actor)],
        errorSummary: `Idempotency duplicate of ${dup.id}.`, completedAt: nowISO() };
      return { run, nextSnapshot: { ...snapshot, automationRuns: [...snapshot.automationRuns, run] }, blocked: "idempotency" };
    }
  }

  let workingSnapshot = snapshot;
  const stepRuns: AutomationStepRun[] = [];
  const events: AutomationRunEvent[] = [...baseRun.events, ev("started", `Started against ${entityIds.length} entity(ies).`, actor)];
  let overallStatus: AutomationRun["status"] = "succeeded";
  let errorSummary: string | null = null;

  outer:
  for (const targetId of entityIds) {
    const ctx = buildEntityContext(snapshot, recipe.trigger.entityScope, targetId);
    for (const step of recipe.steps) {
      const allConditionsPass = step.conditions.every(c => evaluateCondition(c, ctx));
      const sr: AutomationStepRun = {
        stepId: step.id, status: "pending", attempt: 0,
        startedAt: nowISO(), endedAt: null, output: "", error: null, mutations: [],
      };
      if (!allConditionsPass) {
        sr.status = "skipped"; sr.endedAt = nowISO();
        sr.output = `Skipped: conditions not met (${step.conditions.length} condition(s)).`;
        events.push(ev("step-skipped", `[${targetId}] ${step.name}: conditions not met.`, actor));
        stepRuns.push(sr); continue;
      }
      const needsApproval = step.requiresApproval || actionRequiresApproval(step.action, step.parameters);
      if (needsApproval) {
        const cp = recipe.approvals.find(a => a.afterStepId === step.id) ?? recipe.approvals[0];
        const record = cp ? baseRun.approvals.find(a => a.checkpointId === cp.id) : undefined;
        const approved = record?.approvedBy && !record.rejected;
        if (!approved && !dryRun) {
          sr.status = "waiting-approval"; sr.endedAt = nowISO();
          sr.output = `Waiting for approval by ${cp?.approverRole ?? "Owner"}.`;
          events.push(ev("awaiting-approval", `[${targetId}] ${step.name}: awaiting ${cp?.approverRole ?? "Owner"} approval.`, actor));
          stepRuns.push(sr);
          overallStatus = "waiting-approval";
          break outer;
        }
      }
      // execute with retry
      let attempt = 0;
      let done = false;
      const maxAttempts = step.onFailure === "retry" ? recipe.retryPolicy.maxAttempts : 1;
      while (attempt < maxAttempts && !done) {
        attempt += 1; sr.attempt = attempt; sr.status = "running";
        try {
          const handler = ACTIONS[step.action];
          if (!handler) throw new Error(`Unknown action ${step.action}`);
          const result = handler(step.parameters, ctx, workingSnapshot, targetId, dryRun);
          if (result.error) throw new Error(result.error);
          sr.output = result.output; sr.mutations = result.mutations;
          sr.status = "succeeded"; sr.endedAt = nowISO(); done = true;
          if (!dryRun && result.apply) workingSnapshot = result.apply(workingSnapshot);
          events.push(ev("step-succeeded", `[${targetId}] ${step.name}${dryRun ? " (dry)" : ""}: ${result.output}`, actor));
        } catch (e) {
          sr.error = (e as Error).message;
          if (attempt < maxAttempts) {
            events.push(ev("retried", `[${targetId}] ${step.name}: attempt ${attempt} failed — ${sr.error}`, actor));
            continue;
          }
          sr.status = "failed"; sr.endedAt = nowISO();
          events.push(ev("step-failed", `[${targetId}] ${step.name}: ${sr.error}`, actor));
          if (step.onFailure === "abort" || step.onFailure === "retry") {
            overallStatus = "failed";
            errorSummary = `${step.id} failed: ${sr.error}`;
            stepRuns.push(sr);
            break outer;
          }
        }
      }
      stepRuns.push(sr);
    }
  }

  if (overallStatus === "succeeded") events.push(ev("completed", `Run ${runId} completed.`, actor));
  else if (overallStatus === "failed") events.push(ev("failed", errorSummary ?? "Run failed.", actor));

  const run: AutomationRun = {
    ...baseRun,
    status: overallStatus, stepRuns, events,
    startedAt: baseRun.events[0].at, completedAt: overallStatus === "waiting-approval" ? null : nowISO(),
    errorSummary, updatedAt: nowISO(),
  };
  // Persist run + recipe stats. Only if not dry-run.
  let next: DataSnapshot = { ...workingSnapshot, automationRuns: [...workingSnapshot.automationRuns, run] };
  if (!dryRun) {
    next = {
      ...next,
      automations: next.automations.map(r => r.id !== recipe.id ? r : {
        ...r,
        lastRunAt: run.completedAt ?? run.startedAt ?? nowISO(),
        successCount: r.successCount + (overallStatus === "succeeded" ? 1 : 0),
        failureCount: r.failureCount + (overallStatus === "failed" ? 1 : 0),
        updatedAt: nowISO(),
      }),
    };
  }
  return { run, nextSnapshot: next };
}

// Approve a waiting run and continue execution.
export function approveRun(s: DataSnapshot, runId: string, checkpointId: string, actor: string, note = ""): { run: AutomationRun; nextSnapshot: DataSnapshot } {
  const run = s.automationRuns.find(r => r.id === runId);
  if (!run) throw new Error(`Run ${runId} not found.`);
  if (run.status !== "waiting-approval") throw new Error(`Run ${runId} is not awaiting approval.`);
  const approvals = run.approvals.map(a => a.checkpointId === checkpointId ? { ...a, approvedBy: actor, approvedAt: nowISO(), rejected: false, note } : a);
  const updatedRun: AutomationRun = { ...run, approvals, events: [...run.events, ev("approved", `Checkpoint ${checkpointId} approved by ${actor}.`, actor)], updatedAt: nowISO() };
  const snapAfterApproval: DataSnapshot = { ...s, automationRuns: s.automationRuns.map(r => r.id === runId ? updatedRun : r) };
  // Re-execute recipe with approvals honored (start fresh but preserve idempotency + approvals).
  const recipe = updatedRun.recipeSnapshot;
  const merged: AutomationRun = { ...updatedRun, approvals };
  // Remove the placeholder run (which we've updated) and re-run using injected approvals
  const withoutRun: DataSnapshot = { ...snapAfterApproval, automationRuns: snapAfterApproval.automationRuns.filter(r => r.id !== runId) };
  const result = executeRecipe({
    recipe, snapshot: withoutRun, entityIds: updatedRun.entityIds,
    actor, dryRun: false, triggerEventId: updatedRun.triggerEventId, ignoreConcurrency: true,
  });
  const finalRun: AutomationRun = { ...result.run, id: runId, approvals: merged.approvals, events: [...updatedRun.events, ...result.run.events.slice(1)] };
  return { run: finalRun, nextSnapshot: { ...result.nextSnapshot, automationRuns: result.nextSnapshot.automationRuns.map(r => r.id === result.run.id ? finalRun : r) } };
}

export function rejectRun(s: DataSnapshot, runId: string, checkpointId: string, actor: string, note = ""): { run: AutomationRun; nextSnapshot: DataSnapshot } {
  const run = s.automationRuns.find(r => r.id === runId);
  if (!run) throw new Error(`Run ${runId} not found.`);
  const approvals = run.approvals.map(a => a.checkpointId === checkpointId ? { ...a, approvedBy: actor, approvedAt: nowISO(), rejected: true, note } : a);
  const updated: AutomationRun = { ...run, approvals, status: "cancelled",
    events: [...run.events, ev("rejected", `Checkpoint ${checkpointId} rejected by ${actor}${note ? `: ${note}` : "."}`, actor)],
    completedAt: nowISO(), updatedAt: nowISO(), errorSummary: "Rejected at approval checkpoint." };
  return { run: updated, nextSnapshot: { ...s, automationRuns: s.automationRuns.map(r => r.id === runId ? updated : r) } };
}

export function cancelRun(s: DataSnapshot, runId: string, actor: string): { run: AutomationRun; nextSnapshot: DataSnapshot } {
  const run = s.automationRuns.find(r => r.id === runId);
  if (!run) throw new Error(`Run ${runId} not found.`);
  const updated: AutomationRun = { ...run, status: "cancelled",
    events: [...run.events, ev("cancelled", `Cancelled by ${actor}.`, actor)],
    completedAt: nowISO(), updatedAt: nowISO() };
  return { run: updated, nextSnapshot: { ...s, automationRuns: s.automationRuns.map(r => r.id === runId ? updated : r) } };
}

// ------------------ Release integration ------------------

export interface ReleaseAutomationReport {
  releaseId: string;
  active: number;
  failed: AutomationRun[];
  waiting: AutomationRun[];
  succeeded: AutomationRun[];
  blocking: boolean;
}

export function releaseAutomationReport(release: Release, s: DataSnapshot): ReleaseAutomationReport {
  const manifestIds = new Set(release.manifest.flatMap(m => m.ids).concat(release.id));
  const runs = s.automationRuns.filter(r => r.entityIds.some(id => manifestIds.has(id)) || r.entityIds.includes(release.id));
  const failed = runs.filter(r => r.status === "failed");
  const waiting = runs.filter(r => r.status === "waiting-approval");
  const succeeded = runs.filter(r => r.status === "succeeded");
  return {
    releaseId: release.id,
    active: s.automations.filter(a => a.state === "active").length,
    failed, waiting, succeeded,
    blocking: failed.length > 0 || waiting.length > 0,
  };
}

// ------------------ Trigger evaluation (surface hints only) ------------------

export function shouldTriggerFire(recipe: AutomationRecipe, ctx: Record<string, unknown>): boolean {
  const t: AutomationTrigger = recipe.trigger;
  if (recipe.state !== "active") return false;
  switch (t.kind) {
    case "manual": return false;
    case "readiness-threshold": {
      const threshold = t.readinessThreshold ?? 85;
      const score = Number(ctx.readinessScore ?? 0);
      return score >= threshold;
    }
    case "stage-transition":
      return t.stage ? ctx.stage === t.stage : true;
    case "review-due": {
      if (!ctx.reviewDate) return false;
      const dueBy = Date.now() + (t.reviewDueWithinDays ?? 14) * 24 * 60 * 60 * 1000;
      return new Date(String(ctx.reviewDate)).getTime() <= dueBy;
    }
    case "broken-reference":
    case "coverage-gap":
    case "canonical-updated":
    case "release-gate":
    case "scheduled":
    case "duplicate-detected":
    case "knowledge-health-threshold":
    case "dependency-change":
    case "relationship-added":
    case "relationship-removed":
    case "coverage-drop":
      return true;
  }
  return false;

// Placeholder handler map is exposed for the test harness.
export const _ACTION_KINDS: readonly AutomationActionKind[] = Object.keys(ACTIONS) as AutomationActionKind[];
