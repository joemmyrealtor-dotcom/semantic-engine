import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, PageBody } from "@/components/page-header";
import { KpiCard, SectionTitle, LoadingState, StatusBadge } from "@/components/ui-kit";
import { useSnapshot } from "@/lib/use-snapshot";
import { detectBrokenReferences, evaluateReleaseGate, publicationCoverage, toolkitCoverage, aiPackCoverage, agentCoverage } from "@/lib/data/service";
import { knowledgeHealth } from "@/lib/data/intelligence";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Executive Dashboard — Legacy Platform v2.0" }] }),
  component: Dashboard,
});

function Dashboard() {
  const s = useSnapshot();
  if (!s) return <LoadingState label="Loading repository…" />;

  const canonical = (arr: { status: string }[]) => arr.filter(x => x.status === "Canonical").length;
  const draftKO = s.knowledgeObjects.filter(k => k.status === "Draft").length;
  const overdue = s.concepts.filter(c => {
    if (!c.lastReviewedAt) return true;
    const last = new Date(c.lastReviewedAt).getTime();
    return Date.now() - last > c.reviewCadenceMonths * 30 * 24 * 3600 * 1000;
  }).length;
  const broken = detectBrokenReferences(s);
  const nextRelease = s.releases[0];
  const gate = nextRelease ? evaluateReleaseGate(nextRelease) : null;
  const health = knowledgeHealth(s);

  const avg = (nums: number[]) => nums.length === 0 ? 100 : Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  const pubReadiness = avg(s.publications.filter(p => !p.archived).map(p => publicationCoverage(p, s).readinessScore));
  const tkReadiness = avg((s.clientToolkits ?? []).filter(t => !t.archived).map(t => toolkitCoverage(t, s).readinessScore));
  const apReadiness = avg((s.aiPacks ?? []).filter(a => !a.archived).map(a => aiPackCoverage(a, s).readinessScore));
  const agReadiness = avg((s.agents ?? []).filter(a => !a.archived).map(a => agentCoverage(a, s).readinessScore));
  const releaseReadiness = nextRelease && gate ? Math.round((gate.passed / Math.max(1, gate.total)) * 100) : 0;
  const totalAssets = s.concepts.length + s.frameworks.length + s.knowledgeObjects.length +
    s.publications.length + s.clientToolkits.length + s.aiPacks.length + s.agents.length + s.clientTools.length;

  const recent = [...s.knowledgeObjects, ...s.concepts as unknown as typeof s.knowledgeObjects]
    .slice(0, 6);

  return (
    <>
      <PageHeader
        eyebrow="Executive Dashboard"
        title="Legacy Platform v2.0"
        description="Repository state, release readiness, and next actions for the Legacy Project Digital Knowledge Platform."
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <KpiCard label="Knowledge Assets" value={totalAssets} tone="gold" hint={`across ${s.domains.length} domains`} />
          <KpiCard label="Overall Manufacturing Health" value={`${health.overall}%`} tone={health.overall >= 85 ? "evergreen" : health.overall >= 60 ? "gold" : "warn"} hint={<Link to="/knowledge" className="underline">Open Health</Link> as unknown as string} />
          <KpiCard label="Knowledge Health" value={`${health.overall}%`} hint={`${health.recommendations.length} recommendation${health.recommendations.length === 1 ? "" : "s"}`} />
          <KpiCard label="Manufacturing Coverage" value={`${health.coverage}%`} />
          <KpiCard label="Release Readiness" value={`${releaseReadiness}%`} tone="evergreen" />
          <KpiCard label="Publication Readiness" value={`${pubReadiness}%`} />
          <KpiCard label="Client Toolkit Readiness" value={`${tkReadiness}%`} />
          <KpiCard label="AI Pack Readiness" value={`${apReadiness}%`} />
          <KpiCard label="Agent Readiness" value={`${agReadiness}%`} />
          <KpiCard label="Automation Coverage" value={`${health.automationCoverage}%`} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          <KpiCard label="Domains" value={s.domains.length} hint={`${canonical(s.domains)} canonical`} />
          <KpiCard label="Concepts" value={s.concepts.length} hint={`${canonical(s.concepts)} canonical`} tone="gold" />
          <KpiCard label="Frameworks" value={s.frameworks.length} hint={`${canonical(s.frameworks)} canonical`} />
          <KpiCard label="Knowledge Objects" value={s.knowledgeObjects.length} hint={`${draftKO} draft`} />
          <KpiCard label="Client Tools" value={s.clientTools.length} hint={`${canonical(s.clientTools)} canonical`} />
          <KpiCard label="Publications" value={s.publications.length} hint={`${s.publications.reduce((a, p) => a + p.chapters.length, 0)} chapters`} />
          <KpiCard label="Prompts" value={s.prompts.length} />
          <KpiCard label="Agents" value={s.agents.length} />
          <KpiCard label="Releases" value={s.releases.length} tone="evergreen" />
          <KpiCard label="Unresolved References" value={broken.length} tone={broken.length ? "warn" : "default"} />
          <KpiCard label="Overdue Reviews" value={overdue} tone={overdue ? "warn" : "default"} />
          <KpiCard label="AI Draft Backlog" value={draftKO} tone={draftKO ? "gold" : "default"} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 editorial-card p-5">
            <SectionTitle hint={nextRelease?.id}>Release Readiness</SectionTitle>
            {nextRelease && gate ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <StatusBadge status={nextRelease.stage} />
                  <span className="text-sm text-slate-ink">{nextRelease.name}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-gold" style={{ width: `${(gate.passed / gate.total) * 100}%` }} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {gate.passed} of {gate.total} gates passed · {nextRelease.blockingErrors} blocking errors · {nextRelease.alignmentWarnings} alignment warnings
                </div>
                <ul className="text-sm space-y-1.5 mt-2">
                  {nextRelease.gateChecklist.map(g => (
                    <li key={g.id} className="flex items-center gap-2">
                      <span className={`inline-block size-2 rounded-full ${g.passed ? "bg-evergreen" : "bg-destructive"}`} />
                      <span className="font-mono text-xs text-slate-ink">{g.id}</span>
                      <span className="text-sm">{g.label}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/releases/$id" params={{ id: nextRelease.id }} className="inline-block text-sm text-heritage underline underline-offset-4 mt-2">Open release →</Link>
              </div>
            ) : <div className="text-sm text-muted-foreground">No releases planned.</div>}
          </div>

          <div className="editorial-card p-5">
            <SectionTitle>Next Actions</SectionTitle>
            <ul className="text-sm space-y-2">
              {overdue > 0 && <li>· Review {overdue} concept{overdue === 1 ? "" : "s"} past cadence.</li>}
              {broken.length > 0 && <li>· Resolve {broken.length} broken reference{broken.length === 1 ? "" : "s"} in <Link to="/graph" className="underline">Relationships</Link>.</li>}
              {draftKO > 0 && <li>· {draftKO} Knowledge Object draft{draftKO === 1 ? "" : "s"} awaiting human review.</li>}
              <li>· Complete editorial pass on CH-007 in <Link to="/publications/$id" params={{ id: "PL-101" }} className="underline">PL-101</Link>.</li>
              <li>· Advance <Link to="/releases/$id" params={{ id: "LKR-1.0.001" }} className="underline">LKR-1.0.001</Link> from Release Candidate to Canonical after warning review.</li>
              <li>· Populate reserved framework F-010.</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 editorial-card p-5">
          <SectionTitle>Recent Activity</SectionTitle>
          <ul className="divide-y divide-border">
            {recent.map((r, i) => (
              <li key={r.id + i} className="py-2.5 flex items-center gap-3 text-sm">
                <span className="font-mono text-xs text-slate-ink w-28 shrink-0">{r.id}</span>
                <span className="truncate flex-1">{("title" in r ? r.title : (r as { canonicalName: string }).canonicalName)}</span>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </div>
      </PageBody>
    </>
  );
}
