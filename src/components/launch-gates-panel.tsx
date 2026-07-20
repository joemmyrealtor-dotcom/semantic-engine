// Server-authoritative launch-gate panel.
//
// Reads state exclusively from `computeReadinessServer` — the ONLY
// authoritative source of hard-gate PASS / unlock / cutover readiness.
// If the server call fails (e.g. unauthenticated preview / E2E without a
// real Supabase session), the panel enters "diagnostic-only" mode: it
// displays a prominent banner, refuses to unlock the promote button, and
// treats every gate as BLOCKED.
//
// Attestation is exclusively through `attestGateServer`. Local IndexedDB
// evidence is never authoritative here; the deployment page renders it
// separately under a "diagnostic" heading.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { currentCan } from "@/lib/data/auth";
import {
  computeReadinessServer, attestGateServer,
} from "@/lib/launch-gates.functions";
import { LAUNCH_GATE_DEFINITIONS, HARD_GATE_IDS } from "@/lib/data/launch-gates";
import type { LaunchGateId } from "@/lib/data/schema";

interface ServerGate {
  gateId: LaunchGateId;
  status: "PASS" | "BLOCKED-OPERATOR" | "FAIL" | "STALE";
  current: {
    version: number; status: string; attested_by: string;
    attested_at: string; build_fingerprint: string; reason?: string;
    verifier_passed?: boolean; verifier_detail?: string;
  } | null;
  stale: boolean;
  staleReason?: string;
  verifier: { passed: boolean; detail: string; verifier: string };
  buildFingerprint: string;
}

interface ServerReadiness {
  ready: boolean;
  gates: ServerGate[];
  blockingGateIds: LaunchGateId[];
  staleGateIds: LaunchGateId[];
  buildFingerprint: string;
  generatedAt: string;
}

export function useAuthoritativeReadiness(workspaceId: string) {
  const compute = useServerFn(computeReadinessServer);
  return useQuery<ServerReadiness>({
    queryKey: ["launch-gate-readiness", workspaceId],
    queryFn: () => compute({ data: { workspaceId } }) as Promise<ServerReadiness>,
    staleTime: 15_000,
    retry: false,
  });
}

interface Props {
  workspaceId: string;
  showAttestControls?: boolean;
}

