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
  alt: "Legacy Forge by JM Advisory Press — real estate decision guides for Orange County",
  type: "image/png",
} as const;

export const SITE_LOCALE = "en_US";
export const SITE_LANGUAGE = "en-US";
