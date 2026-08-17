// Client-facing brand + California advertising-compliance enforcement.
//
// Compliance basis (reference only, not legal advice copy):
//  * BPC 10140.6 — solicitation material intended as a first point of contact
//    must carry the licensee name, license identification number, and the
//    responsible broker identity.
//  * BPC 10015.4 — defines responsible broker identity.
// DRE record: 01513916 Melendez, Joseph Anthony — salesperson under
// Coldwell Banker Diamond / Red Door Realty & Investments Inc. (DRE 01953240).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BRAND, LEGAL_DISCLOSURE, LICENSE } from "../positioning";
import { siteGraph, FORBIDDEN_SCHEMA_KEYS } from "../schema";
import { PUBLIC_PAGES } from "../content";
import { CAMPAIGN_ASSETS } from "../acquisition-campaigns";
import { PAID_BLUEPRINTS, PAID_GUARDRAILS } from "../paid-readiness";
import { CONSENT_TEXT } from "../lead-capture";

const SRC = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "components/ui") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const ALL_FILES = walk(SRC).filter(f => !f.includes("__tests__"));

describe("public identity", () => {
  it("keeps Legacy Forge as the consumer brand and public publisher", () => {
    expect(BRAND.name).toBe("Legacy Forge");
    expect(BRAND.publisher).toBe("Legacy Forge");
    expect(BRAND.advisor).toBe("Joe Melendez");
  });

  it("renders no public 'JM Advisory Press' identity anywhere", () => {
    const offenders = ALL_FILES.filter(f => {
      const text = readFileSync(f, "utf8");
      if (!text.includes("JM Advisory Press")) return false;
      // The only permitted occurrence is the internal-only imprint constant
      // and its explanatory comment in positioning.ts.
      return !f.endsWith(join("marketing", "positioning.ts"));
    });
    expect(offenders).toEqual([]);
  });

  it("exposes the full licensee + responsible-broker disclosure", () => {
    for (const fragment of [
      "Joseph Anthony Melendez",
      "Joe Melendez",
      "California Real Estate Salesperson",
      "01513916",
      "Coldwell Banker Diamond",
      "Red Door Realty & Investments Inc.",
      "01953240",
      "562-640-1466",
      "joe@cb-diamond.com",
      "Equal Housing Opportunity",
    ]) {
      expect(LEGAL_DISCLOSURE).toContain(fragment);
    }
  });

  it("does not introduce REALTOR® as a designation", () => {
    expect(LEGAL_DISCLOSURE).not.toContain("REALTOR");
    expect(LICENSE.designation).toBe("California Real Estate Salesperson");
  });
});

describe("public shell disclosure", () => {
  const shell = readFileSync(join(SRC, "components", "public-shell.tsx"), "utf8");

  it("renders the licensee DRE and responsible broker identity in the footer", () => {
    expect(shell).toContain("license-disclosure");
    expect(shell).toContain("LICENSE.dreLicense");
    expect(shell).toContain("LICENSE.responsibleBroker");
    expect(shell).toContain("LICENSE.responsibleBrokerDre");
    expect(shell).toContain("LICENSE.brokerageDba");
  });

  it("links phone and email accessibly", () => {
    expect(shell).toContain("LICENSE.phoneHref");
    expect(shell).toContain("LICENSE.emailHref");
    expect(LICENSE.phoneHref.startsWith("tel:")).toBe(true);
    expect(LICENSE.emailHref.startsWith("mailto:")).toBe(true);
  });
});

describe("contact page", () => {
  const contact = readFileSync(join(SRC, "routes", "contact.tsx"), "utf8");

  it("presents phone and email as primary contact methods", () => {
    expect(contact).toContain("contact-methods");
    expect(contact).toContain("LICENSE.phoneHref");
    expect(contact).toContain("LICENSE.emailHref");
  });

  it("carries no same-business-day or immediate response promise", () => {
    const copy = JSON.stringify(PUBLIC_PAGES["contact"]).toLowerCase();
    expect(copy).not.toContain("same business day");
    expect(copy).not.toContain("immediately for notices");
  });
});

