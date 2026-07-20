// Server-authoritative launch-gate evidence.
//
// Client-imported: only handler bodies execute on the server. Import service-role
// client dynamically inside handlers per tanstack-supabase-import-graph.
//
// Contract:
// - `listGateEvidenceServer` — signed-in read, RLS enforced (workspace members only).
// - `attestGateServer` — the ONLY path that can create a PASS row for a hard gate.
//   Runs the verifier server-side and refuses PASS unless the verifier returns ok.
//   Enforces role gating and versioning; writes via service role because RLS blocks
//   client writes entirely (server-authoritative).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { LaunchGateId } from "@/lib/data/schema";

const AttestInput = z.object({
  gateId: z.enum(["H1", "H2", "H3", "H4"]),
  workspaceId: z.string().min(1),
  status: z.enum(["PASS", "BLOCKED-OPERATOR", "FAIL"]),
  reason: z.string().min(12, "Written reason must be at least 12 characters"),
  correlationId: z.string().min(1),
});

const ListInput = z.object({
  workspaceId: z.string().min(1),
  gateId: z.enum(["H1", "H2", "H3", "H4"]).optional(),
  activeOnly: z.boolean().optional(),
});

// DB `app_role` enum is legacy lowercase. Map hard-gate ownership by DB values.
type DbAppRole = "owner" | "editor" | "reviewer" | "contributor" | "viewer";
const HARD_GATE_DB_ROLES: Record<LaunchGateId, DbAppRole[]> = {
  H1: ["owner"],
  H2: ["owner"],
  H3: ["owner"],
  H4: ["owner"],
};


interface VerifierResult { passed: boolean; detail: string; verifier: string }

/** Server-side verifier — runs only inside handlers, reads process.env at call time. */
async function verifyGateServer(
  gateId: LaunchGateId,
  supabaseAdmin: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: unknown) => { limit: (n: number) => Promise<{ data: unknown[] | null }> };
      };
    };
  },
): Promise<VerifierResult> {
  const env = process.env;
  switch (gateId) {
    case "H1": {
      const adapter = (env.RATE_LIMIT_ADAPTER ?? "").toLowerCase();
      const passed = adapter === "supabase";
      return {
        passed,
        detail: passed
          ? "RATE_LIMIT_ADAPTER=supabase confirmed in runtime env"
          : `RATE_LIMIT_ADAPTER='${adapter || "unset"}' — must be 'supabase'`,
        verifier: "server:rate-limit-adapter",
      };
    }
    case "H2": {
      const flag = (env.SUPABASE_AUTH_GOOGLE_ENABLED ?? env.AUTH_GOOGLE_ENABLED ?? "").toLowerCase();
      const passed = flag === "true" || flag === "1";
      return {
        passed,
        detail: passed ? "Google provider flag ON" : "Google provider not flagged ON in runtime env",
        verifier: "server:oauth-google-env",
      };
    }
    case "H3": {
      // Placeholder: real check queries an api_clients table if/when persisted.
      // For now, treat as blocked unless env explicitly asserts rotation.
      const rotated = (env.API_BEARER_ROTATED ?? "").toLowerCase();
      const passed = rotated === "true" || rotated === "1";
      return {
        passed,
        detail: passed
          ? "API_BEARER_ROTATED confirmed in runtime env"
          : "API_BEARER_ROTATED not set — demo bearer presumed live",
        verifier: "server:api-client-env",
      };
    }
    case "H4": {
      // Presence-of-workspace probe as a minimal baseline signal.
      const { data } = await supabaseAdmin.from("workspaces").select("id").limit(1) as unknown as { data: unknown[] | null };
      const passed = Array.isArray(data) && data.length > 0;
      const declared = (env.BASELINE_BACKUP_ID ?? "").trim();
      const finalPassed = passed && declared.length > 0;
      return {
        passed: finalPassed,
        detail: finalPassed
          ? `Baseline backup id declared (${declared}) and workspaces reachable`
          : "BASELINE_BACKUP_ID not set OR workspaces table unreachable",
        verifier: "server:backup-baseline",
      };
    }
  }
}

function buildFingerprintServer(): string {
  const env = process.env;
  const material = [
    env.NODE_ENV ?? "",
    (env.RATE_LIMIT_ADAPTER ?? "").toLowerCase(),
    (env.SUPABASE_AUTH_GOOGLE_ENABLED ?? env.AUTH_GOOGLE_ENABLED ?? "").toLowerCase(),
    (env.API_BEARER_ROTATED ?? "").toLowerCase(),
    (env.BASELINE_BACKUP_ID ?? "").trim(),
  ].join("|");
  let h = 0;
  for (let i = 0; i < material.length; i++) h = (Math.imul(31, h) + material.charCodeAt(i)) | 0;
  return `srv-${(h >>> 0).toString(16).padStart(8, "0")}`;
}

