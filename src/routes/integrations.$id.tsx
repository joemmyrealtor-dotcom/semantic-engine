// Workstream 8 follow-up — Integration Connection deep studio.
// Overview of a connection: provider, health, credentials (references only),
// webhooks, mappings, deliveries, and related run history.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, SectionTitle, EmptyState, KpiCard } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { IntegrationConnection } from "@/lib/data/schema";
import {
  emitWebhook, buildDomainEvent, integrationHealthSummary,
} from "@/lib/data/integrations";
import { usePatchSave } from "@/hooks/use-patch-save";
import { SaveIndicator } from "@/components/save-indicator";
import { AlertTriangle, CheckCircle2, PlayCircle, PauseCircle, RefreshCw, ShieldAlert, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/integrations/$id")({
  head: () => ({ meta: [{ title: "Integration Connection — Legacy Platform" }] }),
  component: IntegrationDetail,
});

function IntegrationDetail() {
  const { id } = Route.useParams();
  const s = useSnapshot();
  const navigate = useNavigate();

  const conn = s?.integrationConnections.find(c => c.id === id) ?? null;
  const { patch, state: saveState } = usePatchSave<IntegrationConnection>({
    save: async (p) => { if (conn) await Repo.update("integrationConnections", conn.id, { ...p, updatedAt: new Date().toISOString() }); },
  });

  const webhooks = useMemo(() => (s?.webhookEndpoints ?? []).filter(w => w.connectionId === id), [s, id]);
  const deliveries = useMemo(() => (s && webhooks.length)
    ? s.webhookDeliveries.filter(d => webhooks.some(w => w.id === d.endpointId))
    : [], [s, webhooks]);
  const mappings = useMemo(() => (s?.syncMappings ?? []).filter(m => m.connectionId === id), [s, id]);
  const imports = useMemo(() => (s?.importJobs ?? []).filter(j => j.connectionId === id), [s, id]);
  const packages = useMemo(() => (s?.deliveryPackages ?? []).filter(p => p.destinationConnectionIds.includes(id)), [s, id]);
  const runs = useMemo(() => (s?.deliveryRuns ?? []).filter(r => r.connectionId === id), [s, id]);
  const subs = useMemo(() => (s?.eventSubscriptions ?? []).filter(e => e.connectionId === id), [s, id]);
  const externalRefs = useMemo(() => (s?.externalReferences ?? []).filter(r => mappings.some(m => m.internalEntityId === r.internalEntityId)), [s, mappings]);

  if (!s) return <LoadingState />;
  if (!conn) return (
    <>
      <PageHeader title="Connection not found" description={`No connection with id ${id}.`} />
      <PageBody><Button onClick={() => navigate({ to: "/integrations" })}>Back to Integrations</Button></PageBody>
    </>
  );

  const setStatus = async (next: IntegrationConnection["status"]) => {
    await patch({ status: next });
    toast.success(`Connection ${next}.`);
  };

  const testConnection = async () => {
    // Safe test: does not use plaintext credentials; validates config only.
    const problems: string[] = [];
    if (!conn.baseUrl) problems.push("Missing base URL.");
    if (!conn.credentialReferences.length) problems.push("No credential reference bound.");
    if (conn.subscribedEvents.length === 0) problems.push("No subscribed events.");
    if (problems.length === 0) toast.success("Test OK — configuration surfaces are complete.");
    else toast.warning(`Test found ${problems.length} issue(s): ${problems[0]}`);
  };

  const replayLastFailed = async () => {
    const failed = deliveries.find(d => d.status === "failed");
    if (!failed) { toast.info("No failed deliveries to replay."); return; }
    const endpoint = webhooks.find(w => w.id === failed.endpointId)!;
    const evt = buildDomainEvent(s, {
      kind: failed.eventKind, entityType: "release", entityId: "REPLAY",
      actor: "operator", payload: { replayOf: failed.id },
    });
    const { delivery } = emitWebhook(s, endpoint, evt);
    if (delivery) {
      try {
        await Repo.auditedTransaction(
          { permission: "integration.manage", action: "webhook-replay", entityType: "webhookDelivery", entityId: delivery.id, reason: `replay of ${failed.id}` },
          s0 => ({ ...s0, webhookDeliveries: [...s0.webhookDeliveries, delivery] }),
        );
        toast.success(`Replayed as ${delivery.id} (${delivery.status}).`);
      } catch (e) { toast.error((e as Error).message); }
    }
  };

  const health = integrationHealthSummary(s);

  return (
    <>
      <PageHeader
        eyebrow={`${conn.id} · ${conn.provider}`}
        title={conn.name}
        description={conn.description || "Integration connection"}
        actions={
          <div className="flex items-center gap-2">
            <SaveIndicator saving={saveState.saving} dirty={saveState.dirty} error={saveState.error} lastSavedAt={saveState.lastSavedAt} onRetry={saveState.retry} />
            <Button variant="outline" size="sm" onClick={testConnection}><RefreshCw className="size-4 mr-1" />Test</Button>
            {conn.status === "active"
              ? <Button variant="outline" size="sm" onClick={() => setStatus("paused")}><PauseCircle className="size-4 mr-1" />Pause</Button>
              : <Button variant="outline" size="sm" onClick={() => setStatus("active")}><PlayCircle className="size-4 mr-1" />Activate</Button>}
            <Button variant="ghost" size="sm" onClick={replayLastFailed}>Replay failed delivery</Button>
          </div>
        }
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard label="Status" value={conn.status} hint={`Health: ${conn.health}`} />
          <KpiCard label="Success" value={String(conn.successCount)} hint={`${conn.failureCount} failures`} />
          <KpiCard label="Webhooks" value={String(webhooks.length)} hint={`${deliveries.filter(d => d.status === "failed").length} failed`} />
          <KpiCard label="Mappings" value={String(mappings.length)} hint={`${mappings.filter(m => m.status === "conflict").length} conflicts`} />
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-base">Overview</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <Row k="Provider" v={conn.provider} />
              <Row k="Environment" v={conn.environment} />
              <Row k="Base URL" v={conn.baseUrl} />
              <Row k="Owner / Steward" v={`${conn.owner} · ${conn.steward}`} />
              <Row k="Domain scope" v={conn.domainScope.join(", ") || "—"} />
              <Row k="Subscribed events" v={conn.subscribedEvents.join(", ") || "—"} />
              <Row k="Last sync" v={conn.lastSyncAt ?? "—"} />
              {conn.notes && <Row k="Notes" v={conn.notes} />}
              {conn.isDemo && <div className="flex items-start gap-2 text-xs text-gold"><AlertTriangle className="size-3.5 mt-0.5" />Local-demo connection — configuration is illustrative; nothing is transmitted externally.</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="size-4" />Credentials</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-2">
              <div className="text-muted-foreground">Only masked references are shown. Plaintext values are never stored or displayed.</div>
              {conn.credentialReferences.length === 0 && <EmptyState title="No credentials bound" description="Add one before enabling delivery." />}
              {conn.credentialReferences.map(cred => (
                <div key={cred.id} className="rounded border border-border p-2">
                  <div className="font-mono text-[10px] text-heritage">{cred.id}</div>
                  <div className="font-medium">{cred.label}</div>
                  <div className="text-muted-foreground">Kind: {cred.kind}</div>
                  <div className="text-muted-foreground">Preview: <span className="font-mono">{cred.maskedPreview}</span></div>
                  <div className="text-muted-foreground">Rotated: {cred.rotatedAt ?? "never"}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 mt-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Webhooks & Deliveries</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              {webhooks.length === 0 && <EmptyState title="No webhook endpoints" />}
              {webhooks.map(w => {
                const wd = deliveries.filter(d => d.endpointId === w.id);
                return (
                  <div key={w.id} className="rounded border border-border p-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-mono text-[10px] text-heritage">{w.id}</div>
                        <div className="font-medium">{w.description}</div>
                        <div className="text-muted-foreground">{w.url}</div>
                      </div>
                      <Badge variant={w.enabled ? "default" : "outline"}>{w.enabled ? "enabled" : "disabled"}</Badge>
                    </div>
                    <div className="mt-2 space-y-1">
                      {wd.slice(0, 5).map(d => (
                        <div key={d.id} className="flex items-center justify-between text-[11px]">
                          <span className="font-mono">{d.id} · {d.eventKind}</span>
                          <Badge variant="outline" className={d.status === "delivered" ? "text-evergreen" : d.status === "failed" ? "text-destructive" : ""}>{d.status}</Badge>
                        </div>
                      ))}
                      {wd.length === 0 && <div className="text-muted-foreground">No deliveries yet.</div>}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Sync Mappings</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              {mappings.length === 0 && <EmptyState title="No mappings" />}
              {mappings.map(m => (
                <div key={m.id} className="rounded border border-border p-2">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-[10px] text-heritage">{m.id}</div>
                    <Badge variant="outline" className={m.status === "conflict" ? "text-destructive" : "text-evergreen"}>{m.status}</Badge>
                  </div>
                  <div>{m.internalEntityKind}:{m.internalEntityId} ↔ {m.externalId}</div>
                  {m.conflictReason && <div className="text-destructive">{m.conflictReason}</div>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Imports</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              {imports.length === 0 && <EmptyState title="No imports through this connection" />}
              {imports.map(j => (
                <div key={j.id} className="rounded border border-border p-2 flex items-center justify-between">
                  <span className="font-mono">{j.id} · {j.packageName}</span>
                  <Badge variant="outline">{j.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Delivery Packages & Runs</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              {packages.length === 0 && <EmptyState title="No packages routed here" />}
              {packages.map(p => {
                const rr = runs.filter(r => r.packageId === p.id);
                return (
                  <div key={p.id} className="rounded border border-border p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono">{p.id} · {p.title}</span>
                      <Badge variant="outline">{p.version}</Badge>
                    </div>
                    {rr.map(r => (
                      <div key={r.id} className="flex items-center justify-between text-[11px] mt-1">
                        <span className="font-mono">{r.id}</span>
                        <Badge variant="outline" className={r.status === "delivered" ? "text-evergreen" : r.status === "failed" ? "text-destructive" : ""}>{r.status}</Badge>
                      </div>
                    ))}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Event Subscriptions</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              {subs.length === 0 && <EmptyState title="No subscriptions" />}
              {subs.map(sub => (
                <div key={sub.id} className="rounded border border-border p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono">{sub.id}</span>
                    <Badge variant="outline">{sub.enabled ? "enabled" : "off"}</Badge>
                  </div>
                  <div>{sub.name}</div>
                  <div className="text-muted-foreground">Events: {sub.events.join(", ")}</div>
                  <div className="text-muted-foreground">Matched: {sub.matchCount}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">External References</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              {externalRefs.length === 0 && <div className="text-muted-foreground">No external references share entities with this connection's mappings.</div>}
              {externalRefs.map(r => (
                <div key={r.id} className="rounded border border-border p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono">{r.id}</span>
                    <a href={r.externalUrl} target="_blank" rel="noreferrer" className="text-heritage inline-flex items-center gap-1"><ExternalLink className="size-3" />open</a>
                  </div>
                  <div>{r.label}</div>
                  <div className="text-muted-foreground">→ {r.internalEntityKind}:{r.internalEntityId}</div>
                  {r.orphaned && <div className="text-destructive">Orphaned</div>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          Related integration health: {health.syncConflicts} sync conflicts across the platform, {health.orphanedReferences.length} orphaned references.{" "}
          <Link to="/integrations" className="underline">Back to Integrations</Link>
        </div>
      </PageBody>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right break-all">{v}</span>
    </div>
  );
}
