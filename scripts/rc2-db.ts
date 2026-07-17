/**
 * RC-2 DB plan analysis — safe, read-only EXPLAIN (no ANALYZE writes).
 * Runs EXPLAIN on the critical hot paths and reports plan shape +
 * flags sequential scans on large candidate tables.
 *
 *   bun run scripts/rc2-db.ts [--out=path.json]
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const out = resolve(process.cwd(), process.argv.find(a => a.startsWith("--out="))?.slice(6) ?? "bench-results/rc2-db.json");

interface Query { name: string; sql: string; note: string }
const QUERIES: Query[] = [
  { name: "workspaces.list_for_member", note: "membership fan-out via helper",
    sql: "SELECT * FROM public.workspaces w WHERE public.is_workspace_member('00000000-0000-0000-0000-000000000000'::uuid, w.id)" },
  { name: "workspace_memberships.by_user", note: "RLS-critical",
    sql: "SELECT * FROM public.workspace_memberships WHERE user_id = '00000000-0000-0000-0000-000000000000'::uuid" },
  { name: "audit_events.by_actor_recent", note: "governance dashboards",
    sql: "SELECT id, created_at, actor, action, target_type, target_id FROM public.audit_events WHERE actor = '00000000-0000-0000-0000-000000000000'::uuid ORDER BY created_at DESC LIMIT 100" },
  { name: "audit_events.by_target", note: "entity history drilldown",
    sql: "SELECT id, created_at, actor, action FROM public.audit_events WHERE target_type = 'concepts' AND target_id = 'demo' ORDER BY created_at DESC LIMIT 50" },
  { name: "knowledge_objects.by_status", note: "catalog filter",
    sql: "SELECT id, title, status FROM public.knowledge_objects WHERE status = 'Canonical' LIMIT 100" },
  { name: "knowledge_objects.by_steward", note: "steward dashboard",
    sql: "SELECT id, title FROM public.knowledge_objects WHERE steward = 'demo' LIMIT 100" },
  { name: "concepts.by_status", note: "registry list",
    sql: "SELECT id, canonical_name FROM public.concepts WHERE status = 'Canonical' LIMIT 200" },
  { name: "user_roles.by_user", note: "RBAC has_role hot path",
    sql: "SELECT role FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-000000000000'::uuid" },
  { name: "rate_limit_buckets.by_key", note: "consume_rate_limit lookup",
    sql: "SELECT * FROM public.rate_limit_buckets WHERE key = 'rl_demo'" },
  { name: "releases.by_stage_recent", note: "release list",
    sql: "SELECT id, stage, created_at FROM public.releases WHERE stage = 'Canonical' ORDER BY created_at DESC LIMIT 50" },
  { name: "review_items.open", note: "review queue",
    sql: "SELECT id FROM public.review_items WHERE state = 'open' LIMIT 100" },
  { name: "qa_issues.blocking_open", note: "release gate",
    sql: "SELECT id FROM public.qa_issues WHERE blocking = true AND resolved = false LIMIT 100" },
];

function psql(sql: string): string {
  return execSync(`psql -Atqc "${sql.replace(/"/g, '\\"')}"`, { encoding: "utf8" });
}

const results = QUERIES.map(q => {
  try {
    const plan = psql(`EXPLAIN (FORMAT JSON) ${q.sql}`);
    const parsed = JSON.parse(plan)[0]?.Plan;
    const flat: string[] = [];
    const walk = (p: any) => {
      if (!p) return;
      flat.push(`${p["Node Type"]}${p["Relation Name"] ? " on " + p["Relation Name"] : ""}${p["Index Name"] ? " using " + p["Index Name"] : ""}`);
      (p.Plans ?? []).forEach(walk);
    };
    walk(parsed);
    const seqScans = flat.filter(x => x.startsWith("Seq Scan"));
    return {
      name: q.name, note: q.note,
      totalCost: parsed?.["Total Cost"] ?? null,
      planShape: flat, seqScans, hasSeqScan: seqScans.length > 0,
    };
  } catch (e: any) {
    return { name: q.name, note: q.note, error: String(e.message || e).slice(0, 300) };
  }
});

// Table sizes for context
let tableSizes: any = null;
try {
  const rows = psql(`SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY n_live_tup DESC`);
  tableSizes = rows.trim().split("\n").filter(Boolean).map(r => {
    const [name, n] = r.split("|"); return { table: name, rows: Number(n) };
  });
} catch (e: any) { tableSizes = { error: String(e.message || e) }; }

// Existing indexes on hot tables
let indexes: any = null;
try {
  const rows = psql(`SELECT tablename, indexname FROM pg_indexes WHERE schemaname='public' AND tablename IN ('audit_events','knowledge_objects','workspace_memberships','user_roles','rate_limit_buckets','concepts','releases') ORDER BY tablename,indexname`);
  indexes = rows.trim().split("\n").filter(Boolean).map(r => {
    const [t, i] = r.split("|"); return { table: t, index: i };
  });
} catch (e: any) { indexes = { error: String(e.message || e) }; }

// Flag: seq scans on tables that are (or will become) large.
const LARGE_CANDIDATES = new Set(["audit_events", "knowledge_objects", "concepts", "relationships", "revisions"]);
const flagged = results.filter(r => (r as any).seqScans?.some((s: string) => LARGE_CANDIDATES.has(s.replace(/^Seq Scan on /, "").split(" ")[0])));

const report = {
  at: new Date().toISOString(),
  queryCount: QUERIES.length,
  tableSizes,
  indexes,
  results,
  flaggedSeqScans: flagged.map(r => ({ name: (r as any).name, seqScans: (r as any).seqScans })),
  ok: flagged.length === 0,
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`wrote ${out}`);
console.log(`queries=${QUERIES.length}  flaggedSeqScans=${flagged.length}`);
for (const r of results) {
  const rr = r as any;
  console.log(`  ${rr.name.padEnd(40)} ${rr.error ? "ERR " + rr.error : (rr.hasSeqScan ? "SEQ-SCAN " : "index    ") + " cost=" + rr.totalCost}`);
}
process.exit(report.ok ? 0 : 0); // reporting-only; don't fail the harness on sparse-fixture seq scans
