import { describe, it, expect } from "vitest";
import {
  LOCAL_PAGES,
  LOCAL_HUBS,
  getLocalHub,
  getLocalPage,
  citiesForCluster,
  localPagePaths,
} from "../local-pages";
import { selectWaveOne } from "../demand";
import { indexablePaths, isIndexablePath } from "../indexation";
import { localMeasurementRegistry, LOCAL_METRICS } from "../measurement";

describe("local wave-one page set", () => {
  it("builds between 12 and 20 pages", () => {
    expect(LOCAL_PAGES.length).toBeGreaterThanOrEqual(12);
    expect(LOCAL_PAGES.length).toBeLessThanOrEqual(20);
  });

  it("gives every wave cluster a county hub parent", () => {
    const clusters = new Set(selectWaveOne().map(c => c.cluster));
    for (const cluster of clusters) {
      expect(getLocalHub(cluster), `hub missing for ${cluster}`).toBeTruthy();
    }
    expect(LOCAL_HUBS.every(h => h.geography === "orange-county")).toBe(true);
  });

  it("produces unique paths", () => {
    const paths = localPagePaths();
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("resolves city pages by cluster and city slug", () => {
    for (const page of LOCAL_PAGES.filter(p => p.level === "city")) {
      expect(getLocalPage(page.cluster, page.geography)?.path).toBe(page.path);
    }
    expect(getLocalPage("probate", "nowhere-city")).toBeUndefined();
  });

  it("keeps every required AEO section populated", () => {
    for (const p of LOCAL_PAGES) {
      expect(p.question.length).toBeGreaterThan(10);
      expect(p.directAnswer.length).toBeGreaterThan(120);
      expect(p.keyFactors.length).toBeGreaterThanOrEqual(4);
      expect(p.scenarios.length).toBeGreaterThanOrEqual(3);
      expect(p.decisionPath.length).toBeGreaterThanOrEqual(5);
      expect(p.costTiming.length).toBeGreaterThanOrEqual(2);
      expect(p.localConsiderations.length).toBeGreaterThanOrEqual(3);
      expect(p.paa.length).toBeGreaterThanOrEqual(3);
      expect(p.guideSlug).toBeTruthy();
      expect(p.assessmentSlug).toBeTruthy();
      expect(p.nextStep).toBeTruthy();
    }
  });

  it("names the place in the question and answer of every page", () => {
    for (const p of LOCAL_PAGES) {
      expect(`${p.question} ${p.directAnswer}`).toContain(p.place);
    }
  });

  it("keeps meta titles and descriptions within search limits", () => {
    for (const p of LOCAL_PAGES) {
      expect(p.metaTitle.length).toBeLessThanOrEqual(60);
      expect(p.metaDescription.length).toBeLessThanOrEqual(155);
    }
  });

  it("does not duplicate a question across two pages", () => {
    const questions = LOCAL_PAGES.map(p => p.question);
    expect(new Set(questions).size).toBe(questions.length);
  });

  it("limits each cluster to a hub plus at most three city pages", () => {
    for (const hub of LOCAL_HUBS) {
      expect(citiesForCluster(hub.cluster).length).toBeLessThanOrEqual(3);
    }
  });

  it("makes no market prediction or performance claim", () => {
    const banned = /\b(guarantee|guaranteed|best agent|#1|number one|will appreciate|market will)\b/i;
    for (const p of LOCAL_PAGES) {
      const body = [
        p.directAnswer,
        ...p.keyFactors,
        ...p.scenarios.map(s => s.body),
        ...p.decisionPath,
        ...p.costTiming,
        ...p.paa.map(f => f.a),
      ].join(" ");
      expect(banned.test(body), `claim language on ${p.path}`).toBe(false);
    }
  });
});

describe("local pages in the indexation boundary", () => {
  it("marks every local page indexable", () => {
    for (const path of localPagePaths()) {
      expect(isIndexablePath(path), `${path} not indexable`).toBe(true);
    }
    expect(isIndexablePath("/local")).toBe(true);
  });

  it("keeps the governed console out of the index", () => {
    expect(indexablePaths()).not.toContain("/");
  });
});

describe("measurement registry", () => {
  it("covers every published local page", () => {
    const registry = localMeasurementRegistry();
    expect(registry.length).toBe(LOCAL_PAGES.length);
    for (const plan of registry) {
      expect(plan.metrics.length).toBe(LOCAL_METRICS.length);
      expect(plan.reviewDays).toEqual([30, 60, 90]);
      expect(plan.keepCriteria.length).toBeGreaterThan(0);
      expect(plan.reviseTriggers.length).toBeGreaterThan(0);
    }
  });

  it("measures more than rankings", () => {
    const sources = new Set(LOCAL_METRICS.map(m => m.source));
    expect(sources.has("analytics-event")).toBe(true);
    expect(sources.has("lead-capture")).toBe(true);
    expect(sources.has("crm")).toBe(true);
  });
});
