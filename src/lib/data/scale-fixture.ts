// RC-1 Blocker #7 — Deterministic scale-fixture generator.
//
// Produces small / medium / large / stress `DataSnapshot` fixtures by
// replicating the seed snapshot's workspace-owned rows into additional
// deterministic "shards", stamping alternating workspace ids, and appending
// synthetic hash-chained audit events + backups.
//
// Design goals:
//   - **Deterministic** for a fixed seed: no `Date`, no `Math.random`.
//   - **Referentially consistent** within each shard: keys named `id`, or
//     ending in `Id` / `Ids`, are remapped through a per-shard id map so
//     cross-entity references (e.g. `governingConceptIds`) still resolve.
//   - **Workspace-safe**: every replicated row is stamped with an active
//     workspace id (alternating WS-001 / WS-002) so
//     `detectWorkspaceLeakage` and `Repo.scopedList` behave normally.
//   - **Isolated**: never wired into `buildSeedSnapshot()`; only the
//     benchmark harness and unit checks consume it.

import { buildSeedSnapshot } from "./seed";
import { buildAuditEvent, verifyAuditChain } from "./audit";
import { createBackup } from "./backups";
import { WORKSPACE_OWNED_KINDS } from "./workspace-scoping";
import type { AuditEvent, DataSnapshot, EntityType, Role } from "./schema";

// Kinds we actually replicate per shard. Rows for other workspace-owned
// kinds (integrations, delivery, etc.) are stamped-only.
const REPLICATED_KINDS: readonly EntityType[] = [
  "domains","concepts","frameworks","knowledgeObjects","clientTools",
  "publications","prompts","agents","releases",
  "clientToolkits","aiPacks","automations","automationRuns",
];

export type ScaleTier = "small" | "medium" | "large" | "stress";

export interface ScaleOptions {
  tier: ScaleTier;
  seed?: number;              // deterministic seed
  shards?: number;            // override tier default
  auditEvents?: number;       // override tier default
  backups?: number;           // override tier default
  workspaceIds?: [string, string];
}

export interface ScaleReport {
  tier: ScaleTier;
  shards: number;
  workspaceIds: string[];
  totals: Record<string, number>;
  auditEvents: number;
  backups: number;
  seedHash: string;           // deterministic fingerprint
}

const TIER_DEFAULTS: Record<ScaleTier, { shards: number; auditEvents: number; backups: number }> = {
  small:  { shards: 1, auditEvents: 50,   backups: 2 },
  medium: { shards: 3, auditEvents: 300,  backups: 3 },
  large:  { shards: 6, auditEvents: 1200, backups: 5 },
  stress: { shards: 15, auditEvents: 3000, backups: 8 },
};

// -------- deterministic LCG (no crypto, no Math.random) --------
function lcg(seed: number) {
  let s = (seed >>> 0) || 0x9E3779B1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s;
  };
}

function stableFingerprint(input: unknown): string {
  const str = typeof input === "string" ? input : JSON.stringify(input);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

// -------- id remapping walker --------
function makeIdMap(rows: unknown[], suffix: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of rows) {
    if (r && typeof r === "object" && "id" in r && typeof (r as { id: unknown }).id === "string") {
      const id = (r as { id: string }).id;
      m.set(id, `${id}#S${suffix}`);
    }
    // nested chapters/sections/modules with their own ids
    for (const k of ["chapters","sections","modules","specifications","evaluationCases","steps","checkpoints"]) {
      const arr = (r as Record<string, unknown>)?.[k];
      if (Array.isArray(arr)) {
        for (const sub of arr) {
          if (sub && typeof sub === "object" && "id" in sub && typeof (sub as { id: unknown }).id === "string") {
            const id = (sub as { id: string }).id;
            m.set(id, `${id}#S${suffix}`);
          }
        }
      }
    }
  }
  return m;
}