describe("structured data", () => {
  const graph = siteGraph() as { "@graph": Record<string, unknown>[] };
  const nodes = graph["@graph"];
  const byType = (t: string) => nodes.filter(n => n["@type"] === t);

  it("keeps WebSite and Brand as Legacy Forge", () => {
    expect(byType("WebSite")[0]?.["name"]).toBe("Legacy Forge");
    expect(byType("Brand")[0]?.["name"]).toBe("Legacy Forge");
  });

  it("represents the licensee with a DRE identifier and contact data", () => {
    const person = byType("Person")[0]!;
    expect(person["name"]).toBe("Joe Melendez");
    expect(person["telephone"]).toBe(LICENSE.phone);
    expect(person["email"]).toBe(LICENSE.email);
    expect(JSON.stringify(person["identifier"])).toContain(LICENSE.dreLicense);
  });

  it("represents the brokerage and responsible broker accurately", () => {
    const serialized = JSON.stringify(nodes);
    expect(serialized).toContain(LICENSE.brokerageDba);
    expect(serialized).toContain(LICENSE.responsibleBroker);
    expect(serialized).toContain(LICENSE.responsibleBrokerDre);
  });

  it("fabricates no address, rating, review, or award", () => {
    const serialized = JSON.stringify(nodes);
    for (const key of FORBIDDEN_SCHEMA_KEYS) {
      expect(serialized).not.toContain(`"${key}"`);
    }
    expect(serialized).not.toContain("LocalBusiness");
    expect(FORBIDDEN_SCHEMA_KEYS).toContain("aggregateRating");
    expect(FORBIDDEN_SCHEMA_KEYS).toContain("review");
    expect(FORBIDDEN_SCHEMA_KEYS).toContain("streetAddress");
  });
});

describe("capture and campaign assets", () => {
  it("uses Legacy Forge plus license identity in consent copy", () => {
    expect(CONSENT_TEXT).toContain("Legacy Forge");
    expect(CONSENT_TEXT).not.toContain("JM Advisory Press");
    expect(CONSENT_TEXT).toContain(LICENSE.dreLicense);
  });

  it("gives every DRAFT asset a reusable license disclosure", () => {
    expect(CAMPAIGN_ASSETS.length).toBeGreaterThan(0);
    for (const a of CAMPAIGN_ASSETS) {
      expect(a.status).toBe("DRAFT");
      expect(a.activated).toBe(false);
      expect(a.legalDisclosure).toBe(LEGAL_DISCLOSURE);
      expect(a.body).not.toContain("JM Advisory Press");
      expect(a.guardrails.some(g => /opt-out/i.test(g))).toBe(true);
    }
  });

  it("adds no ratings, results, or guarantees to campaign copy", () => {
    const banned = /guarantee|guaranteed|#1 |top-rated|best in |award-winning|\d+ homes sold|five-star/i;
    for (const a of CAMPAIGN_ASSETS) {
      expect(banned.test(a.body)).toBe(false);
    }
  });
});

describe("Google vs Meta housing policy accuracy", () => {
  const google = PAID_BLUEPRINTS.find(b => b.platform === "google-search")!;

  it("states Google's actual prohibited targeting attributes", () => {
    for (const attr of ["age", "gender", "parental status", "marital status", "ZIP code"]) {
      expect(google.housingCompliance.toLowerCase()).toContain(attr.toLowerCase());
    }
  });

  it("does not describe radius targeting as prohibited by Google", () => {
    expect(google.housingCompliance).toContain("Radius targeting is NOT prohibited by Google");
    expect(google.housingCompliance).toContain("1 km");
    expect(google.housingCompliance).not.toContain("ZIP-code radius");
  });

  it("labels the stricter no-radius rule as internal policy", () => {
    expect(google.housingCompliance).toContain("INTERNAL POLICY");
    expect(PAID_GUARDRAILS.join(" ")).toContain("internal Legacy Forge policy");
  });

  it("keeps Meta Special Ad Category language separate from Google", () => {
    const meta = PAID_BLUEPRINTS.find(b => b.platform === "meta")!;
    expect(meta.housingCompliance).toContain("Special Ad Category");
    expect(google.housingCompliance).not.toContain("Special Ad Category is mandatory");
  });

  it("keeps every paid blueprint blocked and unactivated", () => {
    for (const b of PAID_BLUEPRINTS) {
      expect(b.status).toBe("BLOCKED");
      expect(b.activated).toBe(false);
    }
  });
});
