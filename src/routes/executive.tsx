import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { KpiCard, SectionTitle, LoadingState, StatusBadge } from "@/components/ui-kit";
import { useSnapshot } from "@/lib/use-snapshot";
import { repository } from "@/lib/data/repository";
import {
  computeExecutiveMetrics, manufacturingAnalytics, teamWorkload,
  releaseAnalytics, automationAnalytics, aiEvalAnalytics,
  metricHistory, evaluateAlertRules, forecastMetricToTarget,
  captureAnalyticsSnapshot, nextExecutiveAlertId, nextSavedViewId,
} from "@/lib/data/analytics";
import { knowledgeHealth } from "@/lib/data/intelligence";

export const Route = createFileRoute("/executive")({
  head: () => ({ meta: [{ title: "Executive Analytics — Legacy Platform v2.0" }] }),
  component: ExecutivePage,
});

type Tab = "overview" | "manufacturing" | "team" | "release" | "automation" | "ai" | "knowledge" | "forecasts" | "alerts" | "views";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "manufacturing", label: "Manufacturing" },
  { key: "team", label: "Team" },
  { key: "release", label: "Release" },
  { key: "automation", label: "Automation" },
  { key: "ai", label: "AI & Eval" },
  { key: "knowledge", label: "Knowledge" },
  { key: "forecasts", label: "Forecasts" },
  { key: "alerts", label: "Alerts" },
  { key: "views", label: "Saved Views" },
];

function ExecutivePage() {
  const s = useSnapshot();
  const [tab, setTab] = useState<Tab>("overview");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  if (!s) return <LoadingState label="Loading analytics…" />;
  const from = dateFrom || null;
  const to = dateTo || null;

  return (
    <>
      <PageHeader
        eyebrow="Executive Analytics"
        title="Command Center"
        description="Manufacturing health, readiness, workload, release, automation, and AI governance. Derived from repository records; historical trends from analytics snapshots."
        actions={
          <button
            onClick={async () => {
              const snap = captureAnalyticsSnapshot(s, "executive-user", "Manual capture");
              await repository.create("analyticsSnapshots", snap);
            }}
            className="text-xs px-3 py-1.5 rounded-md bg-heritage text-heritage-foreground hover:bg-heritage/90"
          >Capture snapshot</button>
        }
      />
      <PageBody>
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`text-xs px-3 py-1.5 rounded-md border ${tab === t.key ? "bg-heritage text-heritage-foreground border-heritage" : "bg-background border-border text-slate-ink hover:bg-muted"}`}>
              {t.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-ink">
            <label>From <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="ml-1 px-2 py-1 border border-border rounded" /></label>
            <label>To <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="ml-1 px-2 py-1 border border-border rounded" /></label>
          </div>
        </div>

        {tab === "overview" && <OverviewTab s={s} from={from} to={to} />}
        {tab === "manufacturing" && <ManufacturingTab s={s} />}
        {tab === "team" && <TeamTab s={s} />}
        {tab === "release" && <ReleaseTab s={s} />}
        {tab === "automation" && <AutomationTab s={s} />}
        {tab === "ai" && <AITab s={s} />}
        {tab === "knowledge" && <KnowledgeTab s={s} />}
        {tab === "forecasts" && <ForecastsTab s={s} />}
        {tab === "alerts" && <AlertsTab s={s} />}
        {tab === "views" && <ViewsTab s={s} tab={tab} dateFrom={dateFrom} dateTo={dateTo} />}
      </PageBody>
    </>
  );
}

function Trend({ points }: { points: { at: string; value: number }[] }) {
  if (points.length === 0) return <div className="text-xs text-muted-foreground">No history.</div>;
  const values = points.map(p => p.value);
  const min = Math.min(...values), max = Math.max(...values);
  const span = Math.max(1, max - min);
  const width = 240, height = 40;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(height - ((p.value - min) / span) * height).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} className="text-heritage">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

