import { describe, it, expect } from "vitest";
import { buildSeedSnapshot } from "@/lib/data/seed";
describe("seed", () => { it("builds", () => { const s = buildSeedSnapshot(); expect(s.publications.length).toBeGreaterThan(0); }); });
