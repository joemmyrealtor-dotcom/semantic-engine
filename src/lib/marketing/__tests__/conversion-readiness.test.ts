// Enforcement tests for the client-acquisition conversion readiness sprint.
//
// These lock the invariants that make the site able to produce real clients
// without over-promising: every indexable URL has a governed next action,
// no CTA points anywhere ungoverned, mobile conversion is restrained, the
// qualified-visitor definition stays behavioural, and nothing external is
// activated.

import { describe, it, expect } from "vitest";
import { indexableRecords } from "../intent-map";
import { indexablePaths } from "../indexation";
import {
  isHighIntent,
  isValidDestination,
  mobileBarActions,
  mobileConversionPaths,
  nextActionsFor,
  showsMobileConversionBar,
} from "../conversion-paths";
import { buildConversionAudit } from "../conversion-audit";
import {
  QUALIFIED_VISITOR_CRITERIA,
  QUALIFIED_VISITOR_EXCLUSIONS,
  QUALIFIED_VISITOR_SPEC,
  evaluateQualifiedVisitors,
} from "../qualified-visitor";
import { buildLaunchConversionReadiness } from "../launch-conversion-readiness";
import { buildLaunchSmokeRunbook } from "../launch-smoke";
import { CAMPAIGN_ASSETS } from "../acquisition-campaigns";

describe("conversion path coverage", () => {
  it("keeps the indexable inventory at exactly 126 URLs", () => {
    expect(indexablePaths().length).toBe(126);
  });

  it("gives every indexable URL at least one governed next action", () => {
    for (const record of indexableRecords()) {
      const actions = nextActionsFor(record);
      expect(actions.length, record.path).toBeGreaterThan(0);
      for (const action of actions) {
        expect(isValidDestination(action.to), `${record.path} -> ${action.to}`).toBe(true);
        expect(action.label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("gives every high-intent URL an evaluate and a talk action", () => {
    for (const record of indexableRecords().filter(isHighIntent)) {
      const kinds = nextActionsFor(record).map(a => a.kind);
      expect(kinds, record.path).toContain("evaluate");
      expect(kinds, record.path).toContain("talk");
    }
  });

  it("reports zero broken CTA destinations", () => {
    const audit = buildConversionAudit();
    expect(audit.brokenCtaCount).toBe(0);
    expect(audit.total).toBe(126);
  });

  it("uses specific CTA labels, never bare 'Learn more' or 'Click here'", () => {
    const vague = /^(learn more|click here|read more|submit|go)$/i;
    for (const record of indexableRecords()) {
      for (const action of nextActionsFor(record)) {
        expect(vague.test(action.label.trim()), `${record.path}: ${action.label}`).toBe(false);
      }
    }
  });
});

describe("mobile conversion restraint", () => {
  it("shows the mobile bar only on high-intent public paths", () => {
    const highIntent = new Set(indexableRecords().filter(isHighIntent).map(r => r.path));
    for (const path of mobileConversionPaths()) {
      expect(highIntent.has(path), path).toBe(true);
    }
  });

  it("never shows the mobile bar on legal, utility, or operator surfaces", () => {
    for (const path of ["/privacy", "/terms", "/accessibility", "/disclaimer", "/", "/admin/lead-delivery", "/refer"]) {
      expect(showsMobileConversionBar(path), path).toBe(false);
    }
  });

  it("offers exactly two governed actions in the mobile bar", () => {
    for (const path of mobileConversionPaths()) {
      const actions = mobileBarActions(path);
      expect(actions.length, path).toBe(2);
      for (const action of actions) expect(isValidDestination(action.to)).toBe(true);
    }
  });
});

describe("qualified-visitor definition", () => {
  it("is behavioural only and excludes PII and protected traits", () => {
    const text = JSON.stringify(QUALIFIED_VISITOR_SPEC).toLowerCase();
    for (const term of ["email", "phone", "name", "race", "religion", "familial", "disability", "national origin"]) {
      expect(QUALIFIED_VISITOR_EXCLUSIONS.join(" ").toLowerCase()).toBeTruthy();
      // The definition may name a trait only to exclude it.
      if (text.includes(term)) {
        expect(JSON.stringify(QUALIFIED_VISITOR_EXCLUSIONS).toLowerCase()).toContain(term.split(" ")[0]);
      }
    }
    expect(QUALIFIED_VISITOR_CRITERIA.length).toBeGreaterThanOrEqual(3);
  });

  it("never counts an empty event stream as qualified traffic", () => {
    const result = evaluateQualifiedVisitors([]);
    expect(result.qualified).toBe(0);
    expect(result.sessions).toBe(0);
  });
});

describe("launch conversion readiness roll-up", () => {
  const readiness = buildLaunchConversionReadiness();

  it("separates internal readiness from external blockers", () => {
    expect(readiness.lines.some(l => l.scope === "INTERNAL")).toBe(true);
    for (const line of readiness.lines.filter(l => l.scope === "EXTERNAL")) {
      expect(line.state, line.id).toBe("BLOCKED");
    }
    expect(readiness.externalState).toBe("BLOCKED");
  });

  it("keeps every outbound campaign asset in DRAFT", () => {
    for (const asset of CAMPAIGN_ASSETS) expect(asset.status).toBe("DRAFT");
  });

  it("reports the unchanged indexable inventory", () => {
    expect(readiness.indexableUrlCount).toBe(126);
  });
});

describe("launch smoke runbook", () => {
  it("is a human checklist, never automated by the app", () => {
    const runbook = buildLaunchSmokeRunbook();
    expect(runbook.automated).toBe(false);
    expect(runbook.steps.length).toBeGreaterThanOrEqual(10);
    expect(runbook.blockingCount).toBeGreaterThan(0);
    const orders = runbook.steps.map(s => s.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    for (const step of runbook.steps) {
      expect(step.pass.trim().length, step.id).toBeGreaterThan(0);
      expect(step.onFailure.trim().length, step.id).toBeGreaterThan(0);
    }
  });
});
