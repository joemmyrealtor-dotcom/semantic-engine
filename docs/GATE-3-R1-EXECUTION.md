# Gate 3 — R1 Immutable Off-Platform Checkpoint (Execution Record)

Status: APPROVED · TARGET CONFIRMED · AWAITING OWNER EXECUTION ON GITHUB

## 1. Confirmed target

| Field | Value |
| --- | --- |
| Target commit | `34edc0450bd0db1da74ae6243f0fbbed5c96d753` |
| Short | `34edc045` |
| Commit date (UTC) | 2026-08-21 16:05:22 |
| Commit subject | Verified branch protection |
| Server fingerprint | `srv-34edc045` |
| Baseline tag | `baseline/BL-GATE3-20260821T161600Z` |
| Repository | `joemmyrealtor-dotcom/semantic-engine` |
| Current HEAD (NOT tagged) | `c39977f0` |

Rationale: the Gate 3 recovery drill and repository export SHA-256 bind to this exact tree state. HEAD `c39977f0` is explicitly excluded.

## 2. Content binding (verified in-sandbox, read-only)

| Artifact | Algorithm | Value |
| --- | --- | --- |
| Tree object of `34edc045` | SHA-1 | `00a2784c2455b59116fa00d5c229891724e43caf` |
| Normalized `git archive --format=tar 34edc045` | SHA-256 | `8fe3ab87dcf06432916764a06a623d25550b58cb11aab9d3da5e32c5e3953383` |
| Archive size | bytes | `3952640` |

**Canonical archive command (PINNED — line-ending normalization is mandatory):**

```bash
git -c core.autocrlf=false -c core.eol=lf archive --format=tar 34edc0450bd0db1da74ae6243f0fbbed5c96d753
```

On Windows, the default `core.autocrlf=true` rewrites LF to CRLF inside the archive and yields the non-canonical hash `251e7686c5293550fb244a1e6b27ca391b3a3a2191ee8d6c79e3cb3b7bd9e1cb`. That is a packaging artifact, not a content difference; the tree SHA `00a2784c…3caf` is identical either way.

Step 3 verified by owner on 2026-08-23: tree SHA, normalized SHA-256, and byte size all match the Gate 3 baseline. Step 3 = PASS.

GitHub's generated `.tar.gz`/`.zip` release archives are recompressed and will hash differently; record their hashes separately in §5.

## 3. Exact command block (owner runs locally; requires push rights)

```bash
# 0) Fresh clone (do not run from a working tree with local changes)
git clone https://github.com/joemmyrealtor-dotcom/semantic-engine.git
cd semantic-engine

# 1) Verify the target commit is present and correct
git fetch --all --tags
git cat-file -t 34edc0450bd0db1da74ae6243f0fbbed5c96d753   # -> commit
git log -1 --format='%H%n%ad%n%s' 34edc0450bd0db1da74ae6243f0fbbed5c96d753

# 2) Verify content binding BEFORE tagging (normalized line endings — PINNED)
git -c core.autocrlf=false -c core.eol=lf archive --format=tar 34edc0450bd0db1da74ae6243f0fbbed5c96d753 | sha256sum
# expected: 8fe3ab87dcf06432916764a06a623d25550b58cb11aab9d3da5e32c5e3953383

# 3) Create the annotated baseline tag on the target commit (NOT HEAD)
git tag -a baseline/BL-GATE3-20260821T161600Z 34edc0450bd0db1da74ae6243f0fbbed5c96d753 \
  -m "Gate 3 recovery baseline BL-GATE3-20260821T161600Z; export SHA-256 8fe3ab87dcf06432916764a06a623d25550b58cb11aab9d3da5e32c5e3953383; recovery objectives only; no deploy, no DNS, no origin change."

# 4) Verify the tag points at the target commit, then push the tag only
git rev-list -n 1 baseline/BL-GATE3-20260821T161600Z   # -> 34edc045...
git push origin refs/tags/baseline/BL-GATE3-20260821T161600Z

# 5) Local off-platform archive + hash (retain off GitHub)
git -c core.autocrlf=false -c core.eol=lf archive --format=tar.gz \
  -o BL-GATE3-20260821T161600Z.tar.gz \
  baseline/BL-GATE3-20260821T161600Z
sha256sum BL-GATE3-20260821T161600Z.tar.gz | tee BL-GATE3-20260821T161600Z.tar.gz.sha256
```

