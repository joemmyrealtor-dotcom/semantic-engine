// Tasks 32–37 — Growth Command Center (read-only operator surface).
//
// Noindex, permission-gated, and state-free: it reports brand, proof,
// cadence, measurement, campaign, and paid-readiness status. It activates
// nothing, sends nothing, and writes to no external system.

import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageBody } from "@/components/page-header";
import { SectionTitle } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { RequirePermission } from "@/components/require-permission";
import { buildBrandReadiness } from "@/lib/marketing/brand-system";
import { buildProofOperationsReport } from "@/lib/marketing/proof-operations";
import { buildAcquisitionCadence, CADENCE_KIND_LABEL, WEEKLY_QUOTA } from "@/lib/marketing/acquisition-cadence";
import { buildGrowthMeasurement, type MetricReading } from "@/lib/marketing/growth-metrics";
import { compareTargets, NINETY_DAY_TARGETS, RECALIBRATION_RULE, TARGET_LABEL } from "@/lib/marketing/growth-targets";
import { buildCampaignReadiness, CAMPAIGN_ASSETS } from "@/lib/marketing/acquisition-campaigns";
import { buildFunnelMap } from "@/lib/marketing/funnel-map";
import { buildAcquisitionFunnel } from "@/lib/marketing/acquisition-funnel";
import { buildLaunchConversionReadiness } from "@/lib/marketing/launch-conversion-readiness";
import { buildPaidReadiness, PAID_BLUEPRINTS, PAID_GUARDRAILS } from "@/lib/marketing/paid-readiness";
import { loadConversionEvents } from "@/lib/marketing/conversion-store";
import { queuedLeads } from "@/lib/marketing/lead-capture";
import type { MarketingEvent } from "@/lib/marketing/analytics";

