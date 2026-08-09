// Discovery Measurement Pack — AI and search discovery attribution.
//
// Classifies only what the referrer and analytics data actually expose. Most
// AI citations are NOT measurable: assistants strip or omit referrers, and
// answer surfaces frequently produce no click at all. This module never
// claims coverage it cannot prove.

export type DiscoverySourceId =
  | "chatgpt"
  | "perplexity"
  | "gemini"
  | "copilot"
  | "google-ai"
  | "bing"
  | "google-organic"
  | "other-search"
  | "direct-or-unattributed"
  | "referral";

export interface DiscoverySource {
  id: DiscoverySourceId;
  label: string;
  kind: "ai-assistant" | "ai-search-surface" | "search-engine" | "unknown";
  hosts: string[];
  /** How reliably this source can be attributed from a browser referrer. */
  measurability: "reliable" | "partial" | "unmeasurable";
  note: string;
}

export const DISCOVERY_SOURCES: DiscoverySource[] = [
  {
    id: "chatgpt",
    label: "ChatGPT",
    kind: "ai-assistant",
    hosts: ["chat.openai.com", "chatgpt.com"],
    measurability: "partial",
    note: "Referrer appears on clicked citations only; in-answer usage with no click is invisible.",
  },
  {
    id: "perplexity",
    label: "Perplexity",
    kind: "ai-assistant",
    hosts: ["perplexity.ai", "www.perplexity.ai"],
    measurability: "partial",
    note: "Citation clicks carry a referrer; answer-only impressions do not.",
  },
  {
    id: "gemini",
    label: "Gemini",
    kind: "ai-assistant",
    hosts: ["gemini.google.com", "bard.google.com"],
    measurability: "partial",
    note: "Some clicks arrive with a Google referrer that cannot be separated from organic.",
  },
  {
    id: "copilot",
    label: "Microsoft Copilot",
    kind: "ai-assistant",
    hosts: ["copilot.microsoft.com", "bing.com/chat"],
    measurability: "partial",
    note: "Copilot clicks are sometimes reported as Bing traffic.",
  },
  {
    id: "google-ai",
    label: "Google AI surfaces",
    kind: "ai-search-surface",
    hosts: [],
    measurability: "unmeasurable",
    note: "AI Overviews are reported inside normal Search Console organic data with no separate dimension.",
  },
  {
    id: "bing",
    label: "Bing",
    kind: "search-engine",
    hosts: ["bing.com", "www.bing.com"],
    measurability: "reliable",
    note: "Standard organic referrer.",
  },
  {
    id: "google-organic",
    label: "Google organic",
    kind: "search-engine",
    hosts: ["google.com", "www.google.com", "google.co.uk"],
    measurability: "reliable",
    note: "Standard organic referrer; includes AI Overview clicks that cannot be split out.",
  },
  {
    id: "other-search",
    label: "Other search engines",
    kind: "search-engine",
    hosts: ["duckduckgo.com", "search.yahoo.com", "ecosia.org", "brave.com"],
    measurability: "reliable",
    note: "Standard organic referrer.",
  },
];

export interface DiscoveryClassification {
  source: DiscoverySourceId;
  label: string;
  kind: DiscoverySource["kind"] | "unknown";
  measurability: DiscoverySource["measurability"];
  host: string | null;
  note: string;
}

export function classifyReferrer(referrer: string | null | undefined): DiscoveryClassification {
  if (!referrer || !referrer.trim()) {
    return {
      source: "direct-or-unattributed",
      label: "Direct or unattributed",
      kind: "unknown",
      measurability: "unmeasurable",
      host: null,
      note: "No referrer. This bucket also absorbs AI assistants that strip referrers — do not read it as brand-direct traffic.",
    };
  }
  let host: string;
  try {
    host = new URL(referrer).host.toLowerCase();
  } catch {
    host = referrer.replace(/^https?:\/\//, "").split("/")[0]!.toLowerCase();
  }

  const match = DISCOVERY_SOURCES.find(s => s.hosts.some(h => host === h || host.endsWith(`.${h}`)));
  if (match) {
    return { source: match.id, label: match.label, kind: match.kind, measurability: match.measurability, host, note: match.note };
  }
  return {
    source: "referral",
    label: "Referral",
    kind: "unknown",
    measurability: "reliable",
    host,
    note: "Ordinary referring site.",
  };
}

export interface DiscoveryCoverage {
  totalSources: number;
  reliable: number;
  partial: number;
  unmeasurable: number;
  caveat: string;
}

export function discoveryCoverage(): DiscoveryCoverage {
  return {
    totalSources: DISCOVERY_SOURCES.length,
    reliable: DISCOVERY_SOURCES.filter(s => s.measurability === "reliable").length,
    partial: DISCOVERY_SOURCES.filter(s => s.measurability === "partial").length,
    unmeasurable: DISCOVERY_SOURCES.filter(s => s.measurability === "unmeasurable").length,
    caveat:
      "AI citation volume is not directly measurable. Only clicked citations that preserve a referrer are attributable; treat AI-sourced traffic as a floor, never as total AI visibility.",
  };
}
