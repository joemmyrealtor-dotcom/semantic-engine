// Discovery Measurement Pack — Google Search Console readiness layer.
//
// The integration contract only. No values are invented: until a Search
// Console property is connected and rows are supplied, every metric reads
// "unavailable" rather than zero. Zero is a measurement; unavailable is not.

export const SEARCH_CONSOLE_DIMENSIONS = [
  "query",
  "page",
  "country",
  "device",
  "date",
  "searchAppearance",
] as const;

export type SearchConsoleDimension = (typeof SEARCH_CONSOLE_DIMENSIONS)[number];

export const SEARCH_CONSOLE_METRICS = ["impressions", "clicks", "ctr", "position"] as const;
export type SearchConsoleMetric = (typeof SEARCH_CONSOLE_METRICS)[number];

export interface SearchConsoleRow {
  query?: string;
  page?: string;
  country?: string;
  device?: "DESKTOP" | "MOBILE" | "TABLET";
  date?: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
}

export interface SearchConsoleQuery {
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions: SearchConsoleDimension[];
  rowLimit: number;
}

export type ConnectionState = "not-connected" | "connected" | "no-data";

export interface SearchConsoleStatus {
  state: ConnectionState;
  propertyUrl: string | null;
  dimensions: readonly SearchConsoleDimension[];
  metrics: readonly SearchConsoleMetric[];
  detail: string;
  /** Never true until a property is connected AND returns rows. */
  metricsAvailable: boolean;
}

export function searchConsoleStatus(propertyUrl: string | null, rows: SearchConsoleRow[] | null = null): SearchConsoleStatus {
  if (!propertyUrl) {
    return {
      state: "not-connected",
      propertyUrl: null,
      dimensions: SEARCH_CONSOLE_DIMENSIONS,
      metrics: SEARCH_CONSOLE_METRICS,
      detail:
        "No Search Console property is connected. Impressions, clicks, CTR, and position are unavailable — not zero.",
      metricsAvailable: false,
    };
  }
  if (!rows || rows.length === 0) {
    return {
      state: "no-data",
      propertyUrl,
      dimensions: SEARCH_CONSOLE_DIMENSIONS,
      metrics: SEARCH_CONSOLE_METRICS,
      detail: `Property ${propertyUrl} is connected but has returned no rows yet.`,
      metricsAvailable: false,
    };
  }
  return {
    state: "connected",
    propertyUrl,
    dimensions: SEARCH_CONSOLE_DIMENSIONS,
    metrics: SEARCH_CONSOLE_METRICS,
    detail: `Property ${propertyUrl} returned ${rows.length} rows.`,
    metricsAvailable: true,
  };
}

export interface PagePerformance {
  page: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  topQueries: string[];
}

/** Aggregation over supplied rows only. Returns [] when nothing was supplied. */
export function summarizeByPage(rows: SearchConsoleRow[] | null): PagePerformance[] {
  if (!rows || rows.length === 0) return [];
  const byPage = new Map<string, { impressions: number; clicks: number; positionSum: number; n: number; queries: Map<string, number> }>();
  for (const row of rows) {
    const page = row.page ?? "(unknown)";
    if (!byPage.has(page)) byPage.set(page, { impressions: 0, clicks: 0, positionSum: 0, n: 0, queries: new Map() });
    const entry = byPage.get(page)!;
    entry.impressions += row.impressions;
    entry.clicks += row.clicks;
    entry.positionSum += row.position * Math.max(1, row.impressions);
    entry.n += Math.max(1, row.impressions);
    if (row.query) entry.queries.set(row.query, (entry.queries.get(row.query) ?? 0) + row.impressions);
  }
  return [...byPage.entries()]
    .map(([page, e]) => ({
      page,
      impressions: e.impressions,
      clicks: e.clicks,
      ctr: e.impressions ? e.clicks / e.impressions : 0,
      position: e.n ? e.positionSum / e.n : 0,
      topQueries: [...e.queries.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([q]) => q),
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

/** Default query envelope used once a property is connected. */
export function defaultQuery(siteUrl: string, startDate: string, endDate: string): SearchConsoleQuery {
  return {
    siteUrl,
    startDate,
    endDate,
    dimensions: ["query", "page", "country", "device"],
    rowLimit: 1000,
  };
}