// -------- listGateEvidenceServer --------
export const listGateEvidenceServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input))
  .handler(async ({ data, context }) => {
    // RLS-enforced read as the caller.
    let q = context.supabase
      .from("launch_gate_evidence")
      .select("id, gate_id, workspace_id, version, status, attested_by, attested_by_role, attested_at, reason, verifier, verifier_passed, verifier_detail, build_fingerprint, superseded_by, correlation_id")
      .eq("workspace_id", data.workspaceId)
      .order("version", { ascending: false });
    if (data.gateId) q = q.eq("gate_id", data.gateId);
    if (data.activeOnly) q = q.is("superseded_by", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(`listGateEvidence: ${error.message}`);
    return { rows: rows ?? [], generatedAt: new Date().toISOString() };
  });

// -------- attestGateServer --------
export const attestGateServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AttestInput.parse(input))
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    // 1) Membership check (as the caller, via RLS-enabled RPC).
    const { data: isMember } = await context.supabase.rpc("is_workspace_member", {
      _user_id: userId, _workspace_id: data.workspaceId,
    });
    if (!isMember) throw new Error("Forbidden: not a member of the target workspace");

    // 2) Fetch the caller's workspace role via RLS.
    const { data: roleRow } = await context.supabase.rpc("workspace_role", {
      _user_id: userId, _workspace_id: data.workspaceId,
    });
    const role = roleRow as Role | null;
    if (!role) throw new Error("Forbidden: no workspace role");
    if (!HARD_GATE_ROLES[data.gateId].includes(role)) {
      throw new Error(`Forbidden: role ${role} may not attest ${data.gateId}`);
    }

    // 3) Server-side verifier runs BEFORE write. PASS is refused unless verifier passes.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const verifier = await verifyGateServer(
      data.gateId,
      supabaseAdmin as unknown as Parameters<typeof verifyGateServer>[1],
    );
    if (data.status === "PASS" && !verifier.passed) {
      throw new Error(`Cannot attest ${data.gateId} as PASS: verifier failed — ${verifier.detail}`);
    }

    // 4) Compute next version by querying the active row (RLS via context.supabase is fine).
    const { data: activeRows } = await context.supabase
      .from("launch_gate_evidence")
      .select("id, version")
      .eq("workspace_id", data.workspaceId)
      .eq("gate_id", data.gateId)
      .is("superseded_by", null)
      .order("version", { ascending: false })
      .limit(1);
    const previous = (activeRows ?? [])[0] ?? null;
    const version = (previous?.version ?? 0) + 1;

    // 5) Insert new row via service role (client is blocked by RLS by design).
    const insertRow = {
      gate_id: data.gateId,
      workspace_id: data.workspaceId,
      version,
      status: data.status,
      attested_by: userId,
      attested_by_role: role,
      reason: data.reason.trim(),
      verifier: verifier.verifier,
      verifier_passed: verifier.passed,
      verifier_detail: verifier.detail,
      build_fingerprint: buildFingerprintServer(),
      correlation_id: data.correlationId,
    };
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("launch_gate_evidence")
      .insert(insertRow)
      .select("id")
      .single();
    if (insertErr || !inserted) {
      throw new Error(`attestGate insert failed: ${insertErr?.message ?? "no row returned"}`);
    }

    // 6) Supersede prior active row (append-only trigger permits this single field).
    if (previous) {
      const { error: supErr } = await supabaseAdmin
        .from("launch_gate_evidence")
        .update({ superseded_by: inserted.id })
        .eq("id", previous.id);
      if (supErr) throw new Error(`attestGate supersede failed: ${supErr.message}`);
    }

    return {
      ok: true,
      id: inserted.id,
      version,
      status: data.status,
      verifierPassed: verifier.passed,
      verifierDetail: verifier.detail,
    };
  });

// -------- computeReadinessServer (durable readiness snapshot) --------
export const computeReadinessServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const gateIds: LaunchGateId[] = ["H1", "H2", "H3", "H4"];
    const { data: rows, error } = await context.supabase
      .from("launch_gate_evidence")
      .select("gate_id, status, version, build_fingerprint, attested_at, attested_by, verifier_passed, verifier_detail")
      .eq("workspace_id", data.workspaceId)
      .is("superseded_by", null);
    if (error) throw new Error(`computeReadiness: ${error.message}`);
    const fp = buildFingerprintServer();
    const active = new Map<string, (typeof rows extends (infer T)[] | null ? T : never)>();
    for (const r of rows ?? []) active.set(r.gate_id, r);
    const gates = gateIds.map(id => {
      const row = active.get(id) ?? null;
      const stale = !!row && row.build_fingerprint !== fp;
      const status = stale ? "STALE" : (row?.status ?? "BLOCKED-OPERATOR");
      return { gateId: id, status, current: row, stale, buildFingerprint: fp };
    });
    const blocking = gates.filter(g => g.status !== "PASS").map(g => g.gateId);
    return {
      ready: blocking.length === 0,
      gates,
      blockingGateIds: blocking,
      buildFingerprint: fp,
      generatedAt: new Date().toISOString(),
    };
  });
