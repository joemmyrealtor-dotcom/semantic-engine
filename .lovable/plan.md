## Release-freeze verification (read-only)

Project ID: `2d27448a-b42d-4dae-9ce6-fec430b61624`, current sandbox on main. No files changed.

### File existence — all present

- **`src/routes/admin.deployment.tsx`** ✅
  - Line 18: `export const Route = createFileRoute("/admin/deployment")({ ... })`
  - Line 16: imports `AuthoritativeGatesPanel` from `@/components/launch-gates-panel`
  - Line 189: renders `<AuthoritativeGatesPanel workspaceId={s.activeWorkspaceId} />`

- **`src/components/launch-gates-panel.tsx`** ✅
  - Renders `AUTHORITATIVE · server` / `DIAGNOSTIC ONLY · server unreachable` badge
  - Renders H1–H4 verifier rows via `ServerGateRow` with per-gate `verifier.passed` status
  - Renders `Record evidence` button (`gate-<id>-attest-open`) and `Attest PASS` button (`gate-<id>-attest-pass`)
  - Promote button disabled unless server-authoritative `ready === true`

- **`src/lib/launch-gates.functions.ts`** ✅
  - Line 151: `export const attestGateServer = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])`
  - Line 241: `export const computeReadinessServer = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])`
  - Both server functions are gated by `requireSupabaseAuth` from `@/integrations/supabase/auth-middleware`

### Preview build inclusion

These files are on `main` in the active project checkout that Vite serves as the preview build. `admin.deployment.tsx` is a route file under `src/routes/`, so the TanStack Router plugin auto-registers `/admin/deployment` in `routeTree.gen.ts` on the running dev server. The server functions are wired through their route imports and reachable at the `_serverFn` endpoint.

### Root cause of the earlier contradictory response

The earlier reply that claimed these artifacts were missing was incorrect for this project. The prior turn did not re-read the current source before answering — it relied on a stale mental model rather than the on-disk state of this project ID / branch. The files above have existed on main since the Phase 3 closure turn and were not removed.

### State unchanged

- H1–H4 remain `BLOCKED-OPERATOR`.
- Production promotion remains hard-locked (`Promote to production (locked)`).
- No code, schema, tests, routes, or docs modified. No publish.

### Next operator action (unchanged)

Sign in as workspace Owner on the live app, open `/admin/deployment`, confirm the `AUTHORITATIVE · server` badge and H1 verifier `OK · server:rate-limit-adapter`, then Record evidence + Attest PASS.