function OverviewTab({ s, from, to }: { s: import("@/lib/data/schema").DataSnapshot; from: string | null; to: string | null }) {
  const m = useMemo(() => computeExecutiveMetrics(s), [s]);
  const overallHist = metricHistory(s, "health.overall", undefined, from, to);
  const relHist = metricHistory(s, "release.confidence", "LKR-1.0.001", from, to);
  const autoHist = metricHistory(s, "automation.successRate", undefined, from, to);
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Overall Manufacturing Health" value={`${m.overallHealth}%`} tone={m.overallHealth >= 85 ? "evergreen" : m.overallHealth >= 60 ? "gold" : "warn"} />
        <KpiCard label="Knowledge Health" value={`${m.knowledgeHealth}%`} />
        <KpiCard label="Publication Readiness" value={`${m.publicationReadiness}%`} />
        <KpiCard label="Client Toolkit Readiness" value={`${m.toolkitReadiness}%`} />
        <KpiCard label="AI Pack Readiness" value={`${m.aiPackReadiness}%`} />
        <KpiCard label="Agent Readiness" value={`${m.agentReadiness}%`} />
        <KpiCard label="Automation Success Rate" value={`${m.automationSuccessRate}%`} tone={m.automationSuccessRate >= 80 ? "evergreen" : "warn"} />
        <KpiCard label="Release Confidence" value={`${m.releaseConfidence}%`} tone={m.releaseConfidence >= 70 ? "evergreen" : "warn"} />
        <KpiCard label="Pending Approvals" value={m.pendingApprovals} tone={m.pendingApprovals ? "gold" : "default"} hint="See Operations" />
        <KpiCard label="Overdue Reviews" value={m.overdueReviews} tone={m.overdueReviews ? "warn" : "default"} />
        <KpiCard label="Broken References" value={m.brokenReferences} tone={m.brokenReferences ? "warn" : "default"} />
        <KpiCard label="Blocked Releases" value={m.blockedReleases} tone={m.blockedReleases ? "warn" : "default"} />
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="editorial-card p-4"><SectionTitle>Overall Health trend</SectionTitle><Trend points={overallHist} /></div>
        <div className="editorial-card p-4"><SectionTitle>Release confidence (LKR-1.0.001)</SectionTitle><Trend points={relHist} /></div>
        <div className="editorial-card p-4"><SectionTitle>Automation success rate</SectionTitle><Trend points={autoHist} /></div>
      </div>
    </>
  );
}

