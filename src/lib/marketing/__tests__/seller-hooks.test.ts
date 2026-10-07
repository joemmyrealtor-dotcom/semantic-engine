import { describe, it, expect } from "vitest";
import { SELLER_HOOKS, cityListingChecklist } from "../seller-hooks";
describe("seller hooks", () => {
  it("publishes exactly 10 seller questions", () => expect(SELLER_HOOKS.length).toBe(10));
  it("listing checklist has exactly 5 steps", () => expect(cityListingChecklist("Brea").length).toBe(5));
  it("net-proceeds answer uses negotiated broker compensation, not 'commissions'", () => {
    const h02 = SELLER_HOOKS.find(h => h.id === "H02")!;
    expect(h02.answer).toContain("negotiated broker compensation");
    expect(h02.answer).not.toMatch(/commission/i);
  });
});
