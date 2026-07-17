import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, KpiCard, SectionTitle, EmptyState } from "@/components/ui-kit";
import { useSnapshot } from "@/lib/use-snapshot";
import { verifyAuditChain, filterAudit, auditDiff } from "@/lib/data/audit";
import { AUDIT_ACTIONS, type AuditAction } from "@/lib/data/schema";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({ meta: [{ title: "Audit Explorer — Legacy Platform" }] }),
  component: AuditExplorer,
});

function AuditExplorer() {
  const s = useSnapshot();
  const [action, setAction] = useState<AuditAction | "">("");
  const [actor, setActor] = useState("");
  const [entityId, setEntityId] = useState("");
  const chain = useMemo(() => (s ? verifyAuditChain(s.auditEvents) : null), [s]);
  const events = useMemo(() => s ? filterAudit(s, { action: action || undefined, actor: actor || undefined, entityId: entityId || undefined }).slice().reverse() : [], [s, action, actor, entityId]);

  if (!s) return <LoadingState />;
  return (
    <>
      <PageHeader title="Audit Explorer" description="Immutable, hash-chained trail of governed actions." />
      <PageBody>
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <KpiCard label="Events" value={s.auditEvents.length} />
          <KpiCard label="Chain integrity" value={chain?.ok ? "OK" : "BROKEN"} tone={chain?.ok ? "evergreen" : "warn"} hint={chain?.ok ? "verified" : `at ${chain?.brokenAt}`} />
          <KpiCard label="Distinct actors" value={new Set(s.auditEvents.map(e => e.actor)).size} />
          <KpiCard label="Denied" value={s.auditEvents.filter(e => e.action === "permission-denied").length} tone="gold" />
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <select aria-label="Filter by audit action" value={action} onChange={e => setAction((e.target.value || "") as AuditAction | "")} className="border border-border rounded px-2 py-1 text-sm bg-background">
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <Input aria-label="Filter by actor" placeholder="Actor" value={actor} onChange={e => setActor(e.target.value)} className="w-40" />
          <Input aria-label="Filter by entity ID" placeholder="Entity ID" value={entityId} onChange={e => setEntityId(e.target.value)} className="w-40" />
        </div>
        <SectionTitle hint={`${events.length} events`}>Trail</SectionTitle>
        {events.length === 0 ? <EmptyState title="No audit events match" /> : (
          <div className="editorial-card divide-y divide-border">
            {events.slice(0, 200).map(e => (
              <div key={e.id} className="p-4 grid gap-2 md:grid-cols-[140px_1fr] text-sm">
                <div>
                  <div className="font-mono text-xs">{e.id}</div>
                  <div className="text-xs text-muted-foreground">{e.at.slice(0, 19).replace("T", " ")}</div>
                </div>
                <div>
                  <div><span className="font-medium">{e.actor}</span> <span className="text-xs text-muted-foreground">({e.actorRole})</span> · <span className="text-gold uppercase text-xs tracking-widest">{e.action}</span> · <span className="font-mono text-xs">{e.entityType}/{e.entityId}</span></div>
                  {e.reason && <div className="text-xs text-muted-foreground italic mt-1">{e.reason}</div>}
                  {(e.before || e.after) && (
                    <div className="mt-2 text-xs space-y-0.5">
                      {auditDiff(e.before, e.after).slice(0, 5).map(d => (
                        <div key={d.key} className="font-mono">
                          <span className="text-muted-foreground">{d.key}:</span>{" "}
                          <span className="text-destructive">{JSON.stringify(d.from)}</span>{" → "}
                          <span className="text-evergreen">{JSON.stringify(d.to)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
