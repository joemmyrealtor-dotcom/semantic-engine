import { describe, it, expect } from "vitest";
import { SELLER_HOOKS, cityListingChecklist } from "../seller-hooks";
describe("seller hooks", () => {
  it("publishes exactly 10 seller questions", () => expect(SELLER_HOOKS.length).toBe(10));
  it("names the city in the listing checklist", () =>
    expect(cityListingChecklist("Brea").some(i => i.includes("Brea"))).toBe(true));
});
