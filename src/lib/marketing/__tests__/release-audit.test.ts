import { describe, it, expect } from "vitest";
import { buildReleaseAudit, thinLocalPages } from "../release-audit";
import { canonicalOriginStatus, isProvisionalOrigin, FALLBACK_SITE_ORIGIN } from "../site";
import { localAssetsFor, CHANNELS, CHANNEL_LIMITS } from "../distribution";
import { LOCAL_PAGES } from "../local-pages";

describe("canonical origin gate (Task 17)", () => {
  it("flags the provisional Lovable host", () => {
    expect(isProvisionalOrigin(FALLBACK_SITE_ORIGIN)).toBe(true);
    expect(isProvisionalOrigin("https://preview.lovableproject.com")).toBe(true);
    expect(isProvisionalOrigin("https://legacyforge.com")).toBe(false);
  });

  it("blocks until a final domain is configured", () => {
    expect(canonicalOriginStatus(FALLBACK_SITE_ORIGIN).status).toBe("BLOCKED");
    expect(canonicalOriginStatus("https://legacyforge.com").status).toBe("PASS");
  });
});

describe("release audit", () => {
  const audit = buildReleaseAudit();

  it("never reports PASS while the origin is provisional", () => {
    expect(audit.status).not.toBe("PASS");
    expect(audit.checks.find(c => c.id === "T17-1")?.status).toBe("BLOCKED");
  });

  it("keeps the governed console and private routes out of the index", () => {
    expect(audit.checks.find(c => c.id === "T17-2")?.status).toBe("PASS");
  });

  it("has no duplicate indexable URLs", () => {
    expect(audit.checks.find(c => c.id === "T17-3")?.status).toBe("PASS");
  });

  it("rejects thin city-template pages", () => {
    expect(thinLocalPages()).toEqual([]);
  });
});

describe("local social repurposing metadata", () => {
  it("emits one draft per channel, within limits, pointing at the canonical page", () => {
    for (const spec of LOCAL_PAGES.slice(0, 4)) {
      const assets = localAssetsFor(spec);
      expect(assets.map(a => a.channel)).toEqual(CHANNELS);
      for (const asset of assets) {
        expect(asset.status).toBe("Draft");
        expect(asset.body.length).toBeLessThanOrEqual(CHANNEL_LIMITS[asset.channel]);
        expect(asset.url.endsWith(spec.path)).toBe(true);
        expect(asset.tags.length).toBe(3);
      }
    }
  });
});
