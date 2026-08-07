import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/marketing/lead-capture.functions", () => ({
  submitCrmLead: vi.fn(async () => ({ ok: true, mode: "test", action: "queued" })),
}));

import {
  captureAttribution,
  readAttribution,
  readLatestAttribution,
  resetAttribution,
} from "@/lib/marketing/attribution";
import { resetEvents, recentEvents, trackEvent, scrubValue } from "@/lib/marketing/analytics";
import { setConsent, resetConsent } from "@/lib/marketing/consent";
import { captureLead, leadFormSchema, queuedLeads } from "@/lib/marketing/lead-capture";
import {
  applyResult,
  backoffMs,
  clearQueue,
  deliveryStats,
  flushQueue,
  idempotencyKeyFor,
  loadQueue,
  MAX_ATTEMPTS,
  retryDelivery,
  type LeadDelivery,
  type Transport,
} from "@/lib/marketing/lead-queue";
import {
  computeConversionMetrics,
  loadConversionEvents,
  clearConversionEvents,
} from "@/lib/marketing/conversion-store";
import { CRM_CONTACT_PROPERTIES, PII_PROPERTY_NAMES, shouldCreateDeal } from "@/lib/marketing/crm-schema";

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

/** Transport doubles. */
const ok = (extra: Record<string, unknown> = {}): Transport =>
  vi.fn(async () => ({ ok: true, mode: "hubspot" as const, action: "created" as const, contactId: "C-1", ...extra }));
const transient: Transport = vi.fn(async () => ({
  ok: false,
  mode: "hubspot" as const,
  action: "queued" as const,
  retryable: true,
  status: 503,
  message: "HubSpot unavailable",
}));
const permanent: Transport = vi.fn(async () => ({
  ok: false,
  mode: "hubspot" as const,
  action: "queued" as const,
  retryable: false,
  status: 400,
  message: "Invalid property",
}));

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  resetAttribution();
  resetEvents();
  resetConsent();
  clearConversionEvents();
  clearQueue();
  window.dataLayer = [];
});

describe("attribution integrity", () => {
  it("keeps first touch and updates latest touch", () => {
    setLocation("?utm_source=google&utm_medium=cpc&utm_campaign=probate");
    captureAttribution();
    expect(readAttribution()?.campaign).toBe("probate");

    setLocation("?utm_source=newsletter&utm_medium=email&utm_campaign=fall");
    captureAttribution();
    expect(readAttribution()?.campaign).toBe("probate");
    expect(readLatestAttribution()?.campaign).toBe("fall");
  });

  it("maps the full journey onto CRM properties", async () => {
    setLocation("?utm_source=google&utm_medium=organic&utm_campaign=brea-guide");
    captureAttribution();
    setLocation("?utm_source=email&utm_medium=newsletter&utm_campaign=seller-guide");
    captureAttribution();

    const { payload } = await captureLead(
      {
        values: validValues,
        leadSource: "assessment",
        campaign: "seller-assessment",
        formId: "assessment:seller",
        assessmentId: "AS-001",
        readinessLevel: "Ready",
      },
      ok(),
    );

    expect(payload.lf_original_source).toBe("google");
    expect(payload.lf_original_medium).toBe("organic");
    expect(payload.lf_original_campaign).toBe("brea-guide");
    expect(payload.utm_campaign).toBe("seller-guide");
    expect(payload.lf_latest_landing_page).toBeTruthy();
    expect(payload.lf_landing_page).toBeTruthy();
    expect(payload.city).toBe("Irvine");
    expect(payload.lf_situation).toBe("sellers");
    expect(payload.lf_readiness_level).toBe("Ready");
    expect(payload.lf_consultation_requested).toBe(true);
    expect(payload.lf_timeline).toBe("0-90");
  });
});

