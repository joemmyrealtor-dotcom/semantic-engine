import { describe, it, expect } from "vitest";
import { afterFailure, isSendable, RETRY_DELAYS_MS } from "../lead-delivery-policy";

describe("lead delivery retry schedule", () => {
  it("retries after 1m, 5m, 15m, 1h, 6h, 24h", () => {
    expect([...RETRY_DELAYS_MS]).toEqual([60_000, 300_000, 900_000, 3_600_000, 21_600_000, 86_400_000]);
    const now = 1_000;
    expect(afterFailure(1, now)).toEqual({ status: "retrying", nextAttemptAt: now + 60_000 });
    expect(afterFailure(6, now)).toEqual({ status: "retrying", nextAttemptAt: now + 86_400_000 });
  });

  it("moves to dead_letter after the final retry fails", () => {
    expect(afterFailure(7, 0)).toEqual({ status: "dead_letter" });
  });

  it("never resends a delivered or dead-lettered record", () => {
    expect(isSendable("delivered")).toBe(false);
    expect(isSendable("dead_letter")).toBe(false);
    expect(isSendable("pending")).toBe(true);
    expect(isSendable("retrying")).toBe(true);
  });
});