function ManufacturingTab({ s }: { s: import("@/lib/data/schema").DataSnapshot }) {
  const a = useMemo(() => manufacturingAnalytics(s), [s]);
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-3">
        <KpiCard label="Released (all)" value={a.releasedThisPeriod} />
        <KpiCard label="WIP aging (avg days)" value={a.workInProgressAgingDays} tone={a.workInProgressAgingDays > 14 ? "warn" : "default"} />
        <KpiCard label="Rework transitions" value={a.reworkCount} />
        <KpiCard label="Top bottleneck" value={a.bottlenecks[0]?.stage ?? "—"} hint={a.bottlenecks[0] ? `${a.bottlenecks[0].avgDays}d avg` : ""} />
      </div>
      <div className="editorial-card p-4">
        <SectionTitle>Stage cycle time (by entity)</SectionTitle>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-ink"><th className="py-1">Entity</th><th>Stage</th><th>Count</th><th>Avg days</th></tr></thead>
          <tbody>
            {a.stageCycles.map((c, i) => (
              <tr key={i} className="border-t border-border"><td className="py-1.5">{c.entityKind}</td><td>{c.stage}</td><td>{c.count}</td><td>{c.avgDays}</td></tr>
            ))}
            {a.stageCycles.length === 0 && <tr><td colSpan={4} className="py-2 text-muted-foreground text-xs">No stage history recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamTab({ s }: { s: import("@/lib/data/schema").DataSnapshot }) {
  const rows = teamWorkload(s);
  return (
    <div className="editorial-card p-4">
      <SectionTitle hint="Record-based; not workforce monitoring">Assigned workload</SectionTitle>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-slate-ink"><th className="py-1">Owner / Steward</th><th>Assigned</th><th>Pending review</th><th>Overdue</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.owner} className="border-t border-border">
              <td className="py-1.5">{r.owner}</td><td>{r.assigned}</td>
              <td>{r.pendingReview}</td><td className={r.overdue ? "text-destructive" : ""}>{r.overdue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReleaseTab({ s }: { s: import("@/lib/data/schema").DataSnapshot }) {
  const a = releaseAnalytics(s);
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-4 gap-3">
        <KpiCard label="Cadence (avg days)" value={a.cadenceDays ?? "—"} />
        <KpiCard label="Blocked releases" value={a.blocked} tone={a.blocked ? "warn" : "default"} />
        <KpiCard label="Avg manifest size" value={a.avgManifestSize} />
        <KpiCard label="Avg confidence" value={`${a.avgConfidence}%`} />
      </div>
      <div className="editorial-card p-4">
        <SectionTitle>Blocker categories</SectionTitle>
        {Object.keys(a.blockerCategories).length === 0
          ? <div className="text-sm text-muted-foreground">No open blockers.</div>
          : <ul className="text-sm space-y-1">
              {Object.entries(a.blockerCategories).map(([k, v]) => (
                <li key={k} className="flex justify-between border-b border-border py-1"><span>{k}</span><span className="font-mono">{v}</span></li>
              ))}
            </ul>}
      </div>
      <div className="editorial-card p-4">
        <SectionTitle>Releases</SectionTitle>
        <ul className="text-sm divide-y divide-border">
          {s.releases.map(r => (
            <li key={r.id} className="py-2 flex items-center gap-3">
              <span className="font-mono text-xs w-32">{r.id}</span>
              <span className="flex-1 truncate">{r.name}</span>
              <StatusBadge status={r.stage} />
              <Link to="/releases/$id" params={{ id: r.id }} className="text-xs underline text-heritage">Open</Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AutomationTab({ s }: { s: import("@/lib/data/schema").DataSnapshot }) {
  const a = automationAnalytics(s);
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-4 gap-3">
        <KpiCard label="Success rate" value={`${a.successRate}%`} tone={a.successRate >= 80 ? "evergreen" : "warn"} />
        <KpiCard label="Total runs" value={a.totalRuns} />
        <KpiCard label="Failed" value={a.failed} tone={a.failed ? "warn" : "default"} />
        <KpiCard label="Waiting approval" value={a.waitingApproval} />
        <KpiCard label="Cancelled" value={a.cancelled} />
        <KpiCard label="Avg duration (s)" value={a.avgDurationSeconds ?? "—"} />
        <KpiCard label="Human intervention" value={`${a.humanInterventionRate}%`} />
        <KpiCard label="Est. manual steps avoided" value={a.estimatedManualStepsAvoided} hint="Estimate: 1 per succeeded step" />
      </div>
      <div className="editorial-card p-4">
        <SectionTitle>Most failure-prone recipes</SectionTitle>
        {a.worstRecipes.length === 0 ? <div className="text-sm text-muted-foreground">No failures recorded.</div>
          : <ul className="text-sm space-y-1">
              {a.worstRecipes.map(r => (
                <li key={r.recipeId} className="flex justify-between border-b border-border py-1">
                  <Link to="/automations/$id" params={{ id: r.recipeId }} className="underline">{r.recipeId}</Link>
                  <span className="font-mono">{r.failures} failures</span>
                </li>
              ))}
            </ul>}
      </div>
    </div>
  );
}

function AITab({ s }: { s: import("@/lib/data/schema").DataSnapshot }) {
  const a = aiEvalAnalytics(s);
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-4 gap-3">
        <KpiCard label="Agent eval pass rate" value={`${a.agentEvalPassRate}%`} />
        <KpiCard label="Agent eval not-run" value={a.agentEvalNotRun} tone={a.agentEvalNotRun ? "gold" : "default"} />
        <KpiCard label="AI Pack eval pass rate" value={`${a.aiPackEvalPassRate}%`} />
        <KpiCard label="AI Pack eval not-run" value={a.aiPackEvalNotRun} />
        <KpiCard label="Agent human review complete" value={a.agentHumanReviewCompleted} />
        <KpiCard label="Agent human review pending" value={a.agentHumanReviewPending} tone={a.agentHumanReviewPending ? "warn" : "default"} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="editorial-card p-4">
          <SectionTitle>Agent stage distribution</SectionTitle>
          <ul className="text-sm">
            {Object.entries(a.agentStageDistribution).map(([k, v]) => (
              <li key={k} className="flex justify-between border-b border-border py-1"><span>{k}</span><span className="font-mono">{v}</span></li>
            ))}
          </ul>
        </div>
        <div className="editorial-card p-4">
          <SectionTitle>AI Pack stage distribution</SectionTitle>
          <ul className="text-sm">
            {Object.entries(a.aiPackStageDistribution).map(([k, v]) => (
              <li key={k} className="flex justify-between border-b border-border py-1"><span>{k}</span><span className="font-mono">{v}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function KnowledgeTab({ s }: { s: import("@/lib/data/schema").DataSnapshot }) {
  const h = knowledgeHealth(s);
  const brokenHist = metricHistory(s, "references.broken");
  const freshHist = metricHistory(s, "health.freshness");
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-4 gap-3">
        <KpiCard label="Overall" value={`${h.overall}%`} />
        <KpiCard label="Coverage" value={`${h.coverage}%`} />
        <KpiCard label="Freshness" value={`${h.freshness}%`} />
        <KpiCard label="Automation Coverage" value={`${h.automationCoverage}%`} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="editorial-card p-4"><SectionTitle>Broken references trend</SectionTitle><Trend points={brokenHist} /></div>
        <div className="editorial-card p-4"><SectionTitle>Freshness trend</SectionTitle><Trend points={freshHist} /></div>
      </div>
      <div className="editorial-card p-4">
        <SectionTitle>Recommendations</SectionTitle>
        <ul className="text-sm list-disc pl-5 space-y-1">{h.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
      </div>
    </div>
  );
}

function ForecastsTab({ s }: { s: import("@/lib/data/schema").DataSnapshot }) {
  const specs = [
    { key: "health.overall", target: 90, label: "Overall health → 90%" },
    { key: "automation.successRate", target: 95, label: "Automation success → 95%" },
    { key: "release.confidence", scope: "LKR-1.0.001", target: 85, label: "LKR-1.0.001 confidence → 85%" },
  ];
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {specs.map(spec => {
        const f = forecastMetricToTarget(s, spec.key, spec.target, spec.scope);
        if (!f) return <div key={spec.key} className="editorial-card p-4 text-sm text-muted-foreground">{spec.label}: no history.</div>;
        return (
          <div key={spec.key + (spec.scope ?? "")} className="editorial-card p-4">
            <SectionTitle hint={f.confidence}>{spec.label}</SectionTitle>
            <div className="text-sm text-slate-ink space-y-1">
              <div>Current: <span className="font-mono">{f.currentValue}</span> · Target: <span className="font-mono">{f.target}</span></div>
              <div>Slope/week: <span className="font-mono">{f.slopePerWeek}</span></div>
              <div>Weeks to target: <span className="font-mono">{f.weeksToTarget ?? "—"}</span></div>
              <div className="text-xs text-muted-foreground">Window: {f.dataWindowWeeks} weeks · confidence {f.confidence}</div>
              <details className="text-xs mt-2">
                <summary className="cursor-pointer text-heritage">Assumptions & limitations</summary>
                <ul className="list-disc pl-5 mt-1">
                  {f.assumptions.map((x, i) => <li key={`a${i}`}>{x}</li>)}
                  {f.limitations.map((x, i) => <li key={`l${i}`} className="text-muted-foreground">{x}</li>)}
                </ul>
              </details>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AlertsTab({ s }: { s: import("@/lib/data/schema").DataSnapshot }) {
  const derived = useMemo(() => evaluateAlertRules(s), [s]);
  const stored = s.executiveAlerts ?? [];
  return (
    <div className="space-y-4">
      <div className="editorial-card p-4">
        <SectionTitle>Live rule evaluations</SectionTitle>
        {derived.length === 0 ? <div className="text-sm text-muted-foreground">No rules firing.</div>
          : <ul className="divide-y divide-border">
              {derived.map((r, i) => (
                <li key={i} className="py-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${r.severity === "critical" ? "bg-destructive text-destructive-foreground" : r.severity === "warning" ? "bg-gold text-heritage" : "bg-muted text-slate-ink"}`}>{r.severity}</span>
                    <span className="text-sm font-medium">{r.title}</span>
                    <button
                      onClick={async () => {
                        const now = new Date().toISOString();
                        await repository.create("executiveAlerts", {
                          id: nextExecutiveAlertId(s),
                          ruleKey: r.ruleKey, severity: r.severity, title: r.title, message: r.message,
                          entityIds: r.entityIds, metricKey: r.metricKey,
                          observedValue: r.observedValue, threshold: r.threshold,
                          firedAt: now, acknowledgedAt: null, acknowledgedBy: null, resolvedAt: null,
                          explanation: r.explanation, createdAt: now, updatedAt: now,
                        });
                      }}
                      className="ml-auto text-xs px-2 py-0.5 border border-border rounded hover:bg-muted"
                    >Persist</button>
                  </div>
                  <div className="text-xs text-slate-ink mt-1">{r.message}</div>
                  <div className="text-xs text-muted-foreground mt-1">{r.explanation}</div>
                  {r.entityIds.length > 0 && (
                    <div className="text-xs mt-1 flex gap-2 flex-wrap">
                      {r.entityIds.slice(0, 8).map(id => <Link key={id} to="/knowledge/$id" params={{ id }} className="underline text-heritage font-mono">{id}</Link>)}
                    </div>
                  )}
                </li>
              ))}
            </ul>}
      </div>
      <div className="editorial-card p-4">
        <SectionTitle hint={`${stored.length} stored`}>Persisted alerts</SectionTitle>
        {stored.length === 0 ? <div className="text-sm text-muted-foreground">None persisted.</div>
          : <ul className="text-sm divide-y divide-border">
              {stored.map(a => (
                <li key={a.id} className="py-2 flex items-center gap-3">
                  <span className="font-mono text-xs w-20">{a.id}</span>
                  <span className="flex-1">{a.title}</span>
                  <span className="text-xs text-muted-foreground">{a.acknowledgedAt ? "ack" : "open"}</span>
                  {!a.acknowledgedAt && (
                    <button
                      onClick={async () => {
                        const now = new Date().toISOString();
                        await repository.update("executiveAlerts", a.id, { acknowledgedAt: now, acknowledgedBy: "executive-user" });
                      }}
                      className="text-xs px-2 py-0.5 border border-border rounded hover:bg-muted"
                    >Acknowledge</button>
                  )}
                </li>
              ))}
            </ul>}
      </div>
    </div>
  );
}

function ViewsTab({ s, tab, dateFrom, dateTo }: { s: import("@/lib/data/schema").DataSnapshot; tab: string; dateFrom: string; dateTo: string }) {
  const [name, setName] = useState("");
  const views = s.savedExecutiveViews ?? [];
  return (
    <div className="space-y-4">
      <div className="editorial-card p-4">
        <SectionTitle>Save current view</SectionTitle>
        <div className="flex gap-2 items-center">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="View name" className="flex-1 px-3 py-1.5 border border-border rounded text-sm" />
          <button
            disabled={!name.trim()}
            onClick={async () => {
              const now = new Date().toISOString();
              await repository.create("savedExecutiveViews", {
                id: nextSavedViewId(s), name: name.trim(), tab,
                filters: { dateFrom: dateFrom || null, dateTo: dateTo || null },
                createdBy: "executive-user", createdAt: now, updatedAt: now,
              });
              setName("");
            }}
            className="text-xs px-3 py-1.5 rounded-md bg-heritage text-heritage-foreground disabled:opacity-50"
          >Save</button>
        </div>
      </div>
      <div className="editorial-card p-4">
        <SectionTitle hint={`${views.length}`}>Saved executive views</SectionTitle>
        {views.length === 0 ? <div className="text-sm text-muted-foreground">No saved views yet.</div>
          : <ul className="text-sm divide-y divide-border">
              {views.map(v => (
                <li key={v.id} className="py-2 flex items-center gap-3">
                  <span className="font-mono text-xs w-20">{v.id}</span>
                  <span className="flex-1">{v.name} <span className="text-xs text-muted-foreground">· tab {v.tab}</span></span>
                  <button
                    onClick={async () => { await repository.remove("savedExecutiveViews", v.id); }}
                    className="text-xs px-2 py-0.5 border border-border rounded hover:bg-muted"
                  >Delete</button>
                </li>
              ))}
            </ul>}
      </div>
    </div>
  );
}
