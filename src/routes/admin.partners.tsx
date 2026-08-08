// Task 26 — Referral partner dashboard (operator only).
//
// Read-only over the partner store, plus explicit operator actions: ingest a
// research cohort, review a record, and hand reviewed records to HubSpot.
// Outreach stays in draft here — nothing is sent from this screen.

import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageBody } from "@/components/page-header";
import { KpiCard, SectionTitle } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RequirePermission } from "@/components/require-permission";
import { buildReferralDashboard, type ReferralDashboard } from "@/lib/partners/dashboard";
import { buildResearchCohortFixture, ingestApolloBatch } from "@/lib/partners/apollo";
import { handoffReviewedPartners, type BatchHandoffSummary } from "@/lib/partners/handoff";
import { renderSequence } from "@/lib/partners/sequences";
import { buildLinkedInDraft, LINKEDIN_RULES } from "@/lib/partners/linkedin";
import { loadPartners, markReviewed } from "@/lib/partners/store";
import { partnerType, type Partner } from "@/lib/partners/schema";

export const Route = createFileRoute("/admin/partners")({
  head: () => ({
    meta: [
      { title: "Referral Partners — Legacy Platform" },
      {
        name: "description",
        content: "Referral-partner network growth, relationship stages, and outreach readiness.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequirePermission permission="integration.manage" label="Referral partners">
      <PartnersDashboard />
    </RequirePermission>
  ),
});

function PartnersDashboard() {
  const [dash, setDash] = useState<ReferralDashboard | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selected, setSelected] = useState<Partner | null>(null);
  const [handoff, setHandoff] = useState<BatchHandoffSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    const rows = loadPartners();
    setPartners(rows);
    setDash(buildReferralDashboard(rows));
  }, []);

  useEffect(refresh, [refresh]);

  function ingestFixture() {
    setBusy(true);
    try {
      ingestApolloBatch(buildResearchCohortFixture());
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function runHandoff() {
    setBusy(true);
    try {
      setHandoff(await handoffReviewedPartners(loadPartners()));
      refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!dash) return null;
  const seq = selected ? renderSequence(selected) : null;
  const li = selected ? buildLinkedInDraft(selected) : null;

  return (
    <>
      <PageHeader
        title="Referral Partners"
        description="Apollo research, relationship stages, and referral performance. Outreach is draft-only."
      />

      <PageBody>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Partners" value={dash.totalPartners} hint={`${dash.reachable} reachable`} />
          <KpiCard
            label="Cohort coverage"
            value={`${dash.cohort.actual}/${dash.cohort.target}`}
            hint={dash.cohort.complete ? "Complete" : "In research"}
          />
          <KpiCard
            label="Reviewed for outreach"
            value={`${dash.outreach.reviewed}/${dash.outreach.reviewThreshold}`}
            hint={dash.outreach.canRunSequences ? "Threshold met" : "Sequences held in draft"}
          />
          <KpiCard
            label="Referrals received"
            value={dash.referralsReceived}
            hint={`${dash.handedOff} synced to CRM`}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={ingestFixture} disabled={busy}>
            Ingest research cohort
          </Button>
          <Button variant="outline" onClick={runHandoff} disabled={busy}>
            Hand reviewed partners to CRM
          </Button>
          {handoff && (
            <span className="self-center text-xs text-muted-foreground">
              {handoff.attempted} attempted · {handoff.created} created · {handoff.updated} updated ·{" "}
              {handoff.skipped} skipped · {handoff.failed} failed
            </span>
          )}
        </div>

        <SectionTitle hint={dash.outreach.note}>Outreach readiness</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-4">
          <KpiCard label="Approved" value={dash.outreach.approved} />
          <KpiCard label="Pending review" value={dash.outreach.pendingReview} />
          <KpiCard label="Suppressed" value={dash.outreach.suppressed} />
          <KpiCard label="Daily cap" value={dash.outreach.dailyCap} hint="Manual send only" />
        </div>

        <SectionTitle>Cohort coverage</SectionTitle>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Segment</th>
                <th className="p-3">Target</th>
                <th className="p-3">Actual</th>
                <th className="p-3">Priority A</th>
                <th className="p-3">Reachable</th>
              </tr>
            </thead>
            <tbody>
              {dash.cohort.rows.map(r => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3">{r.label}</td>
                  <td className="p-3">{r.target}</td>
                  <td className="p-3">
                    {r.actual}{" "}
                    <Badge variant={r.complete ? "default" : "outline"}>
                      {r.complete ? "complete" : "open"}
                    </Badge>
                  </td>
                  <td className="p-3">{r.priorityA}</td>
                  <td className="p-3">{r.reachable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <SectionTitle>Relationship pipeline</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {dash.stages.map(s => (
            <KpiCard key={s.stage} label={s.stage} value={s.count} />
          ))}
        </div>

        <SectionTitle hint="Conversion is measured on real stage transitions only.">
          Conversion
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard label="Contact rate" value={`${dash.conversion.contactRate}%`} />
          <KpiCard label="Engagement rate" value={`${dash.conversion.engagementRate}%`} />
          <KpiCard label="Referral rate" value={`${dash.conversion.referralRate}%`} hint={dash.revenue.note} />
        </div>

        <SectionTitle>Partners</SectionTitle>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">City</th>
                <th className="p-3">Tier</th>
                <th className="p-3">Stage</th>
                <th className="p-3">Review</th>
              </tr>
            </thead>
            <tbody>
              {partners.slice(0, 50).map(p => (
                <tr key={p.id} className="border-t border-border">
                  <td className="p-3">
                    <button className="underline" onClick={() => setSelected(p)}>
                      {p.contactName}
                    </button>
                    <div className="text-xs text-muted-foreground">{p.company}</div>
                  </td>
                  <td className="p-3">{partnerType(p.partnerTypeId)?.label ?? p.partnerTypeId}</td>
                  <td className="p-3">{p.city}</td>
                  <td className="p-3">
                    <Badge variant={p.referralFitTier === "Priority A" ? "default" : "outline"}>
                      {p.referralFitTier}
                    </Badge>
                  </td>
                  <td className="p-3">{p.relationshipStage}</td>
                  <td className="p-3">
                    <Button
                      size="sm"
                      variant={p.reviewed ? "ghost" : "outline"}
                      onClick={() => {
                        markReviewed(p.id, !p.reviewed);
                        refresh();
                      }}
                    >
                      {p.reviewed ? "Reviewed" : "Approve"}
                    </Button>
                  </td>
                </tr>
              ))}
              {partners.length === 0 && (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={6}>
                    No partners yet. Ingest the research cohort to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selected && seq && li && (
          <>
            <SectionTitle hint={seq.blockedReason ?? "Approved — still sent manually."}>
              Outreach draft — {selected.contactName} ({seq.state})
            </SectionTitle>
            <div className="space-y-3">
              {seq.touches.map(t => (
                <div key={t.step} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">Step {t.step}</Badge>
                    <Badge variant="outline">{t.channel}</Badge>
                    <span>Day {t.dayOffset}</span>
                    <Badge variant={t.state === "approved" ? "default" : "outline"}>{t.state}</Badge>
                  </div>
                  <div className="mt-2 font-medium text-heritage">{t.subject}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{t.intent}</p>
                  <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{t.body}</pre>
                </div>
              ))}
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="font-medium text-heritage">LinkedIn</div>
                <p className="mt-2 text-sm text-muted-foreground">{li.connectionNote}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {li.characterCount} characters · {li.withinLimit ? "within limit" : "too long"}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">{li.followUpMessage}</p>
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {LINKEDIN_RULES.map(r => (
                    <li key={r}>· {r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}

        <SectionTitle>Recent partner activity</SectionTitle>
        <ul className="space-y-2">
          {dash.activity.map(a => (
            <li key={a.id} className="rounded border border-border bg-card p-3 text-xs">
              <span className="text-muted-foreground">{new Date(a.at).toLocaleString()}</span> ·{" "}
              <Badge variant="outline">{a.kind}</Badge> {a.detail}
            </li>
          ))}
          {dash.activity.length === 0 && (
            <li className="text-sm text-muted-foreground">No activity recorded yet.</li>
          )}
        </ul>
      </PageBody>
    </>
  );
}
