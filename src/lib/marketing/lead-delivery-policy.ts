// Owner-approved lead delivery rules (Oct 9 2026). Pure — no I/O.

export type DeliveryStatus = "pending" | "retrying" | "delivered" | "dead_letter";

/**
 * Earliest wait after each failed attempt: 1m, 5m, 15m, 1h, 6h, 24h.
 * These are approximate windows: the scheduled job runs every 5 minutes, so
 * a retry happens on the first run after its due time (up to ~5 min later).
 * Every lead is saved to the database before any send, so none is lost.
 */
export const RETRY_DELAYS_MS = [
  60_000, 300_000, 900_000, 3_600_000, 21_600_000, 86_400_000,
] as const;

/** Lock held on a record while one run sends it. */
export const DELIVERY_LOCK_SECONDS = 120;
/** Max records sent per scheduled run. */
export const DELIVERY_BATCH = 10;

/**
 * Decide what happens after a failed attempt.
 * `attempts` = total failed attempts so far, including this one.
 */
export function afterFailure(
  attempts: number,
  now: number,
): { status: "retrying"; nextAttemptAt: number } | { status: "dead_letter" } {
  const delay = RETRY_DELAYS_MS[attempts - 1];
  if (delay === undefined) return { status: "dead_letter" };
  return { status: "retrying", nextAttemptAt: now + delay };
}

/** Delivered records are never sent again. */
export function isSendable(status: string): boolean {
  return status === "pending" || status === "retrying";
}

export const MIN_FILL_MS = 2500;

/**
 * Bot decision. Fast completion alone is only a risk signal (autofill and
 * assistive tools can be fast). Reject when the honeypot is filled, the bot
 * block is missing, or a fast fill is paired with repeat requests.
 */
export function assessBot(
  bot: { hp: string; elapsedMs: number } | undefined,
  requestsInWindow: number,
): { reject: boolean; risk: "none" | "fast" } {
  if (!bot || bot.hp.trim() !== "") return { reject: true, risk: "none" };
  const fast = bot.elapsedMs < MIN_FILL_MS;
  if (fast && requestsInWindow > 1) return { reject: true, risk: "fast" };
  return { reject: false, risk: fast ? "fast" : "none" };
}
