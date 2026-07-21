
# Read-only diagnostic — Runtime fingerprint (`srv-xxxxxxxx`)

Source-only investigation. No files, secrets, schema, or runtime touched.

## 1. Where the fingerprint is computed

Two implementations exist. Only the **server** one produces the `srv-xxxxxxxx` format seen in attestation drift messages (srv-8e22e90b, srv-a0840ca6).

- **Authoritative (server)** — `src/lib/launch-gates.functions.ts:129-141`
  - Function: `buildFingerprintServer()`
  - Runs inside the `computeReadinessServer` / `attestGateServer` handlers on the Cloudflare Worker.
  - Format: `srv-${(djb2(material) >>> 0).toString(16).padStart(8, "0")}` → matches the `srv-...` strings in the messages.
  - Persisted per attestation as `launch_gate_evidence.build_fingerprint` (`src/lib/launch-gates.functions.ts:224`).
  - Drift check: `src/lib/launch-gates.functions.ts:268-290` — `fingerprintDrift = row.build_fingerprint !== fp` → marks the gate `STALE` with `Build fingerprint changed (old → new)`.

- **Client-side echo (not used for `srv-` labels)** — `src/lib/data/launch-gates.ts:63-72`
  - Function: `computeBuildFingerprint(env, snap)` → 16-char content hash (no `srv-` prefix). Used by the in-browser `computeGateState` view (`launch-gates.ts:204-219`). Different format, different inputs. Not the value stored in `launch_gate_evidence`.

## 2. Inputs included in the authoritative server fingerprint

`buildFingerprintServer` — `src/lib/launch-gates.functions.ts:130-137` — reads only these `process.env` keys, joined by `|`:

1. `NODE_ENV`
2. `RATE_LIMIT_ADAPTER` (lowercased)
3. `SUPABASE_AUTH_GOOGLE_ENABLED` **or** `AUTH_GOOGLE_ENABLED` fallback (lowercased)
4. `API_BEARER_ROTATED` (lowercased)
5. `BASELINE_BACKUP_ID` (trimmed)

Not included: git SHA, build hash, bundle checksum, deploy id, schema version, api_client count, workspace count, or any code artefact input. The client-side `computeBuildFingerprint` additionally reads `SCHEMA_VERSION`, `workspaces.length`, `apiClients.length` — but those never reach the persisted `srv-` value.

## 3. Which inputs differ between preview and published production

Given the five inputs above, any of these differences between the preview Worker and the published Worker will change the fingerprint:

- `NODE_ENV`: preview typically runs with a different value than the published Worker (`development` / `preview` vs `production`). This alone flips the fingerprint on every publish.
- `RATE_LIMIT_ADAPTER`: was set to `supabase` earlier this session — if the published environment doesn't inherit the same setting it will differ.
- `SUPABASE_AUTH_GOOGLE_ENABLED` / `AUTH_GOOGLE_ENABLED`: only `AUTH_GOOGLE_ENABLED` was set as a project secret; if managed injection differs by environment, this differs too.
- `API_BEARER_ROTATED`: shared secret, should match — but any per-env rotation flag would diverge.
- `BASELINE_BACKUP_ID`: set as a project secret; matches only if published env receives the same secret.

Empirically: srv-8e22e90b (post-remediation preview) → srv-a0840ca6 (published) — a djb2 delta of any of the five inputs is sufficient to produce that transition. The most likely dominant contributor is `NODE_ENV`.

## 4. What the fingerprint is *intended* to identify

Reading the material list: it is **not** a build artefact fingerprint (no code / bundle / schema / commit hash). It is a **runtime configuration fingerprint** — specifically the subset of env-driven policy inputs the H1–H4 verifiers depend on.

Consequence: attestations are re-validated when *runtime configuration* changes, not when the *build* changes. A pure code redeploy that keeps the five env inputs identical will not change the fingerprint; a pure config change (e.g. flipping `RATE_LIMIT_ADAPTER`) with no code change will.

The name `buildFingerprint` (in schema, DB column, and messages) misdescribes what it actually captures.

## 5. Are preview attestations expected to become STALE after every production publish?

Yes, by current design, whenever preview and published Workers differ on any of the five inputs. In this project's Lovable Cloud topology:

