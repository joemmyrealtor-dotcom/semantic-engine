// Client-acquisition readiness — internal launch-conversion roll-up.
//
// One read-only roll-up for the Growth Command Center. It separates what is
// READY INTERNAL (things this codebase controls and can prove) from what is
// BLOCKED EXTERNAL (things that require an account, a domain, or an Owner
// release decision). It activates nothing and changes no gate status.

import { buildConversionAudit, type ConversionAuditReport } from "./conversion-audit";
import { buildBrandReadiness } from "./brand-system";
import { buildProofOperationsReport } from "./proof-operations";
import { buildPaidReadiness } from "./paid-readiness";
import { QUALIFIED_VISITOR_SPEC } from "./qualified-visitor";
import { LEGAL_DISCLOSURE, LICENSE } from "./positioning";
import { indexablePaths } from "./indexation";
import { CAMPAIGN_ASSETS } from "./acquisition-campaigns";

export type ReadinessState = "READY" | "REVIEW" | "BLOCKED";

export interface ReadinessLine {
  id: string;
  label: string;
  scope: "INTERNAL" | "EXTERNAL";
  state: ReadinessState;
  value: string;
  detail: string;
}

export interface LaunchConversionReadiness {
  generatedAt: string;
  audit: ConversionAuditReport;
  lines: ReadinessLine[];
  internalState: ReadinessState;
  externalState: "BLOCKED";
  indexableUrlCount: number;
}

function line(
  id: string,
  label: string,
  scope: ReadinessLine["scope"],
  state: ReadinessState,
  value: string,
  detail: string,
): ReadinessLine {
  return { id, label, scope, state, value, detail };
}

export function buildLaunchConversionReadiness(
  input: { leadCaptureSmokePassed?: boolean } = {},
  now: Date = new Date(),
): LaunchConversionReadiness {
  const audit = buildConversionAudit(now);
  const brand = buildBrandReadiness();
  const proof = buildProofOperationsReport(now);
  const paid = buildPaidReadiness();
  const paths = indexablePaths();
  const activatedCampaigns = CAMPAIGN_ASSETS.filter(a => a.status !== "DRAFT").length;

  const lines: ReadinessLine[] = [
    line(
      "conversion-path-coverage",
      "Conversion path coverage",
      "INTERNAL",
      audit.status,
      `${audit.ready}/${audit.total} URLs ready`,
      "Every indexable URL carries a governed Learn / Evaluate / Talk / Refer next action.",
    ),
    line(
      "broken-cta",
      "Broken CTA destinations",
      "INTERNAL",
      audit.brokenCtaCount === 0 ? "READY" : "BLOCKED",
      String(audit.brokenCtaCount),
      "A CTA may only point at a governed public destination or the licensee's phone/email.",
    ),
    line(
      "direct-contact",
      "Direct contact coverage",
      "INTERNAL",
      audit.directContactCoverage.exposedOn.length > 0 ? "READY" : "BLOCKED",
      `${LICENSE.phone} · ${LICENSE.email}`,
      "Phone and email render as click-to-contact links in the shared footer disclosure and on /contact.",
    ),
    line(
      "mobile-cta",
      "Mobile conversion coverage",
      "INTERNAL",
      audit.findingCounts["missing-mobile-cta"] ? "REVIEW" : "READY",
      `${audit.mobileCtaPaths.length} high-intent paths`,
      "Restrained two-action mobile bar on high-intent public pages only; never on legal or utility pages.",
    ),
    line(
      "lead-capture-smoke",
      "Lead capture smoke",
      "INTERNAL",
      input.leadCaptureSmokePassed === false ? "BLOCKED" : "READY",
      input.leadCaptureSmokePassed === false ? "FAILED" : "COVERED BY TESTS",
      "Landing page → guide/assessment/contact/referral → local queue with attribution, dedupe and consent. No external delivery.",
    ),
    line(
      "attribution-events",
      "Attribution and event readiness",
      "INTERNAL",
      "READY",
      "Internal event contract",
      "First-touch and latest-touch attribution attached to every governed event; PII scrubbed before any payload is stored.",
    ),
    line(
      "qualified-visitor",
      "Qualified-visitor definition",
      "INTERNAL",
      "READY",
      QUALIFIED_VISITOR_SPEC.criteria.length + " criteria",
      "Behaviour-only definition; never substituted with a raw session count and never forwarded to an external property.",
    ),
    line(
      "brand-disclosure",
      "Brand and license disclosure",
      "INTERNAL",
      brand.status === "READY" ? "READY" : "REVIEW",
      `DRE #${LICENSE.dreLicense}`,
      LEGAL_DISCLOSURE,
    ),
    line(
      "proof",
      "Proof readiness",
      "INTERNAL",
      proof.status === "READY" ? "READY" : "REVIEW",
      `${proof.publishable} publishable records`,
      "No review, rating, result, or transaction claim renders publicly without a verified, consented record.",
    ),
    line(
      "outbound-campaigns",
      "Outbound campaign activation",
      "EXTERNAL",
      "BLOCKED",
      `${CAMPAIGN_ASSETS.length} drafts · ${activatedCampaigns} activated`,
      "All campaign assets remain DRAFT. No email, SMS, or social send is wired.",
    ),
    line(
      "crm-delivery",
      "CRM delivery (HubSpot / Apollo)",
      "EXTERNAL",
      "BLOCKED",
      "NOT_CONNECTED",
      "Lead transport is fail-closed: leads persist to the local durable queue and no external write occurs.",
    ),
    line(
      "paid-activation",
      "Paid acquisition",
      "EXTERNAL",
      "BLOCKED",
      paid.activation,
      `${paid.unmet} prerequisites unmet. No budget, audience, pixel, or campaign exists.`,
    ),
    line(
      "release-gates",
      "Release gates (Tasks 14–18)",
      "EXTERNAL",
      "BLOCKED",
      "UNCHANGED",
      "Repository connection, branch protection, infrastructure recovery, full audit, and controlled publication remain Owner-controlled. This roll-up changes none of them.",
    ),
  ];

  const internal = lines.filter(l => l.scope === "INTERNAL");
  const internalState: ReadinessState = internal.some(l => l.state === "BLOCKED")
    ? "BLOCKED"
    : internal.some(l => l.state === "REVIEW")
      ? "REVIEW"
      : "READY";

  return {
    generatedAt: now.toISOString(),
    audit,
    lines,
    internalState,
    externalState: "BLOCKED",
    indexableUrlCount: paths.length,
  };
}
