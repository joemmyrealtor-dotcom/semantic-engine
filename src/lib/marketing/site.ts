// SEO/AEO hardening — single source of truth for the public site origin.
//
// Every canonical URL, sitemap URL, OG URL, JSON-LD URL, and entity @id on
// the public marketing surfaces must be built from PUBLIC_SITE_ORIGIN. The
// current Lovable origin is the safe fallback until a custom domain is
// connected; set VITE_PUBLIC_SITE_ORIGIN (client/build) or
// PUBLIC_SITE_ORIGIN (server) to switch every surface at once.

/** Used only when no origin is configured. */
export const FALLBACK_SITE_ORIGIN = "https://semantic-engine.lovable.app";

function normalizeOrigin(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(trimmed)) return FALLBACK_SITE_ORIGIN;
  return trimmed;
}

function readConfiguredOrigin(): string {
  try {
    const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const fromVite = viteEnv?.["VITE_PUBLIC_SITE_ORIGIN"];
    if (fromVite && fromVite.trim()) return fromVite;
  } catch {
    /* import.meta.env unavailable in some runtimes */
  }
  if (typeof process !== "undefined" && process.env) {
    const fromNode = process.env["PUBLIC_SITE_ORIGIN"] ?? process.env["VITE_PUBLIC_SITE_ORIGIN"];
    if (fromNode && fromNode.trim()) return fromNode;
  }
  return FALLBACK_SITE_ORIGIN;
}

/** The one public origin. Never hard-code an origin anywhere else. */
export const PUBLIC_SITE_ORIGIN = normalizeOrigin(readConfiguredOrigin());

/** Absolute public URL for a site-relative path. */
export function absoluteUrl(path: string): string {
  if (!path || path === "/") return `${PUBLIC_SITE_ORIGIN}/`;
  return `${PUBLIC_SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Stable @id values for the knowledge-graph entities. These must never change
 * once published, so downstream consumers can merge nodes across pages.
 */
export const ENTITY_ID = {
  website: `${PUBLIC_SITE_ORIGIN}/#website`,
  organization: `${PUBLIC_SITE_ORIGIN}/#organization`,
  brand: `${PUBLIC_SITE_ORIGIN}/#brand`,
  person: `${PUBLIC_SITE_ORIGIN}/#advisor`,
  service: `${PUBLIC_SITE_ORIGIN}/#advisory-service`,
  brokerage: `${PUBLIC_SITE_ORIGIN}/#brokerage`,
  responsibleBroker: `${PUBLIC_SITE_ORIGIN}/#responsible-broker`,
} as const;

/**
 * Branded, non-photographic share card. Text and brand colors only — it makes
 * no claim about people, properties, or results.
 */
export const SOCIAL_CARD = {
  path: "/social-card.png",
  url: absoluteUrl("/social-card.png"),
  width: "1200",
  height: "630",
  alt: "Legacy Forge — real estate decision guides for Orange County",
  type: "image/png",
} as const;

export const SITE_LOCALE = "en_US";
export const SITE_LANGUAGE = "en-US";

/**
 * Task 17 launch gate — the canonical entity must not be the Lovable
 * hostname. Search engines, AI crawlers, social platforms, and backlinks all
 * learn whatever origin we publish, and that identity is expensive to move
 * later. Production must set PUBLIC_SITE_ORIGIN / VITE_PUBLIC_SITE_ORIGIN to
 * the final Legacy Forge domain before anything is published.
 */
export const PROVISIONAL_ORIGIN_HOSTS = ["lovable.app", "lovableproject.com"] as const;

export function isProvisionalOrigin(origin: string = PUBLIC_SITE_ORIGIN): boolean {
  const host = origin.replace(/^https?:\/\//, "").split("/")[0]!.toLowerCase();
  return PROVISIONAL_ORIGIN_HOSTS.some(h => host === h || host.endsWith(`.${h}`));
}

export interface CanonicalOriginStatus {
  origin: string;
  configured: boolean;
  provisional: boolean;
  /** PASS only when a non-provisional origin is explicitly configured. */
  status: "PASS" | "BLOCKED";
  detail: string;
}

export function canonicalOriginStatus(origin: string = PUBLIC_SITE_ORIGIN): CanonicalOriginStatus {
  const configured = origin !== FALLBACK_SITE_ORIGIN;
  const provisional = isProvisionalOrigin(origin);
  return {
    origin,
    configured,
    provisional,
    status: !provisional && configured ? "PASS" : "BLOCKED",
    detail: provisional
      ? `Canonical identity is still the provisional host ${origin}. Set PUBLIC_SITE_ORIGIN to the final Legacy Forge domain before publication.`
      : configured
        ? `Canonical identity is ${origin}.`
        : `No origin configured; falling back to ${origin}.`,
  };
}