Prohibited in this step: no branch push, no merge, no `main` update, no publish/deploy, no DNS change, no `PUBLIC_SITE_ORIGIN` change, no T17-1/T17-10 migration.

## 4. GitHub UI steps (immutability)

1. Settings → Rules → Rulesets → New ruleset → New tag ruleset
   - Name: `baseline-tags-immutable`
   - Enforcement: Active
   - Target tags → Include by pattern: `baseline/*`
   - Rules: Restrict updates ✔ · Restrict deletions ✔ · Restrict creations (optional, add owner bypass if enabled)
   - Bypass list: empty
2. Settings → General → Releases → enable **Immutable releases** (if available on the plan).
3. Releases → Draft a new release
   - Tag: `baseline/BL-GATE3-20260821T161600Z` (existing tag — do not create a new one)
   - Title: `Gate 3 Recovery Baseline — BL-GATE3-20260821T161600Z`
   - Body: include commit SHA, tar SHA-256 from §2, and the line "Recovery objectives only. Not a deployment, rollback, or domain authorization."
   - Mark as latest: **No**. Pre-release: **No**.
   - Publish release (immutable).

## 5. Evidence-capture form (fill and return)

```
R1 EVIDENCE — GATE 3 IMMUTABLE CHECKPOINT
Executed by:            Joe Melendez
Execution timestamp:    ____-__-__T__:__:__Z (UTC)
Repository:             joemmyrealtor-dotcom/semantic-engine
Tag name:               baseline/BL-GATE3-20260821T161600Z
Tag object SHA:         ____________________________________
Tag -> commit SHA:      34edc0450bd0db1da74ae6243f0fbbed5c96d753   [confirm: Y/N]
git archive tar SHA-256: 8fe3ab87dcf06432916764a06a623d25550b58cb11aab9d3da5e32c5e3953383 [match: Y/N]

Tag ruleset name:       baseline-tags-immutable
Ruleset enforcement:    Active            [Y/N]
Pattern targeted:       baseline/*        [Y/N]
Restrict updates:       [Y/N]
Restrict deletions:     [Y/N]
Bypass list empty:      [Y/N]

Immutable releases enabled:  [Y/N/Not available on plan]
Release URL:            ____________________________________
Release marked latest:  No                [confirm: Y/N]
Release .tar.gz SHA-256: ___________________________________
Release .zip SHA-256:    ___________________________________

Off-platform archive location: _____________________________
Off-platform archive SHA-256:  _____________________________

Negative controls (must all be NO):
  main branch updated:            [N]
  merge or PR opened:             [N]
  publish/deploy performed:       [N]
  DNS record changed:             [N]
  PUBLIC_SITE_ORIGIN changed:     [N]
  T17-1 / T17-10 migration run:   [N]

Attachments: screenshot of tag ruleset, screenshot of published release.
```

## 6. Verification I will perform on return of evidence (read-only)

- Re-verify `34edc045` presence and tar SHA-256 in-sandbox.
- Confirm tag→commit binding and ruleset/release fields against this form.
- Update `docs/GATE-3-OWNER-DECISION-PACKET.md` §R1 to PASS and re-issue Gate 3 status.

## 7. Status after this record

Gate 3: PARTIAL · R1: APPROVED, TARGET CONFIRMED, UNEXECUTED · R2: PASS (M-1 open) · R3: ACCEPTED (2026-08-21T18:56:51Z) · 126-URL migration: NOT RUN · Production: BLOCKED
