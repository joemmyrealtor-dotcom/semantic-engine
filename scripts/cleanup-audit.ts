import { indexablePaths } from "@/lib/marketing/intent-map";
import { buildConversionAudit } from "@/lib/marketing/conversion-audit";
import { buildLaunchConversionReadiness } from "@/lib/marketing/launch-conversion-readiness";
import { CAMPAIGN_ASSETS, paidActivationState } from "@/lib/marketing/acquisition-campaigns";

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
const activated = CAMPAIGN_ASSETS.filter(a => a.status === "activated").length;
console.log("campaignActivated:", activated, "of", CAMPAIGN_ASSETS.length);
console.log("paidActivationState:", JSON.stringify(paidActivationState()));