export const Route = createFileRoute("/admin/growth-command")({
  head: () => ({
    meta: [
      { title: "Growth Command Center — Legacy Forge" },
      { name: "description", content: "Read-only brand, proof, cadence, measurement, and campaign readiness for client acquisition." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: GrowthCommandRoute,
});

function tone(status: string) {
  if (["PASS", "READY", "DRAFT_READY", "COVERED", "MEASURED", "TRACKING"].includes(status)) return "default" as const;
  if (["REVIEW", "AWAITING_SOURCE_DATA", "EMPTY", "TARGET_ONLY", "READINESS_DOCUMENTED", "UNAVAILABLE", "NOT_CONNECTED"].includes(status))
    return "secondary" as const;
  return "destructive" as const;
}

function GrowthCommandRoute() {
  return (
    <RequirePermission permission="integration.manage" label="Growth Command Center">
      <GrowthCommandPanel />
    </RequirePermission>
  );
}

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function MetricRow({ reading }: { reading: MetricReading }) {
  return (
    <li className="flex flex-wrap items-center gap-2 border-t border-border py-2 text-sm first:border-0">
      <Badge variant={tone(reading.status)}>{reading.status}</Badge>
      <span className="font-medium">{reading.label}</span>
      <span className="ml-auto tabular-nums">
        {reading.status === "MEASURED" ? reading.value : <span className="text-muted-foreground">Not available</span>}
      </span>
      {reading.note ? <p className="w-full text-xs text-muted-foreground">{reading.note}</p> : null}
    </li>
  );
}

function GrowthCommandPanel() {
  const [events, setEvents] = useState<MarketingEvent[] | undefined>(undefined);
  const [leadCount, setLeadCount] = useState<number | undefined>(undefined);

  useEffect(() => {
    setEvents(loadConversionEvents());
    setLeadCount(queuedLeads().length);
  }, []);

  const brand = buildBrandReadiness();
  const proof = buildProofOperationsReport();
  const cadence = buildAcquisitionCadence();
  const cadencePerWeek = Object.values(WEEKLY_QUOTA).reduce((a, b) => a + b, 0);
  const measurement = buildGrowthMeasurement({
    ...(events ? { events } : {}),
    ...(typeof leadCount === "number" ? { capturedLeads: leadCount } : {}),
    cadenceItemsPerWeek: cadencePerWeek,
    proofCategoriesCovered: proof.categories.filter(c => c.status === "COVERED").length,
  });
  const comparisons = compareTargets(measurement.readings, NINETY_DAY_TARGETS);
  const campaigns = buildCampaignReadiness();
  const paid = buildPaidReadiness();
  const funnel = buildFunnelMap();
  const launch = buildLaunchConversionReadiness();
  const acquisitionFunnel = buildAcquisitionFunnel();

  return (
    <>
      <PageHeader
        title="Growth Command Center"
        description="Read-only readiness across brand, proof, cadence, measurement, campaigns, and paid acquisition. Nothing on this screen activates, sends, or publishes."
      />
      <PageBody>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Brand readiness" value={brand.status} note={`${brand.findings.length} findings`} />
          <StatCard label="Proof" value={proof.status} note={`${proof.publishable} publishable records`} />
          <StatCard label="Campaigns" value={campaigns.status} note={`${campaigns.total} drafts, ${campaigns.activated} activated`} />
          <StatCard label="Paid acquisition" value={paid.activation} note={`${paid.unmet} prerequisites unmet`} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Funnel readiness"
            value={acquisitionFunnel.status}
            note={`${acquisitionFunnel.audiences} audience classes · ${acquisitionFunnel.stages.length} stages · ${acquisitionFunnel.blockers} blockers`}
          />
          <StatCard
            label="Campaign coverage"
            value={`${campaigns.total} drafts`}
            note={`${campaigns.missingTracks.length} tracks and ${campaigns.missingSegments.length} audience segments missing`}
          />
        </div>

        <SectionTitle>Launch conversion readiness</SectionTitle>
        <div className="rounded-lg border border-border bg-card p-4 text-sm" data-testid="launch-conversion-readiness">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={tone(launch.internalState)}>INTERNAL {launch.internalState}</Badge>
            <Badge variant="destructive">EXTERNAL {launch.externalState}</Badge>
            <span className="text-muted-foreground">
              {launch.audit.ready}/{launch.audit.total} URLs conversion-ready · {launch.audit.brokenCtaCount} broken CTAs ·{" "}
              {launch.indexableUrlCount} indexable URLs
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Read-only. Nothing here publishes, deploys, sends, or changes the Owner-controlled release gates.
          </p>
          {(["INTERNAL", "EXTERNAL"] as const).map(scope => (
            <div key={scope} className="mt-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {scope === "INTERNAL" ? "Ready internal" : "Blocked external"}
              </p>
              <ul className="mt-1 space-y-2">
                {launch.lines
                  .filter(l => l.scope === scope)
                  .map(l => (
                    <li key={l.id} className="flex flex-wrap items-center gap-2 border-t border-border pt-2 first:border-0 first:pt-0">
                      <Badge variant={tone(l.state)}>{l.state}</Badge>
                      <span className="font-medium">{l.label}</span>
                      <span className="ml-auto text-xs tabular-nums text-muted-foreground">{l.value}</span>
                      <p className="w-full text-xs text-muted-foreground">{l.detail}</p>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>

        <SectionTitle>Brand operating system</SectionTitle>
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={tone(brand.status)}>{brand.status}</Badge>
            <span className="text-muted-foreground">
              {brand.pillars} pillars · {brand.audiences} audiences · {brand.ctaRungs} CTA rungs
            </span>
          </div>
          {brand.findings.length === 0 ? (
            <p className="mt-2 text-muted-foreground">No voice, claim, or trust-rule violations in governed copy.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {brand.findings.map((f, i) => (
                <li key={`${f.id}-${i}`} className="text-muted-foreground">
                  <Badge variant={f.severity === "BLOCKER" ? "destructive" : "secondary"} className="mr-2">
                    {f.severity}
                  </Badge>
                  <span className="mr-2 font-medium">{f.id}</span>
                  {f.reason}
                </li>
              ))}
            </ul>
          )}
        </div>

        <SectionTitle>Proof and review operations</SectionTitle>
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="text-muted-foreground">{proof.detail}</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {proof.categories.map(c => (
              <li key={c.category} className="flex items-center gap-2">
                <Badge variant={tone(c.status)}>{c.status}</Badge>
                <span>{c.label}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">{c.publishable}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">Next operator actions</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {proof.nextOperatorActions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>

        <SectionTitle>90-day acquisition cadence</SectionTitle>
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <div className="flex flex-wrap gap-4 text-muted-foreground">
            <span>{cadence.items.length} planned items</span>
            <span>{cadence.weeks} weeks</span>
            <span>{cadence.sphereTouches.length} sphere touches</span>
            <span>
              {cadence.startDate} → {cadence.endDate}
            </span>
          </div>
          <ul className="mt-3 grid gap-1 sm:grid-cols-2">
            {(Object.entries(WEEKLY_QUOTA) as [keyof typeof WEEKLY_QUOTA, number][]).map(([kind, quota]) => (
              <li key={kind} className="flex items-center gap-2">
                <span>{CADENCE_KIND_LABEL[kind]}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">{quota}/week</span>
              </li>
            ))}
          </ul>
          {cadence.violations.length > 0 ? (
            <ul className="mt-3 list-disc pl-5 text-destructive">
              {cadence.violations.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-muted-foreground">Weekly quotas met; sphere touches respect the two-week minimum gap.</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Every item is a DRAFT. Nothing is scheduled or published from here.</p>
        </div>

        <SectionTitle>Acquisition funnel map</SectionTitle>
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={funnel.status === "MAPPED" ? "default" : "destructive"}>{funnel.status}</Badge>
            <span className="text-muted-foreground">{funnel.detail}</span>
          </div>
          <ol className="mt-3 space-y-2">
            {funnel.stages.map((s, i) => (
              <li key={s.id} className="border-t border-border pt-2 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular-nums text-muted-foreground">{i + 1}.</span>
                  <span className="font-medium">{s.label}</span>
                  <Badge variant="secondary">{s.ctaLabel}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">{s.owner}</span>
                </div>
                <p className="text-muted-foreground">{s.visitorIntent}</p>
                <p className="text-xs text-muted-foreground">
                  Advance: {s.advanceCriteria} · Measurement: {s.measurement}
                </p>
              </li>
            ))}
          </ol>
          {funnel.leaks.length > 0 ? (
            <ul className="mt-3 list-disc pl-5 text-muted-foreground">
              {funnel.leaks.map((l, i) => (
                <li key={i}>
                  <Badge variant={l.severity === "BLOCKER" ? "destructive" : "secondary"} className="mr-2">
                    {l.severity}
                  </Badge>
                  {l.stageId}: {l.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <SectionTitle>Acquisition funnel readiness (source → client → referral loop)</SectionTitle>
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={acquisitionFunnel.status === "READY" ? "default" : "destructive"}>{acquisitionFunnel.status}</Badge>
            <span className="text-muted-foreground">{acquisitionFunnel.detail}</span>
          </div>
          <ul className="mt-3 space-y-2">
            {acquisitionFunnel.paths.map(p => (
              <li key={p.audience} className="border-t border-border pt-2 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.label}</span>
                  <Badge variant="secondary">{p.pipelineLabel}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.source} → {p.canonicalPage} → {p.guideOrAssessment} → {p.leadCapture} → score → {p.crmSituation} → {p.consultation} → client → {p.reviewReferralPath}
                </p>
                <p className="text-xs text-muted-foreground">{p.reviewReferralLoop}</p>
              </li>
            ))}
          </ul>
          {acquisitionFunnel.findings.length > 0 ? (
            <ul className="mt-3 list-disc pl-5 text-muted-foreground">
              {acquisitionFunnel.findings.map((f, i) => (
                <li key={i}>
                  <Badge variant={f.severity === "BLOCKER" ? "destructive" : "secondary"} className="mr-2">
                    {f.severity}
                  </Badge>
                  {f.audience} · {f.stage}: {f.reason}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            Structural map only — no contact data, no PII, no external write, nothing activated.
          </p>
        </div>

        <SectionTitle>Measurement</SectionTitle>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            {measurement.measured} of {measurement.readings.length} metrics are measured. Unavailable sources are reported as such and
            never rendered as zero.
          </p>
          <ul className="mt-2">
            {measurement.readings.map(r => (
              <li key={r.id}>
                <MetricRow reading={r} />
              </li>
            ))}
          </ul>
        </div>

        <SectionTitle>90-day planning targets (Task 36)</SectionTitle>
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="text-muted-foreground">
            {TARGET_LABEL} only — never presented as results, forecasts, or benchmarks. {RECALIBRATION_RULE}
          </p>
          <ul className="mt-2">
            {comparisons.map(c => (
              <li key={c.metricId} className="flex flex-wrap items-center gap-2 border-t border-border py-2 first:border-0">
                <Badge variant={tone(c.status)}>{c.status === "TRACKING" ? "TRACKING" : "TARGET"}</Badge>
                <span>{c.label}</span>
                <span className="ml-auto tabular-nums">
                  {typeof c.actual === "number" ? `${c.actual} / ` : ""}
                  {c.display}
                </span>
                <p className="w-full text-xs text-muted-foreground">{c.note}</p>
              </li>
            ))}
          </ul>
        </div>

        <SectionTitle>Campaign drafts</SectionTitle>
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="text-muted-foreground">{campaigns.detail}</p>
          <ul className="mt-2">
            {CAMPAIGN_ASSETS.map(a => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 border-t border-border py-2 first:border-0">
                <Badge variant="secondary">{a.status}</Badge>
                <span className="font-medium">{a.subject ?? a.id}</span>
                <span className="text-muted-foreground">
                  {a.phase} · {a.track} · day {a.dayOffset} · {a.channel} · {a.audience}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">NOT ACTIVATED</span>
              </li>
            ))}
          </ul>
        </div>

        <SectionTitle>Paid acquisition readiness</SectionTitle>
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="destructive">ACTIVATION {paid.activation}</Badge>
            <span className="text-muted-foreground">{paid.detail}</span>
          </div>
          <ul className="mt-3 space-y-2">
            {PAID_BLUEPRINTS.map(b => (
              <li key={b.platform} className="border-t border-border pt-2 first:border-0 first:pt-0">
                <div className="font-medium">{b.label}</div>
                <p className="text-muted-foreground">{b.intent}</p>
                <p className="text-xs text-muted-foreground">{b.audienceBasis}</p>
                <p className="text-xs text-muted-foreground">{b.housingCompliance}</p>
                <p className="text-xs text-muted-foreground">{b.measurement}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">Guardrails</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {PAID_GUARDRAILS.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
          <ul className="mt-3 space-y-1">
            {paid.prerequisites.map(p => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <Badge variant="destructive">UNMET</Badge>
                <span>{p.label}</span>
                <span className="text-xs text-muted-foreground">{p.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </PageBody>
    </>
  );
}
