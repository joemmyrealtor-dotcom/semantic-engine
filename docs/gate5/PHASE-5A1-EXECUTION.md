# Gate 5 — Phase 5A1 Origin Migration (T17-1 + T17-10)

**Status:** Repository work COMPLETE. Branch/PR step BLOCKED pending separate approval.
**Production:** BLOCKED. No merge, DNS, custom-domain activation, publish, GSC/Bing, or CRM action taken.

## Base

- Authorized base HEAD: `39b222dcda8e617775f98baf004bbe6458c2a703` (confirmed ancestor of the change).
- Target origin: `https://joemelendezrealty.com` (apex, HTTPS).

## Atomic change (T17-1 + T17-10 in one change set)

| File | Change |
| --- | --- |
| `.env` | Added `PUBLIC_SITE_ORIGIN=https://joemelendezrealty.com` and `VITE_PUBLIC_SITE_ORIGIN=https://joemelendezrealty.com` (repository non-secret env convention; consumed by `src/lib/marketing/site.ts`). No Supabase-managed key touched. |
| `public/robots.txt` | `Sitemap:` line changed from the provisional Lovable origin to `https://joemelendezrealty.com/sitemap.xml`. |
| `src/lib/marketing/__tests__/discovery-activation.test.ts` | Two assertions that hard-coded the provisional/BLOCKED state made origin-conditional. |
| `src/lib/marketing/__tests__/release-audit.test.ts` | T17-1 assertion made origin-conditional. |
| `src/lib/marketing/__tests__/search-authority.test.ts` | Indexing-launch origin assertion made origin-conditional. |
| `scripts/gate5-manifest.ts` | New read-only manifest generator (evidence tooling). |
| `docs/gate5/manifest-pre-migration.json` | Pre-migration manifest. |
| `docs/gate5/manifest-post-migration.json` | Post-migration manifest. |
| `docs/gate5/PHASE-5A1-EXECUTION.md` | This record. |

No application source module was edited: every canonical, sitemap, OG, and JSON-LD
surface already derives from `PUBLIC_SITE_ORIGIN` in `src/lib/marketing/site.ts`.

## Manifest evidence

| Manifest | Canonical JSON SHA-256 | File SHA-256 |
| --- | --- | --- |
| Pre-migration | `11573b5ebac11f3047b98da0af6281214c7a0c027c4a306f860cc671f1ec4e54` | `cfe8aa343517d737f0d0bf199e362c10b9c51234ad957f6f5cff94f1eb39923b` |
| Post-migration | `d48b3d62d6058e8b817415725da359fb43ef736f1e87b79665de019b4f376463` | `50ec7cf2e1ba0cff449ffa8f6d7e313c8f12b19da127fe9480dfc7c80b730643` |

Coverage per route: canonical, sitemap URL, OG URL, OG image, full JSON-LD graph;
plus robots `Sitemap:` reference, the seven stable entity `@id` values, and the
social card URL.

### Comparison

- Indexable routes: 126 -> 126; unique routes 126 -> 126.
- Path drift: **0** (sorted path lists identical).
- After substituting the old origin for the new one, `routes`, `sitemap`,
  `entityIds`, `socialCardUrl`, and `robotsSitemapReference` are byte-identical —
  the only delta is the origin string itself.
- Provisional-origin leaks: **3838 -> 0** across canonical, sitemap, open-graph,
  schema, and share surfaces.
- `canonicalOriginStatus().status`: BLOCKED -> **PASS**.
- All 7 entity IDs use `https://joemelendezrealty.com/#…`.

## Validation

| Command | Result |
| --- | --- |
| `bun run validate` | PASS — 356/356 checks |
| `bun run test` | PASS — 296/296 tests, 17/17 files |
| `bun run security:secdef` | PASS — 7 SECURITY DEFINER functions, zero anon/PUBLIC execute grants |
| `bun run e2e` | PASS — 79/79 Playwright tests |

E2E note: the packaged `e2e` script pins `PLAYWRIGHT_BROWSERS_PATH=/`, which does
not exist in this sandbox; the suite was run against the installed browser root
(`/opt/ms-playwright`) with the same Playwright config. Environment-only
deviation, no test or config change.

## Not performed (requires separate approval)

Creating `gate5/origin-migration-t17` on GitHub, pushing, and opening the PR into
protected `main` are platform/GitHub operations outside this repository working
copy. No PR URL or required-check status can be reported yet.

## Rollback

Primary: protected-branch revert of the migration commit.
Emergency: immutable Gate 3 baseline `baseline/BL-GATE3-20260821T161600Z`
(commit `34edc0450bd0db1da74ae6243f0fbbed5c96d753`).