export function AuthoritativeGatesPanel({ workspaceId, showAttestControls = true }: Props) {
  const q = useAuthoritativeReadiness(workspaceId);
  const canAttest = currentCan("maintenance.manage");

  const authoritative = !q.isError && !!q.data;
  const gates: ServerGate[] = useMemo(() => {
    if (q.data) return q.data.gates;
    // Fallback (no server session available) — treat every gate BLOCKED.
    return HARD_GATE_IDS.map<ServerGate>(id => ({
      gateId: id,
      status: "BLOCKED-OPERATOR",
      current: null,
      stale: false,
      verifier: { passed: false, detail: "Server verifier not reachable", verifier: "server:unreachable" },
      buildFingerprint: "unknown",
    }));
  }, [q.data]);

  const allPass = authoritative && q.data!.ready;

  return (
    <div data-testid="authoritative-gates-panel">
      <div className="editorial-card p-4 text-sm mb-4" role="status" aria-live="polite">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
          Production GO:{" "}
          <span className={allPass ? "text-evergreen" : "text-destructive"} data-testid="launch-lock-state">
            {allPass ? "UNLOCKED" : "LOCKED — hard gates open"}
          </span>
          <span
            className={"ml-3 px-1.5 py-0.5 rounded text-[10px] font-semibold " + (authoritative ? "bg-evergreen text-white" : "bg-destructive text-white")}
            data-testid="authoritative-source-badge"
          >
            {authoritative ? "AUTHORITATIVE · server" : "DIAGNOSTIC ONLY · server unreachable"}
          </span>

        </div>
        <div className="text-xs text-muted-foreground">
          Production cutover is blocked while any hard gate below is not PASS.
          {" "}Authoritative state comes from{" "}
          <code>computeReadinessServer</code>; browser-local evidence is never used to unlock.
          {q.isError && (
            <div className="mt-1 text-destructive" data-testid="authoritative-error">
              Server error: {(q.error as Error)?.message ?? "unknown"}
            </div>
          )}
        </div>
      </div>

      <div className="editorial-card divide-y divide-border text-sm" data-testid="hard-gates">
        {gates.map(g => (
          <ServerGateRow
            key={g.gateId} gate={g} workspaceId={workspaceId}
            authoritative={authoritative} canAttest={canAttest && showAttestControls}
            onChanged={() => q.refetch()}
          />
        ))}
        <div className="p-3">
          <Button
            size="sm" variant="outline"
            disabled={!allPass} aria-disabled={!allPass}
            data-testid="promote-production"
            title={allPass ? "All hard gates PASS (server-authoritative)" : "Locked while any hard gate is not PASS"}
          >
            Promote to production {allPass ? "" : "(locked)"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ServerGateRow({
  gate, workspaceId, authoritative, canAttest, onChanged,
}: {
  gate: ServerGate; workspaceId: string; authoritative: boolean;
  canAttest: boolean; onChanged: () => void;
}) {
  const attest = useServerFn(attestGateServer);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const def = LAUNCH_GATE_DEFINITIONS[gate.gateId];

  const statusTone =
    gate.status === "PASS" ? "text-evergreen"
    : gate.status === "FAIL" ? "text-destructive"
    : gate.status === "STALE" ? "text-destructive/80"
    : "text-gold";

  const submit = async (status: "PASS" | "BLOCKED-OPERATOR" | "FAIL") => {
    setBusy(true);
    try {
      await attest({ data: {
        gateId: gate.gateId, workspaceId, status, reason,
        correlationId: `attest-${gate.gateId}-${Date.now()}`,
      } });
      toast.success(`Recorded ${gate.gateId} = ${status}`);
      setReason(""); setOpen(false);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="p-3" data-testid={`gate-${gate.gateId}`}>
      <div className="flex items-center justify-between mb-1">
        <div>
          <span className="font-mono text-xs text-muted-foreground mr-2">{gate.gateId}</span>
          <span className="font-medium">{def.name}</span>
          <span className="text-xs text-muted-foreground ml-2">· {def.owner}</span>
        </div>
        <span className={`text-xs uppercase tracking-widest ${statusTone}`} data-testid={`gate-${gate.gateId}-status`}>
          {gate.status}
        </span>
      </div>
      <div className="text-xs text-muted-foreground pl-6 space-y-1">
        <div><span className="uppercase tracking-widest text-[10px] mr-1">Requirement:</span>{def.evidenceRequirement}</div>
        <div>
          <span className="uppercase tracking-widest text-[10px] mr-1">Verifier:</span>
          <span className={gate.verifier.passed ? "text-evergreen" : "text-destructive"}>
            {gate.verifier.passed ? "OK" : "FAIL"}
          </span>
          <span className="ml-2 font-mono">{gate.verifier.verifier}</span>
          <span className="ml-2">{gate.verifier.detail}</span>
        </div>
        {gate.current ? (
          <div>
            <span className="uppercase tracking-widest text-[10px] mr-1">Evidence:</span>
            v{gate.current.version} · {gate.current.status} · by {gate.current.attested_by}
            <span className="ml-2">· {new Date(gate.current.attested_at).toLocaleString()}</span>
            <span className="ml-2 font-mono">fp:{gate.current.build_fingerprint}</span>
          </div>
        ) : (
          <div><span className="uppercase tracking-widest text-[10px] mr-1">Evidence:</span>none captured</div>
        )}
        {gate.stale && (
          <div className="text-destructive/80" data-testid={`gate-${gate.gateId}-stale`}>
            <span className="uppercase tracking-widest text-[10px] mr-1">Stale:</span>{gate.staleReason || "regressed"}
          </div>
        )}
      </div>

      <div className="mt-2 pl-6">
        {!authoritative ? (
          <div className="text-xs text-muted-foreground" data-testid={`gate-${gate.gateId}-unauth`}>
            Server unreachable — attestation disabled.
          </div>
        ) : !canAttest ? (
          <div className="text-xs text-muted-foreground" data-testid={`gate-${gate.gateId}-denied`}>
            Your role lacks <code>maintenance.manage</code>; attesting is disabled.
          </div>
        ) : !open ? (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)} data-testid={`gate-${gate.gateId}-attest-open`}>
            Record evidence
          </Button>
        ) : (
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-muted-foreground" htmlFor={`reason-${gate.gateId}`}>
              Written reason (≥ 12 chars)
            </label>
            <textarea
              id={`reason-${gate.gateId}`}
              value={reason} onChange={e => setReason(e.target.value)}
              rows={2}
              className="w-full text-sm border border-border rounded px-2 py-1 bg-background"
              data-testid={`gate-${gate.gateId}-reason`}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy || reason.trim().length < 12} onClick={() => submit("PASS")} data-testid={`gate-${gate.gateId}-attest-pass`}>
                Attest PASS
              </Button>
              <Button size="sm" variant="outline" disabled={busy || reason.trim().length < 12} onClick={() => submit("BLOCKED-OPERATOR")}>
                Mark BLOCKED
              </Button>
              <Button size="sm" variant="outline" disabled={busy || reason.trim().length < 12} onClick={() => submit("FAIL")}>
                Mark FAIL
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setReason(""); }}>Cancel</Button>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Verifier <span className="font-mono">{gate.verifier.verifier}</span> must PASS server-side to record status PASS.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