describe("analytics hygiene", () => {
  it("dedupes view events and scrubs PII", () => {
    setConsent({ analytics: "granted" });
    expect(trackEvent("lead_magnet_viewed", { guideId: "G1" })).not.toBeNull();
    expect(trackEvent("lead_magnet_viewed", { guideId: "G1" })).toBeNull();
    expect(scrubValue("reach me at joe@example.com or 714-555-0100")).not.toMatch(/@example|555/);
  });

  it("never emits PII fields in analytics events", async () => {
    setConsent({ analytics: "granted" });
    await captureLead(
      { values: validValues, leadSource: "guide", campaign: "c", formId: "guide:g", guideId: "LM-001" },
      ok(),
    );
    const serialized = JSON.stringify(recentEvents());
    expect(serialized).not.toContain("joe@example.com");
    expect(serialized).not.toContain("1 Main St");
    for (const key of PII_PROPERTY_NAMES) expect(serialized).not.toContain(`"${key}"`);
  });

  it("does not forward to vendors without consent", () => {
    trackEvent("page_view", { label: "/home" });
    expect(window.dataLayer?.length ?? 0).toBe(0);
    expect(recentEvents()).toHaveLength(1);
  });
});

describe("lead capture and CRM mapping", () => {
  it("rejects invalid submissions", () => {
    expect(leadFormSchema.safeParse({ ...validValues, email: "nope", consent: false }).success).toBe(false);
  });

  it("maps only known CRM properties, with consent recorded", async () => {
    const { payload, score, delivery } = await captureLead(
      { values: validValues, leadSource: "guide", campaign: "seller-decision", formId: "guide:sd", guideId: "LM-001", guideSlug: "seller-decision" },
      ok(),
    );
    const known = new Set(CRM_CONTACT_PROPERTIES.map(p => p.name));
    for (const key of Object.keys(payload)) expect(known.has(key)).toBe(true);

    expect(payload.lf_consent).toBe(true);
    expect(payload.lf_consent_at).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(payload.lf_consent_text.length).toBeGreaterThan(20);
    expect(payload.lf_lead_classification).toBe(score.classification);
    expect(payload.lf_lead_signals).toContain("Timeline");
    expect(delivery.status).toBe("delivered");
    expect(delivery.hubspotContactId).toBe("C-1");
    expect(queuedLeads()).toHaveLength(1);
  });

  it("promotes only qualified intent to a deal", () => {
    expect(shouldCreateDeal({ classification: "Nurture", consultationRequested: false, timeline: "researching" })).toBe(false);
    expect(shouldCreateDeal({ classification: "Nurture", consultationRequested: true, timeline: "researching" })).toBe(true);
    expect(shouldCreateDeal({ classification: "Hot", consultationRequested: false, timeline: "3-6" })).toBe(true);
  });
});

describe("deduplication", () => {
  const capture = (over: Record<string, unknown>, t: Transport) =>
    captureLead(
      { values: validValues, leadSource: "guide", campaign: "c", formId: "guide:a", ...over } as never,
      t,
    );

  it("same email + same guide is one delivery", async () => {
    const t = ok();
    await capture({ guideId: "LM-001" }, t);
    const second = await capture({ guideId: "LM-001" }, t);
    expect(second.duplicate).toBe(true);
    expect(loadQueue()).toHaveLength(1);
    expect(t).toHaveBeenCalledTimes(1);
  });

  it("same email + different guide is a contact update, not a new contact", async () => {
    const t = ok();
    await capture({ guideId: "LM-001", formId: "guide:a" }, t);
    await capture({ guideId: "LM-002", formId: "guide:b" }, t);
    const q = loadQueue();
    expect(q).toHaveLength(2);
    expect(new Set(q.map(r => r.payload.email)).size).toBe(1);
    expect(new Set(q.map(r => r.idempotencyKey)).size).toBe(2);
  });

  it("assessment plus guide, returning campaign, and repeat device submissions stay unique", async () => {
    const t = ok();
    await capture({ guideId: "LM-001", formId: "guide:a" }, t);
    await capture({ assessmentId: "AS-001", formId: "assessment:seller" }, t);
    setLocation("?utm_source=facebook&utm_medium=social&utm_campaign=retarget");
    captureAttribution();
    await capture({ guideId: "LM-001", formId: "guide:a" }, t); // repeat submit
    expect(loadQueue()).toHaveLength(2);
    expect(deliveryStats().delivered).toBe(2);
  });

  it("derives a stable idempotency key", () => {
    expect(idempotencyKeyFor({ email: "A@B.com ", formId: "f", guideId: "g" })).toBe(
      idempotencyKeyFor({ email: "a@b.com", formId: "f", guideId: "g" }),
    );
  });
});

