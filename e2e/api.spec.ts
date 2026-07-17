// Public API endpoints — catalog (unauth), bearer auth, and rate limiting.
import { test, expect } from "./fixtures";

test.describe("Public API", () => {
  test("catalog is reachable without a bearer", async ({ request }) => {
    const r = await request.get("/api/public/v1/catalog");
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(Array.isArray(body.catalog)).toBe(true);
    expect(body.catalog.length).toBeGreaterThan(0);
    // Standard security headers on every response.
    expect(r.headers()["x-request-id"]).toBeTruthy();
  });

  test("non-catalog endpoint requires bearer → 401", async ({ request }) => {
    const r = await request.get("/api/public/v1/registry/publications");
    expect(r.status()).toBe(401);
    const body = await r.json();
    expect(body.error?.code).toBe("unauthorized");
  });

  test("invalid bearer format still rejected", async ({ request }) => {
    const r = await request.get("/api/public/v1/registry/publications", {
      headers: { authorization: "Bearer not-a-valid-token" },
    });
    // Either 401 (bearer not resolvable) or 403 (resolvable but no scope).
    expect([401, 403]).toContain(r.status());
  });

  test("rate limit headers are emitted", async ({ request }) => {
    const r = await request.get("/api/public/v1/catalog");
    // Catalog is exempt so we only assert baseline security envelope.
    expect(r.headers()["x-request-id"]).toBeTruthy();

    // Force the pre-auth abuse bucket by hammering an unauth endpoint quickly.
    // The pre-auth policy limits are intentionally tight; we require at
    // least ONE 429 within a burst of 150 requests. This proves the
    // centralized enforcer is wired end-to-end, not just present in code.
    let saw429 = false;
    for (let i = 0; i < 150; i++) {
      const resp = await request.get("/api/public/v1/registry/publications", {
        headers: { "x-forwarded-for": "203.0.113.42" },
      });
      if (resp.status() === 429) {
        saw429 = true;
        expect(resp.headers()["retry-after"] ?? resp.headers()["x-ratelimit-retry-after"]).toBeTruthy();
        break;
      }
    }
    expect(saw429, "Expected a 429 response after 150 rapid unauthenticated requests").toBe(true);
  });
});