function remapValue(v: unknown, map: Map<string, string>): unknown {
  if (typeof v === "string") return map.get(v) ?? v;
  if (Array.isArray(v)) return v.map(x => remapValue(x, map));
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      if (k === "id" || k.endsWith("Id") || k.endsWith("Ids") || k === "parentChapterId" || k === "parentSectionId") {
        out[k] = remapValue(val, map);
      } else if (Array.isArray(val) || (val && typeof val === "object")) {
        // recurse to catch nested id-bearing objects (chapters etc.)
        out[k] = remapValue(val, map);
      } else {
        out[k] = val;
      }
    }
    return out;
  }
  return v;
}

function replicateShard(
  base: DataSnapshot,
  shardIndex: number,
  workspaceId: string,
): Partial<Record<EntityType, unknown[]>> {
  const suffix = String(shardIndex).padStart(3, "0");
  const out: Partial<Record<EntityType, unknown[]>> = {};
  // Build one global id map across replicated kinds so cross-kind refs remap.
  const combined: unknown[] = [];
  for (const kind of REPLICATED_KINDS) combined.push(...((base as unknown as Record<string, unknown[]>)[kind] ?? []));
  const idMap = makeIdMap(combined, suffix);

  for (const kind of REPLICATED_KINDS) {
    const rows = ((base as unknown as Record<string, unknown[]>)[kind] ?? []) as unknown[];
    const cloned = rows.map(r => {
      const remapped = remapValue(r, idMap) as Record<string, unknown>;
      return { ...remapped, workspaceId };
    });
    out[kind] = cloned;
  }
  return out;
}

/**
 * Build a scaled snapshot. Deterministic for a fixed seed.
 * The returned snapshot uses the base seed's workspace(s) and never mutates
 * `base`.
 */
