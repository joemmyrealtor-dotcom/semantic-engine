import { indexablePaths } from "@/lib/marketing/intent-map";
import { buildConversionAudit } from "@/lib/marketing/conversion-audit";
import { buildLaunchConversionReadiness } from "@/lib/marketing/launch-conversion-readiness";
import { buildCampaignReadiness } from "@/lib/marketing/acquisition-campaigns";
import { buildPaidReadiness } from "@/lib/marketing/paid-readiness";

console.log("indexablePaths.length:", indexablePaths().length);
const audit = buildConversionAudit();
console.log("conversionAudit:", JSON.stringify({
  total: audit.total,
  ready: audit.ready,
  review: audit.review,
  blocked: audit.blocked,
  brokenCtaCount: audit.brokenCtaCount,
  orphanCount: audit.orphanCount,
  highIntentPages: audit.highIntentPages,
  highIntentWithTalk: audit.highIntentWithTalk,
  mobileCtaPaths: audit.mobileCtaPaths?.length ?? null,
}));
const readiness = buildLaunchConversionReadiness();
console.log("launchReadiness:", JSON.stringify({
  internalState: readiness.internalState,
  externalState: readiness.externalState,
}));
const campaign = buildCampaignReadiness();
console.log("campaignActivated:", campaign.activated, "of", campaign.total, "status:", campaign.status);
const paid = buildPaidReadiness();
console.log("paidActivationState:", JSON.stringify({ activation: paid.activation, unmet: paid.unmet, status: paid.status }));
