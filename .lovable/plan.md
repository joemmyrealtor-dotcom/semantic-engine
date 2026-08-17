# Marketing Claim Sweep — Read-Only Findings and Proposed Corrections

Read-only sweep of rendered public routes/content and DRAFT outbound templates. No files were edited.

## Items that should be corrected before production

### 1. Referral page promises a one-business-day contact (rendered-public)
- `src/routes/refer.tsx:96` — "I will contact your client within one business day and report the outcome back to you either way."
- `src/routes/refer.tsx:117` — "I will reach out to your client within one business day and let you know how it goes."

This is an explicit service-level promise and directly contradicts the neutral timing language already adopted on `/contact` ("Response times vary with the day and the volume of inquiries; no specific turnaround is promised.").

### 2. Professional audience page promises same/next-business-day triage (rendered-public)
- `src/lib/partners/pages.ts:238` — standards entry "Fast triage — same or next business day", rendered on `/for/$audience` via `src/routes/for.$audience.tsx:155`.

Same class of unsupported turnaround promise, on an indexed public route.

## Items reviewed and classified as acceptable (no change proposed)

| Location | Snippet | Class |
|---|---|---|
| `src/lib/marketing/content.ts:648` | "Book a no-cost strategy call…" | Rendered-public, factually verifiable (the call is free); no outcome claim |
| `src/lib/marketing/content.ts:681` | "…no specific turnaround is promised." | Rendered-public, safely qualified |
| `src/routes/contact.tsx:22-23` | "Response times vary… no specific turnaround is promised." | Rendered-public, safely qualified |
| `src/components/guide-lead-form.tsx:79` | "You get the downloadable guide immediately." | Rendered-public, describes an actual instant download, not a service promise |
| `src/lib/marketing/lead-magnets.ts` (multiple) | "A free … guide" | Rendered-public, factual (guides are free) |
| `src/routes/attorney-partners.tsx:96,123,150,177` | "Best fit for firms…" | Rendered-public, audience-fit statement, not a superlative self-claim |
| `src/lib/marketing/content.ts:812,829,888` | "no results are guaranteed", "No guaranteed results", "No testimonials, ratings, or outcomes are published" | Rendered-public disclaimers — protective, keep |
| `src/lib/partners/sequences.ts:69,88`; `src/lib/partners/linkedin.ts:35` | "no cost, no strings", "no-cost second opinion" | DRAFT-only (admin surface `/admin/partners`), factual offer |
| `src/lib/marketing/acquisition-campaigns.ts:296,328,341,366,381,411` | "free reference library", "result immediately", "unsubscribe … works immediately" | DRAFT-only, NOT ACTIVATED; "immediately" refers to opt-out/assessment mechanics, not service response |
| `src/lib/marketing/quality-gate.ts:36`; `social-preview.ts:27`; `acquisition-campaigns.ts:475`; `gbp.ts` | superlative/guarantee regex blocklists | Internal-only guardrails |
| `src/lib/marketing/proof.ts`, `proof-operations.ts`, `schema.ts` | testimonial/rating machinery | Internal-only; `proof.ts:201` confirms zero published reviews/ratings/results |

No rendered public claims of ratings, reviews, transaction volume, market leadership, or guarantees were found.

## Proposed correction (if authorized)

Narrow copy-only patch, two files:

1. `src/routes/refer.tsx` — replace both "within one business day" promises with neutral language consistent with `/contact`: contact will be made and the outcome reported back either way, with no promised turnaround.
2. `src/lib/partners/pages.ts:238` — replace the "same or next business day" standard with a non-time-bound commitment (e.g. prompt triage and a reported outcome either way).

Optionally extend `src/lib/marketing/__tests__/brand-compliance.test.ts` with an assertion that no rendered public route/content module contains business-day or fixed-turnaround promise language, so the removed `/contact` promise and these two cannot regress.

### Boundaries preserved
Copy-only. No publish/deploy, no DNS/domain/discovery/account changes, no external sends, no `PUBLIC_SITE_ORIGIN` change, no governed `/` change, no indexable-URL or sitemap change (still 126), all campaign assets remain DRAFT/NOT ACTIVATED, Tasks 14–18 statuses unchanged (production remains BLOCKED).