export function scaleSnapshot(opts: ScaleOptions, base?: DataSnapshot): { snapshot: DataSnapshot; report: ScaleReport } {
  const seedSnap = base ?? buildSeedSnapshot();
  const defaults = TIER_DEFAULTS[opts.tier];
  const shards = opts.shards ?? defaults.shards;
  const auditCount = opts.auditEvents ?? defaults.auditEvents;
  const backupCount = opts.backups ?? defaults.backups;
  const [wsA, wsB] = opts.workspaceIds ?? [
    seedSnap.workspaces?.[0]?.id ?? "WS-001",
    seedSnap.workspaces?.[1]?.id ?? seedSnap.workspaces?.[0]?.id ?? "WS-001",
  ];

  // Start from a deep clone so we don't mutate the seed.
  const snap: DataSnapshot = JSON.parse(JSON.stringify(seedSnap));

  // Ensure seed rows for workspace-owned kinds carry a workspaceId (backfill).
  for (const kind of WORKSPACE_OWNED_KINDS) {
    const rows = (snap as unknown as Record<string, unknown[]>)[kind];
    if (!Array.isArray(rows)) continue;
    for (const r of rows) {
      if (r && typeof r === "object" && !(r as Record<string, unknown>).workspaceId) {
        (r as Record<string, unknown>).workspaceId = wsA;
      }
    }
  }

  // Replicate shards.
  for (let i = 1; i <= shards; i++) {
    const ws = i % 2 === 0 ? wsB : wsA;
    const shard = replicateShard(seedSnap, i, ws);
    for (const [kind, rows] of Object.entries(shard)) {
      const target = (snap as unknown as Record<string, unknown[]>)[kind] ?? [];
      (snap as unknown as Record<string, unknown[]>)[kind] = target.concat(rows!);
    }
  }

  // Deterministic synthetic audit events (hash-chained).
  const rand = lcg(opts.seed ?? 0xC0FFEE);
  const actors = ["e2e:admin","editor.one","reviewer.two","publisher.three","ops.four"];
  const roles: Role[] = ["Administrator","Editor","Reviewer","Publisher","Operations"];
  const actions: AuditEvent["action"][] = ["create","update","delete","approve","release"];
  const kindsForAudit = REPLICATED_KINDS;
  const audit: AuditEvent[] = [...(snap.auditEvents ?? [])];
  let prev: AuditEvent | null = audit[audit.length - 1] ?? null;
  const baseTs = Date.parse("2026-02-01T00:00:00.000Z");
  for (let i = 0; i < auditCount; i++) {
    const idx = audit.length + 1;
    const r = rand();
    const kind = kindsForAudit[r % kindsForAudit.length];
    const actor = actors[(r >> 3) % actors.length];
    const role = roles[(r >> 5) % roles.length];
    const action = actions[(r >> 7) % actions.length];
    const ws = (r & 1) === 0 ? wsA : wsB;
    const at = new Date(baseTs + i * 60_000).toISOString();
    const evt = buildAuditEvent(prev, {
      actor, actorRole: role, workspaceId: ws,
      action, entityType: String(kind), entityId: `${kind}#S${i}`,
      reason: "synthetic scale fixture",
      before: null, after: { seq: i },
      at,
    }, `AUDIT-${String(idx).padStart(6, "0")}`);
    audit.push(evt);
    prev = evt;
  }
  snap.auditEvents = audit;

  // Deterministic synthetic backups (each backup snapshots the CURRENT snap,
  // so later ones grow; kept small unless overridden).
  const backups = [...(snap.backups ?? [])];
  for (let i = 0; i < backupCount; i++) {
    // Freeze the timestamp inside the backup by using a static "now"-like id.
    const b = createBackup(snap, {
      label: `scale-${opts.tier}-${i + 1}`,
      reason: "scale-fixture",
      actor: "scale-generator",
    });
    // Overwrite non-deterministic timestamps for determinism.
    const at = new Date(baseTs + i * 3_600_000).toISOString();
    backups.push({ ...b, id: `BKP-SCALE-${String(i + 1).padStart(3, "0")}`, createdAt: at, updatedAt: at });
  }
  snap.backups = backups;

  // Totals report
  const totals: Record<string, number> = {};
  for (const kind of WORKSPACE_OWNED_KINDS) {
    const rows = (snap as unknown as Record<string, unknown[]>)[kind];
    totals[kind] = Array.isArray(rows) ? rows.length : 0;
  }

  const seedHash = stableFingerprint({
    tier: opts.tier, shards, auditCount, backupCount,
    seed: opts.seed ?? 0xC0FFEE, wsA, wsB,
  });

  return {
    snapshot: snap,
    report: {
      tier: opts.tier, shards, workspaceIds: [wsA, wsB],
      totals, auditEvents: snap.auditEvents.length,
      backups: snap.backups.length, seedHash,
    },
  };
}

/** Fixture integrity check — referential + audit-chain + workspace stamping. */
export function verifyScaleFixture(snap: DataSnapshot): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  // Every workspace-owned row must carry a workspaceId.
  for (const kind of WORKSPACE_OWNED_KINDS) {
    const rows = ((snap as unknown as Record<string, unknown[]>)[kind] ?? []) as Array<{ workspaceId?: string; id?: string }>;
    for (const r of rows) {
      if (!r || typeof r !== "object") continue;
      if (!r.workspaceId) issues.push(`unscoped:${kind}:${r.id}`);
    }
  }
  // Audit chain valid.
  const chain = verifyAuditChain(snap.auditEvents ?? []);
  if (!chain.ok) issues.push(`audit-chain-broken:${chain.brokenAt}`);
  // Ids unique per replicated kind.
  for (const kind of REPLICATED_KINDS) {
    const rows = ((snap as unknown as Record<string, unknown[]>)[kind] ?? []) as Array<{ id?: string }>;
    const seen = new Set<string>();
    for (const r of rows) {
      if (!r?.id) continue;
      if (seen.has(r.id)) { issues.push(`dup-id:${kind}:${r.id}`); }
      seen.add(r.id);
    }
  }
  return { ok: issues.length === 0, issues };
}