- Preview runtime and production runtime are separate Workers with potentially different managed env values (notably `NODE_ENV`).
- Any attestation captured against the preview fingerprint will be marked `STALE` by `computeReadinessServer` when re-evaluated against the production fingerprint (`launch-gates.functions.ts:282-290`).

So the "H1–H4 PASS on srv-8e22e90b → STALE on srv-a0840ca6 after publish" behaviour observed during the smoke check is the **designed** outcome, not a bug in the drift logic. It is only surprising because the fingerprint is labelled as a *build* fingerprint while behaving as a *runtime config* fingerprint that necessarily diverges across environments.

## 6. Smallest safe remediation options, ranked (no changes applied)

Ranked by ratio of correctness gained to change surface:

1. **No code change — operate the process around the semantics.**
   Treat H1–H4 attestation as a *per-runtime-config* operation. Publish first, capture the resulting production fingerprint, then attest H1–H4 against the production Worker. Preview attestations are informational only. Zero risk; matches current implementation exactly. See §7.

2. **Rename the column/label from `buildFingerprint` to `runtimeConfigFingerprint`** in UI copy only (no schema migration). Reduces future operator confusion. Small doc/UI edit, no logic change.

3. **Exclude `NODE_ENV` from the fingerprint material.** One-line change in `launch-gates.functions.ts:132`. Makes preview and production converge when the other four inputs match, so a preview attestation can survive a publish that changes nothing else. Slight loss of strictness: an env-mode flip wouldn't force re-attest. Requires re-attest of all currently active evidence (their old fingerprints become unreachable).

4. **Make the fingerprint a true build artefact hash.** Replace the env material with a build-time constant (e.g. Vite `define` injected git SHA / build id) surfaced through `process.env.BUILD_ID`. Preview and production attestations would then agree whenever the same build is deployed to both. Larger change: needs a build-time env plumbing decision, and the semantic of H1–H4 stops covering env drift entirely — separate drift detection would have to be added back for `RATE_LIMIT_ADAPTER`, `AUTH_GOOGLE_ENABLED`, `API_BEARER_ROTATED`, `BASELINE_BACKUP_ID`.

5. **Split the fingerprint into `buildId` + `configHash` stored as two columns.** Cleanest long-term shape, biggest change (migration + verifier + UI). Not recommended unless #3 or #4 prove insufficient.

Recommendation if any code change is authorized: **#3 first, then optionally #2**. If the intent is "attest once per build, ignore env-config", do #4 instead of #3. Do not do #5 without an explicit request.

## 7. Recommended launch sequence with no code change

Given §5 and §6, and the fact that this is the designed behaviour:

1. Confirm production runtime is correctly bound (Connectors → Lovable Cloud) and that the operator-required env vars are injected — this is the outstanding blocker from the earlier report, not a fingerprint issue.
2. Publish the current build. This produces a stable **production** `srv-xxxxxxxx` fingerprint.
3. Read `computeReadinessServer` (or the admin/deployment gate strip) against the production URL to capture the exact production fingerprint value.
4. Re-run the H1–H4 verifiers against that production fingerprint (all four are pure env/database checks; they will pass in production if the same secrets are present).
5. Attest H1, H2, H3, H4 in production against the newly captured production fingerprint. Evidence rows are per-environment; the preview evidence is not reused.
6. Run smoke checks against the published URL. On green, the production compute gate unlocks against the production fingerprint.
7. Retain preview evidence (v-N on srv-8e22e90b) as historical record only. Retain rollback baseline `BL-20260721T165326Z-postremediation` / `5c0a…dee2`.

Under this sequence there is no expectation of preview→production fingerprint equality, and no code change is required.

## Files referenced

- `src/lib/launch-gates.functions.ts:129-141` — authoritative `srv-` fingerprint
- `src/lib/launch-gates.functions.ts:220-306` — attestation persist + drift detection
- `src/lib/data/launch-gates.ts:62-72` — client-side echo (different format, not persisted)
- `src/lib/data/launch-gates.ts:193-220` — client `computeGateState` drift check
- `src/components/launch-gates-panel.tsx:37-195` — UI surfacing of `build_fingerprint`
- `src/integrations/supabase/types.ts:435-471` — `launch_gate_evidence.build_fingerprint` column

Report only. No remediation queued. Awaiting direction.
