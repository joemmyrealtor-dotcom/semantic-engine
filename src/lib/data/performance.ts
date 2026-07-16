// Workstream 9 — Performance diagnostics & memoization primitives.
//
// LRU memoize for expensive derived calculations (graph/intelligence/analytics).
// Counters expose call counts, hit rates, and timing for the monitoring dash.

export interface PerfCounter { name: string; calls: number; hits: number; misses: number; totalMs: number }

const counters = new Map<string, PerfCounter>();
export function getCounters(): PerfCounter[] {
  return [...counters.values()].sort((a, b) => b.totalMs - a.totalMs);
}
export function resetCounters(): void { counters.clear(); }

function bump(name: string, patch: Partial<PerfCounter>) {
  const c = counters.get(name) ?? { name, calls: 0, hits: 0, misses: 0, totalMs: 0 };
  counters.set(name, {
    name, calls: c.calls + (patch.calls ?? 0),
    hits: c.hits + (patch.hits ?? 0),
    misses: c.misses + (patch.misses ?? 0),
    totalMs: c.totalMs + (patch.totalMs ?? 0),
  });
}

/** LRU memoize keyed on JSON.stringify(args). Preserves function purity guarantees. */
export function memoize<A extends unknown[], R>(name: string, fn: (...args: A) => R, capacity = 32): (...args: A) => R {
  const cache = new Map<string, R>();
  return (...args: A): R => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      const v = cache.get(key) as R;
      cache.delete(key); cache.set(key, v); // touch (LRU)
      bump(name, { calls: 1, hits: 1 });
      return v;
    }
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const r = fn(...args);
    const dt = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
    cache.set(key, r);
    if (cache.size > capacity) {
      const first = cache.keys().next().value;
      if (first !== undefined) cache.delete(first);
    }
    bump(name, { calls: 1, misses: 1, totalMs: dt });
    return r;
  };
}

/** Time an arbitrary function and log to the perf counter table. */
export function timed<A extends unknown[], R>(name: string, fn: (...args: A) => R): (...args: A) => R {
  return (...args: A) => {
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    try { return fn(...args); }
    finally {
      const dt = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
      bump(name, { calls: 1, totalMs: dt });
    }
  };
}

export interface PerfReport { counters: PerfCounter[]; slowest: PerfCounter | null; totalCalls: number; totalMs: number }
export function perfReport(): PerfReport {
  const list = getCounters();
  return {
    counters: list,
    slowest: list[0] ?? null,
    totalCalls: list.reduce((n, c) => n + c.calls, 0),
    totalMs: list.reduce((n, c) => n + c.totalMs, 0),
  };
}