describe("queue reliability", () => {
  it("backs off exponentially with a ceiling", () => {
    expect(backoffMs(1)).toBe(5000);
    expect(backoffMs(2)).toBe(10000);
    expect(backoffMs(20)).toBe(900000);
  });

  it("schedules a retry after a transient failure and recovers", async () => {
    const { delivery } = await captureLead(
      { values: validValues, leadSource: "guide", campaign: "c", formId: "guide:a", guideId: "LM-001" },
      transient,
    );
    expect(delivery.status).toBe("retry_scheduled");
    expect(delivery.nextAttemptAt).toBeTruthy();
    expect(delivery.error).toContain("HubSpot unavailable");

    // Not due yet.
    expect(await flushQueue(ok(), Date.now())).toHaveLength(0);

    // Due later — recovers and records the CRM id.
    const [recovered] = await flushQueue(ok(), Date.now() + 60_000);
    expect(recovered?.status).toBe("delivered");
    expect(recovered?.hubspotContactId).toBe("C-1");
    expect(deliveryStats().failed).toBe(0);
  });

  it("stops after MAX_ATTEMPTS and supports operator retry", async () => {
    await captureLead(
      { values: validValues, leadSource: "guide", campaign: "c", formId: "guide:a", guideId: "LM-001" },
      transient,
    );
    for (let i = 0; i < MAX_ATTEMPTS; i++) await flushQueue(transient, Date.now() + 3_600_000 * (i + 1));
    const dead = loadQueue()[0] as LeadDelivery;
    expect(dead.status).toBe("permanently_failed");
    expect(dead.attempts).toBe(MAX_ATTEMPTS);

    const revived = await retryDelivery(dead.id, ok());
    expect(revived?.status).toBe("delivered");
  });

  it("does not retry permanent rejections", async () => {
    const { delivery } = await captureLead(
      { values: validValues, leadSource: "guide", campaign: "c", formId: "guide:a", guideId: "LM-001" },
      permanent,
    );
    expect(delivery.status).toBe("permanently_failed");
    expect(delivery.attempts).toBe(1);
  });

  it("applyResult is pure and idempotent in shape", () => {
    const base = {
      id: "x", idempotencyKey: "k", payload: {} as never, pipeline: "seller", formId: "f",
      status: "pending" as const, attempts: 0, createdAt: "", updatedAt: "",
    };
    const next = applyResult(base, { ok: true, mode: "hubspot", action: "updated", contactId: "C-9" });
    expect(next.status).toBe("delivered");
    expect(base.attempts).toBe(0);
  });
});

describe("conversion dashboard", () => {
  it("aggregates the funnel by city and situation", async () => {
    trackEvent("page_view", { label: "/guides", city: "Irvine", situation: "sellers" });
    await captureLead(
      { values: validValues, leadSource: "guide", campaign: "c", formId: "guide:a", guideId: "LM-001" },
      ok(),
    );
    const metrics = computeConversionMetrics(loadConversionEvents());
    expect(metrics.byCity.find(r => r.key === "Irvine")?.conversions).toBe(1);
    expect(metrics.hotLeads + metrics.qualifiedLeads).toBeGreaterThan(0);
  });
});
