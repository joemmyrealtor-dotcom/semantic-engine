// Search Authority Gate — indexing launch package.
//
// Prepared, NOT submitted. Nothing here pings a search engine, submits a
// sitemap, or triggers IndexNow. It renders the exact artifacts and policies
// that will be used on the day the production domain is live, so they can be
// reviewed before anything is announced.

import { indexablePaths, NON_INDEXABLE_PUBLIC_PATHS } from "./indexation";
import { canonicalOriginStatus, PUBLIC_SITE_ORIGIN, absoluteUrl } from "./site";

export const AI_CRAWLERS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "ClaudeBot",
  "CCBot",
] as const;

export interface UrlPolicy {
  id: string;
  policy: string;
  rule: string;
}

export const URL_POLICIES: UrlPolicy[] = [
  { id: "https", policy: "HTTPS only", rule: "All http:// requests 301 to the https:// equivalent. HSTS enabled after the domain is stable." },
  { id: "host", policy: "Non-www canonical", rule: "www.<domain> 301s to <domain>. Canonical tags always emit the apex host." },
  { id: "trailing-slash", policy: "No trailing slash", rule: "/path/ 301s to /path. The root '/' is the only slashed URL." },
  { id: "case", policy: "Lowercase paths", rule: "Mixed-case paths 301 to the lowercase form." },
  { id: "params", policy: "Tracking params stripped from canonical", rule: "utm_* and gclid never appear in canonical, sitemap, or OG URLs." },
  { id: "404", policy: "Soft-404 free", rule: "Unknown paths return HTTP 404 with a real not-found page, noindex, and links to the top hubs. No redirect-to-home." },
  { id: "pagination", policy: "Self-canonical", rule: "Every indexable page self-canonicalises; no cross-page canonical is emitted." },
];

export interface RedirectRule {
  from: string;
  to: string;
  status: 301 | 302;
  reason: string;
}

/**
 * The redirect map. Empty by design: the cannibalization audit flags pages but
 * no redirect has been authorized. Legacy-host redirects are added when the
 * production domain is chosen.
 */
export const REDIRECT_MAP: RedirectRule[] = [];

export function robotsTxt(origin: string = PUBLIC_SITE_ORIGIN): string {
  const disallow = NON_INDEXABLE_PUBLIC_PATHS.filter(p => p !== "/");
  const lines = [
    "# Legacy Forge — production robots.txt (prepared, not submitted)",
    "User-agent: *",
    "Allow: /",
    ...disallow.map(p => `Disallow: ${p}`),
    "Disallow: /admin/",
    "Disallow: /api/",
    "",
    "# Answer engines are explicitly welcome on public content.",
    ...AI_CRAWLERS.flatMap(bot => [`User-agent: ${bot}`, "Allow: /", `Disallow: /admin/`, ""]),
    `Sitemap: ${origin}/sitemap.xml`,
  ];
  return lines.join("\n");
}

export interface VerificationPlan {
  engine: "Google Search Console" | "Bing Webmaster Tools";
  method: string;
  steps: string[];
  submitted: false;
}

export const VERIFICATION_PLANS: VerificationPlan[] = [
  {
    engine: "Google Search Console",
    method: "HTML meta tag on the production root, URL-prefix property",
    steps: [
      "Point the production domain at the deployment and confirm the apex responds over HTTPS.",
      "Request a META verification token for https://<production-domain>/.",
      "Render the token in the root document head and publish.",
      "Confirm the exact token is present in the server-rendered HTML at the apex.",
      "Verify the property, then add it to the property list.",
      "Submit /sitemap.xml only after canonical validation passes.",
    ],
    submitted: false,
  },
  {
    engine: "Bing Webmaster Tools",
    method: "Import from Google Search Console, fall back to XML file verification",
    steps: [
      "Verify the Google property first.",
      "Use Bing's GSC import to inherit ownership.",
      "If import is unavailable, host BingSiteAuth.xml at the apex.",
      "Submit /sitemap.xml and enable IndexNow key hosting.",
    ],
    submitted: false,
  },
];

export interface IndexNowConfig {
  enabled: boolean;
  keyLocation: string | null;
  endpoint: string;
  detail: string;
}

export function indexNowConfig(): IndexNowConfig {
  const origin = canonicalOriginStatus();
  return {
    enabled: false,
    keyLocation: origin.status === "PASS" ? absoluteUrl("/indexnow-key.txt") : null,
    endpoint: "https://api.indexnow.org/indexnow",
    detail:
      origin.status === "PASS"
        ? "Key file path reserved. Submission stays disabled until the launch package is authorized."
        : "IndexNow cannot be configured against a provisional origin; the key would be bound to the wrong host.",
  };
}

export interface LaunchPackage {
  generatedAt: string;
  origin: string;
  originStatus: ReturnType<typeof canonicalOriginStatus>;
  robotsTxt: string;
  sitemapUrl: string;
  sitemapUrlCount: number;
  verificationPlans: VerificationPlan[];
  indexNow: IndexNowConfig;
  redirects: RedirectRule[];
  urlPolicies: UrlPolicy[];
  /** Always false in this build — submission requires separate authorization. */
  submitted: boolean;
  readiness: "READY" | "BLOCKED";
  blockers: string[];
}

export function buildLaunchPackage(now: Date = new Date()): LaunchPackage {
  const originStatus = canonicalOriginStatus();
  const blockers: string[] = [];
  if (originStatus.status !== "PASS") blockers.push(originStatus.detail);
  if (REDIRECT_MAP.length === 0 && originStatus.status === "PASS") {
    blockers.push("Legacy-host redirect map is empty; add the provisional-host redirects before announcing the new domain.");
  }

  return {
    generatedAt: now.toISOString(),
    origin: PUBLIC_SITE_ORIGIN,
    originStatus,
    robotsTxt: robotsTxt(),
    sitemapUrl: absoluteUrl("/sitemap.xml"),
    sitemapUrlCount: indexablePaths().length,
    verificationPlans: VERIFICATION_PLANS,
    indexNow: indexNowConfig(),
    redirects: REDIRECT_MAP,
    urlPolicies: URL_POLICIES,
    submitted: false,
    readiness: blockers.length === 0 ? "READY" : "BLOCKED",
    blockers,
  };
}
