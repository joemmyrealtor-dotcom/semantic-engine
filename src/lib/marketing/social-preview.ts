// Search Authority Gate — social discovery metadata validation.
//
// Every priority page must have a unique OG title and description, a
// 1200x630 branded card, a self-referencing canonical, X card metadata, and
// share-safe copy. Duplicate share cards make every link look the same in
// LinkedIn, Facebook, X, and messaging apps.

import { indexableRecords, type SearchIntentRecord } from "./intent-map";
import { publicMeta } from "./seo";
import { SOCIAL_CARD, absoluteUrl } from "./site";

export interface SocialPreview {
  path: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  canonical: string;
  image: string;
  imageWidth: string;
  imageHeight: string;
  imageAlt: string;
  twitterCard: string;
  shareSafe: boolean;
}

/** Copy that would read badly, or overpromise, when shared out of context. */
const UNSAFE_SHARE_RE = /\b(guaranteed|free money|#1|act now|limited time)\b/i;

export function socialPreviewFor(record: SearchIntentRecord): SocialPreview {
  const description = record.secondaryKeywords.length
    ? `${record.h1} — ${record.secondaryKeywords[0]}`
    : record.h1;
  const tags = publicMeta({ path: record.path, title: record.title, description });
  const get = (key: "property" | "name", value: string) =>
    String(tags.find(t => t[key] === value)?.["content"] ?? "");

  return {
    path: record.path,
    ogTitle: get("property", "og:title"),
    ogDescription: get("property", "og:description"),
    ogUrl: get("property", "og:url"),
    canonical: absoluteUrl(record.path),
    image: SOCIAL_CARD.url,
    imageWidth: SOCIAL_CARD.width,
    imageHeight: SOCIAL_CARD.height,
    imageAlt: SOCIAL_CARD.alt,
    twitterCard: get("name", "twitter:card"),
    shareSafe: !UNSAFE_SHARE_RE.test(`${record.title} ${description}`),
  };
}

export interface SocialAudit {
  previews: SocialPreview[];
  duplicateTitles: string[];
  duplicateDescriptions: string[];
  missingCanonical: string[];
  unsafeCopy: string[];
  status: "PASS" | "REVIEW" | "FAIL";
}

export function auditSocialPreviews(): SocialAudit {
  const previews = indexableRecords().map(socialPreviewFor);
  const seenTitle = new Map<string, string>();
  const seenDesc = new Map<string, string>();
  const duplicateTitles: string[] = [];
  const duplicateDescriptions: string[] = [];

  for (const p of previews) {
    const t = p.ogTitle.trim().toLowerCase();
    if (seenTitle.has(t)) duplicateTitles.push(`${p.path} duplicates the OG title of ${seenTitle.get(t)}`);
    else seenTitle.set(t, p.path);
    const d = p.ogDescription.trim().toLowerCase();
    if (seenDesc.has(d)) duplicateDescriptions.push(`${p.path} duplicates the OG description of ${seenDesc.get(d)}`);
    else seenDesc.set(d, p.path);
  }

  const missingCanonical = previews.filter(p => p.ogUrl !== p.canonical).map(p => p.path);
  const unsafeCopy = previews.filter(p => !p.shareSafe).map(p => p.path);
  const failures = duplicateTitles.length + missingCanonical.length + unsafeCopy.length;

  return {
    previews,
    duplicateTitles,
    duplicateDescriptions,
    missingCanonical,
    unsafeCopy,
    status: failures > 0 ? "FAIL" : duplicateDescriptions.length > 0 ? "REVIEW" : "PASS",
  };
}
