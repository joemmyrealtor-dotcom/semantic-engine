import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/marketing/lead-capture.functions", () => ({
  submitCrmLead: vi.fn(async () => ({ ok: true, mode: "test", action: "queued" })),
}));

import { captureAttribution, readAttribution, readLatestAttribution, resetAttribution } from "@/lib/marketing/attribution";
import { resetEvents, recentEvents, trackEvent, scrubValue } from "@/lib/marketing/analytics";
import { setConsent, resetConsent } from "@/lib/marketing/consent";
import { captureLead, leadFormSchema, queuedLeads } from "@/lib/marketing/lead-capture";
import { computeConversionMetrics, loadConversionEvents, clearConversionEvents } from "@/lib/marketing/conversion-store";
import { CRM_CONTACT_PROPERTIES } from "@/lib/marketing/crm-schema";

function setLocation(search: string, referrer = "") {
  window.history.replaceState({}, "", `/guides/seller-decision${search}`);
  Object.defineProperty(document, "referrer", { value: referrer, configurable: true });
}

const validValues = {
  firstName: "Joe",
  email: "joe@example.com",
  phone: "714-555-0100",
  city: "Irvine",
  situation: "sellers",
  timeline: "0-90",
  propertyAddress: "1 Main St, Irvine",
  motivation: "Relocating for a job",
  consultationRequested: true,
  consent: true as const,
};

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  resetAttribution();
  resetEvents();
  resetConsent();
  clearConversionEvents();
  window.dataLayer = [];
});

describe("attribution", () => {
  it("keeps first touch and updates latest touch", () => {
    setLocation("?utm_source=google&utm_medium=cpc&utm_campaign=probate");
    captureAttribution();
    expect(readAttribution()?.campaign).toBe("probate");

    setLocation("?utm_source=newsletter&utm_medium=email&utm_campaign=fall");
    captureAttribution();
    expect(readAttribution()?.campaign).toBe("probate");
    expect(readLatestAttribution()?.campaign).toBe("fall");
  });
});

describe("analytics", () => {
  it("dedupes view events and scrubs PII", () => {
    setConsent({ analytics: "granted" });
    expect(trackEvent("lead_magnet_viewed", { guideId: "G1" })).not.toBeNull();
    expect(trackEvent("lead_magnet_viewed", { guideId: "G1" })).toBeNull();
    expect(scrubValue("reach me at joe@example.com or 714-555-0100")).not.toMatch(/@example|555/);
  });

  it("does not forward to vendors without consent", () => {
    trackEvent("page_view", { label: "/home" });
    expect(window.dataLayer?.length ?? 0).toBe(0);
    expect(recentEvents()).toHaveLength(1);
  });
});

describe("lead capture", () => {
  it("rejects invalid submissions", () => {
    const bad = leadFormSchema.safeParse({ ...validValues, email: "nope", consent: false });
    expect(bad.success).toBe(false);
  });

  it("builds a HubSpot payload with attribution, score, and consent", async () => {
    setLocation("?utm_source=google&utm_medium=organic&utm_campaign=probate-oc");
    captureAttribution();

    const outcome = await captureLead({
      values: validValues,
      leadSource: "guide",
      campaign: "seller-decision",
      formId: "guide:seller-decision",
      guideId: "LM-001",
      guideSlug: "seller-decision",
    });

    const known = new Set(CRM_CONTACT_PROPERTIES.map(p => p.name));
    for (const key of Object.keys(outcome.payload)) expect(known.has(key)).toBe(true);

    expect(outcome.payload.utm_campaign).toBe("probate-oc");
    expect(outcome.payload.lf_consent).toBe(true);
    expect(outcome.payload.lf_consent_at).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(outcome.score.points).toBeGreaterThan(40);
    expect(["Hot", "Qualified"]).toContain(outcome.score.classification);
    expect(outcome.result.ok).toBe(true);
    expect(queuedLeads()).toHaveLength(1);
  });

  it("feeds the conversion dashboard", async () => {
    trackEvent("page_view", { label: "/guides", city: "Irvine", situation: "sellers" });
    await captureLead({
      values: validValues,
      leadSource: "guide",
      campaign: "seller-decision",
      formId: "guide:seller-decision",
      guideId: "LM-001",
    });
    const metrics = computeConversionMetrics(loadConversionEvents());
    expect(metrics.byCity.find(r => r.key === "Irvine")?.conversions).toBe(1);
    expect(metrics.hotLeads + metrics.qualifiedLeads).toBeGreaterThan(0);
  });
});
