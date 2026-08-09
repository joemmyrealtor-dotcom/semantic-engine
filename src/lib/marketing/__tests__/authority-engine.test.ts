import { describe, expect, it } from "vitest";
import { ANSWERS, getAnswer, metaTitleFor, metaDescriptionFor, localAnglesFor } from "@/lib/marketing/answers";
import { assetsFor, CHANNEL_LIMITS, CHANNELS } from "@/lib/marketing/distribution";
import { buildContentPlan, PLAN_DAYS } from "@/lib/marketing/content-calendar";
import { indexablePaths } from "@/lib/marketing/indexation";
import { sitemapEntries } from "@/routes/sitemap[.]xml";

describe("answer bank", () => {
  it("derives the sixty seller and buyer questions", () => {
    expect(ANSWERS.length).toBe(60);
    expect(ANSWERS.filter(a => a.audience === "seller")).toHaveLength(30);
    expect(ANSWERS.filter(a => a.audience === "buyer")).toHaveLength(30);
  });

  it("gives every answer a unique slug and a non-empty short answer", () => {
    const slugs = new Set(ANSWERS.map(a => a.slug));
    expect(slugs.size).toBe(ANSWERS.length);
    for (const a of ANSWERS) {
      expect(a.question.length).toBeGreaterThan(8);
      expect(a.shortAnswer.length).toBeGreaterThan(40);
      expect(getAnswer(a.slug)).toBe(a);
    }
  });

  it("keeps meta title and description within search limits", () => {
    for (const a of ANSWERS) {
      expect(metaTitleFor(a).length).toBeLessThanOrEqual(60);
      expect(metaDescriptionFor(a).length).toBeLessThanOrEqual(155);
    }
  });

  it("rotates local angles instead of repeating one city", () => {
    const first = ANSWERS.map(a => localAnglesFor(a)[0]!.slug);
    expect(new Set(first).size).toBeGreaterThan(4);
  });
});

describe("distribution assets", () => {
  it("produces one draft per channel within channel limits", () => {
    for (const a of ANSWERS) {
      const assets = assetsFor(a);
      expect(assets.map(x => x.channel)).toEqual(CHANNELS);
      for (const asset of assets) {
        expect(asset.status).toBe("Draft");
        expect(asset.body.length).toBeLessThanOrEqual(CHANNEL_LIMITS[asset.channel]);
        expect(asset.tags.length).toBeLessThanOrEqual(3);
        expect(asset.url).toContain(`/answers/${a.slug}`);
      }
    }
  });
});

describe("90-day content plan", () => {
  const plan = buildContentPlan("2026-09-07");

  it("is deterministic", () => {
    expect(buildContentPlan("2026-09-07")).toEqual(plan);
  });

  it("covers ninety days and every channel", () => {
    expect(plan.startDate).toBe("2026-09-07");
    expect(plan.endDate).toBe("2026-12-05");
    expect(plan.slots.length).toBeGreaterThan(100);
    for (const channel of CHANNELS) expect(plan.coverage.byChannel[channel]).toBeGreaterThan(0);
    const days = new Set(plan.slots.map(s => s.date));
    expect(days.size).toBeLessThanOrEqual(PLAN_DAYS);
  });

  it("schedules every slot as a draft with a real internal path", () => {
    const paths = new Set([...indexablePaths(), ...ANSWERS.map(a => `/answers/${a.slug}`)]);
    for (const slot of plan.slots) {
      expect(slot.status).toBe("Draft");
      expect(paths.has(slot.path)).toBe(true);
    }
  });

  it("cycles the whole answer bank, all cities, guides and assessments", () => {
    expect(plan.coverage.answersScheduled).toBeGreaterThanOrEqual(30);
    expect(plan.coverage.citiesScheduled).toBeGreaterThan(0);
    expect(plan.coverage.guidesScheduled).toBeGreaterThan(0);
    expect(plan.coverage.assessmentsScheduled).toBeGreaterThan(0);
  });
});

describe("indexation", () => {
  it("lists the answer hub and every answer page in the sitemap", () => {
    const paths = sitemapEntries().map(e => e.path);
    expect(paths).toContain("/answers");
    for (const a of ANSWERS) expect(paths).toContain(`/answers/${a.slug}`);
    expect(paths).not.toContain("/");
  });
});
