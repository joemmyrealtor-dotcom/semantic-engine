import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, KpiCard, SectionTitle, EmptyState } from "@/components/ui-kit";
import { useSnapshot, Repo } from "@/lib/use-snapshot";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  integrationHealthSummary, emitWebhook, buildDomainEvent, newExportJob,
  validateImportPackage,
} from "@/lib/data/integrations";
import { AlertTriangle, CheckCircle2, Plug, RefreshCw, Send, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/integrations")({
  head: () => ({ meta: [
    { title: "Integrations — Legacy Platform" },
    { name: "description", content: "Connectors, webhooks, imports, exports, and delivery packages." },
  ] }),
  component: IntegrationsHub,
});

function IntegrationsHub() {
  const s = useSnapshot();
  const health = useMemo(() => s ? integrationHealthSummary(s) : null, [s]);
  if (!s || !health) return <LoadingState />;

  return (
    <>
      <PageHeader
        eyebrow="Workstream 8"
        title="Integrations & Delivery"
        description="Governed connectors, event bus, webhooks, imports, and delivery packages. All demo connectors are clearly labeled — no production credentials are stored locally."
        
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Connections" value={String(health.connections.total)} hint={`${health.connections.failing} failing · ${health.connections.degraded} degraded`} />
          <KpiCard label="Webhook Endpoints" value={String(health.webhooks.endpoints)} hint={`${health.webhooks.failedDeliveries} failed deliveries`} />
          <KpiCard label="Sync Conflicts" value={String(health.syncConflicts)} hint={`${health.staleMappings.length} stale mappings`} />
          <KpiCard label="Orphaned Refs" value={String(health.orphanedReferences.length)} hint="External references without canonical target" />
        </div>

        <Tabs defaultValue="connections" className="mt-6">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="imports">Imports</TabsTrigger>
            <TabsTrigger value="exports">Exports</TabsTrigger>
            <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
            <TabsTrigger value="mappings">Mappings</TabsTrigger>
            <TabsTrigger value="api-clients">API Clients</TabsTrigger>
          </TabsList>

          <TabsContent value="connections" className="mt-4"><ConnectionsPanel /></TabsContent>
          <TabsContent value="webhooks" className="mt-4"><WebhooksPanel /></TabsContent>
          <TabsContent value="events" className="mt-4"><EventsPanel /></TabsContent>
          <TabsContent value="imports" className="mt-4"><ImportsPanel /></TabsContent>
          <TabsContent value="exports" className="mt-4"><ExportsPanel /></TabsContent>
          <TabsContent value="deliveries" className="mt-4"><DeliveriesPanel /></TabsContent>
          <TabsContent value="mappings" className="mt-4"><MappingsPanel /></TabsContent>
          <TabsContent value="api-clients" className="mt-4"><ApiClientsPanel /></TabsContent>
        </Tabs>

        <div className="mt-8 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-400">
            <ShieldAlert className="size-4" />
            Local demo boundary
          </div>
          <p className="mt-1 text-muted-foreground">
            Plaintext credentials, API keys, and webhook signing secrets are never stored in local snapshot,
            source code, seed data, logs, or UI state. Only masked references are shown. Real delivery,
            webhook egress, and OAuth token exchange require a production secret manager.
          </p>
        </div>
      </PageBody>
    </>
  );
}

function ConnectionsPanel() {
  const s = useSnapshot()!;
  if (!s.integrationConnections.length) return <EmptyState title="No connections" />;
  return (
    <div className="grid gap-3">
      {s.integrationConnections.map(c => (
        <Card key={c.id}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">
                {c.name}{" "}
                {c.isDemo && <Badge variant="secondary" className="ml-2 text-[10px]">DEMO</Badge>}
              </CardTitle>
              <div className="text-xs text-muted-foreground mt-1">
                {c.id} · {c.provider} · {c.environment} · owner {c.owner}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <HealthBadge health={c.health} />
              <Badge variant="outline">{c.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="text-muted-foreground mb-2">{c.description}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div><div className="text-muted-foreground">Success</div>{c.successCount}</div>
              <div><div className="text-muted-foreground">Failures</div>{c.failureCount}</div>
              <div><div className="text-muted-foreground">Events</div>{c.subscribedEvents.length}</div>
              <div><div className="text-muted-foreground">Credentials</div>{c.credentialReferences.length}</div>
            </div>
            {c.credentialReferences.length > 0 && (
              <div className="mt-3 text-xs">
                <div className="text-muted-foreground mb-1">Credential references (masked)</div>
                {c.credentialReferences.map(cr => (
                  <div key={cr.id} className="font-mono">{cr.label}: {cr.maskedPreview} <span className="text-muted-foreground">({cr.storageLocation})</span></div>
                ))}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => toast.success(`Connection test simulated for ${c.id}`)}><RefreshCw className="size-3 mr-1" /> Test</Button>
              <Button size="sm" variant="ghost" onClick={() => toast.info(`Connection ${c.id} paused (local demo)`)}>Pause</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function HealthBadge({ health }: { health: string }) {
  const map: Record<string, string> = {
    healthy: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    degraded: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    failing: "bg-red-500/10 text-red-600 border-red-500/30",
    unknown: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={map[health] ?? ""}>{health}</Badge>;
}

function WebhooksPanel() {
  const s = useSnapshot()!;
  const [sending, setSending] = useState(false);

  const sendTest = async (endpointId: string) => {
    setSending(true);
    try {
      const endpoint = s.webhookEndpoints.find(w => w.id === endpointId)!;
      const event = buildDomainEvent(s, {
        kind: endpoint.events[0] ?? "asset.stage_changed",
        entityType: "test", entityId: "test-entity", actor: "operator",
        payload: { test: true },
      });
      const r = emitWebhook(s, endpoint, event);
      if (r.skipped) { toast.warning(`Skipped: ${r.skipped}`); return; }
      if (!r.delivery) return;
      const delivery = r.delivery;
      await Repo.auditedTransaction(
        { permission: "integration.manage", action: "webhook-send", entityType: "webhookEndpoint", entityId: endpoint.id, reason: "manual test" },
        s0 => ({ ...s0, domainEvents: [...s0.domainEvents, event], webhookDeliveries: [...s0.webhookDeliveries, delivery] }),
      );
      toast.success(`Test delivery ${delivery.status}`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSending(false); }
  };

  const replay = async (deliveryId: string) => {
    const d = s.webhookDeliveries.find(x => x.id === deliveryId)!;
    const endpoint = s.webhookEndpoints.find(w => w.id === d.endpointId);
    if (!endpoint) return;
    const now = new Date().toISOString();
    const nextAttempt = d.attempts.length + 1;
    const attempts = [...d.attempts, {
      attempt: nextAttempt, at: now, status: "delivered" as const,
      httpStatus: 200, responseSummary: "ok (replay simulated)", errorMessage: null, durationMs: 100,
    }];
    const updated = { ...d, attempts, status: "delivered" as const, updatedAt: now };
    await Repo.update("webhookDeliveries", d.id, updated);
    toast.success(`Replayed ${d.id}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Endpoints</SectionTitle>
        <div className="grid gap-3">
          {s.webhookEndpoints.map(w => (
            <Card key={w.id}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">{w.description}</CardTitle>
                  <div className="text-xs text-muted-foreground mt-1 font-mono">{w.id} → {w.url}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={w.enabled ? "default" : "secondary"}>{w.enabled ? "enabled" : "disabled"}</Badge>
                  <Button size="sm" variant="outline" disabled={sending} onClick={() => sendTest(w.id)}>
                    <Send className="size-3 mr-1" /> Test
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Events: {w.events.join(", ")} · signature: {w.signatureAlgorithm} · retries: {w.retryPolicy.maxAttempts}
                {w.signingSecretRef && <span className="ml-2">· secret ref: <span className="font-mono">{w.signingSecretRef}</span></span>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <div>
        <SectionTitle>Recent deliveries</SectionTitle>
        <div className="grid gap-2">
          {s.webhookDeliveries.map(d => (
            <div key={d.id} className="rounded-md border p-3 text-xs flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono">{d.id} · {d.eventKind}</div>
                <div className="text-muted-foreground truncate">{d.redactedPayloadPreview}</div>
                <div className="text-muted-foreground mt-1">{d.attempts.length} attempt(s) · idempotency <span className="font-mono">{d.idempotencyKey}</span></div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <DeliveryBadge status={d.status} />
                {d.status === "failed" && <Button size="sm" variant="outline" onClick={() => replay(d.id)}>Replay</Button>}
              </div>
            </div>
          ))}
          {s.webhookDeliveries.length === 0 && <EmptyState title="No deliveries yet" />}
        </div>
      </div>
    </div>
  );
}

function DeliveryBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    delivered: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    failed: "bg-red-500/10 text-red-600 border-red-500/30",
    pending: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    retrying: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    "skipped-duplicate": "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={map[status] ?? ""}>{status}</Badge>;
}

function EventsPanel() {
  const s = useSnapshot()!;
  if (!s.domainEvents.length) return <EmptyState title="No events emitted" />;
  return (
    <div className="grid gap-2">
      {s.domainEvents.slice().reverse().map(e => (
        <div key={e.id} className="rounded-md border p-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="font-mono">{e.id} · {e.kind}</div>
            <div className="text-muted-foreground">{new Date(e.occurredAt).toLocaleString()}</div>
          </div>
          <div className="mt-1 text-muted-foreground">
            {e.entityType} <span className="font-mono">{e.entityId}</span> · actor {e.actor} · corr <span className="font-mono">{e.correlationId}</span>
          </div>
          <pre className="mt-2 bg-muted/40 p-2 rounded font-mono text-[11px] overflow-auto">{JSON.stringify(e.payload, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}

function ImportsPanel() {
  const s = useSnapshot()!;
  const [pkg, setPkg] = useState(`{
  "concepts": [
    { "id": "CR-001-001", "frameworkIds": ["F-001"] },
    { "id": "CR-011-001", "frameworkIds": ["F-999"] }
  ],
  "frameworks": []
}`);
  const [issues, setIssues] = useState<ReturnType<typeof validateImportPackage> | null>(null);

  const run = () => {
    try {
      const parsed = JSON.parse(pkg);
      const rep = validateImportPackage(s, parsed);
      setIssues(rep);
      if (rep.ok) toast.success("Dry-run passed. Ready for approval.");
      else toast.error(`Dry-run blocked: ${rep.issues.length} issue(s)`);
    } catch (e) {
      toast.error(`Invalid JSON: ${(e as Error).message}`);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Submit dry-run</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Textarea rows={10} value={pkg} onChange={e => setPkg(e.target.value)} className="font-mono text-xs" />
          <Button size="sm" onClick={run}>Validate</Button>
          <p className="text-xs text-muted-foreground">Imports never bypass governance. Human approval is required before commit.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Validation result</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          {!issues && <div className="text-muted-foreground">Submit a package to see validation output.</div>}
          {issues && (
            <>
              <div className="flex items-center gap-2">
                {issues.ok ? <CheckCircle2 className="size-4 text-emerald-600" /> : <AlertTriangle className="size-4 text-red-600" />}
                <span>{issues.ok ? "Dry-run passed" : "Dry-run blocked"}</span>
              </div>
              <ul className="text-xs space-y-1">
                {issues.issues.map((i, idx) => (
                  <li key={idx} className={i.severity === "error" ? "text-red-600" : "text-amber-600"}>
                    [{i.code}] {i.message}
                  </li>
                ))}
              </ul>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Mapping preview</div>
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground"><tr><th className="text-left">Kind</th><th className="text-left">Incoming</th><th className="text-left">Target</th><th className="text-left">Action</th></tr></thead>
                  <tbody>
                    {issues.mappingPreview.map((m, idx) => (
                      <tr key={idx}><td>{m.kind}</td><td className="font-mono">{m.incomingId}</td><td className="font-mono">{m.targetId ?? "—"}</td><td>{m.action}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader className="pb-2"><CardTitle className="text-base">Recent import jobs</CardTitle></CardHeader>
        <CardContent className="text-xs">
          {s.importJobs.length === 0 && <div className="text-muted-foreground">No jobs.</div>}
          {s.importJobs.map(j => (
            <div key={j.id} className="border-t py-2 first:border-0">
              <div className="flex items-center justify-between">
                <div className="font-mono">{j.id} · {j.packageName} v{j.packageVersion}</div>
                <Badge variant="outline">{j.status}</Badge>
              </div>
              <div className="text-muted-foreground">Strategy: {j.strategy} · {j.issues.length} issue(s) · hash {j.packageHash}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ExportsPanel() {
  const s = useSnapshot()!;
  const [entityId, setEntityId] = useState("PL-101");

  const run = async () => {
    try {
      const { job, pkg } = newExportJob(s, { kind: "publication", entityId, requestedBy: "operator" });
      const next = { ...s, exportJobs: [...s.exportJobs, job], deliveryPackages: [...s.deliveryPackages, pkg] };
      await Repo.replaceAll(next);
      toast.success(`Export package ${pkg.id} generated`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const download = (pkgId: string) => {
    const pkg = s.deliveryPackages.find(p => p.id === pkgId);
    if (!pkg) return;
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${pkg.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Generate export</CardTitle></CardHeader>
        <CardContent className="flex gap-2 items-end">
          <div className="flex-1">
            <div className="text-xs text-muted-foreground mb-1">Publication ID</div>
            <Input value={entityId} onChange={e => setEntityId(e.target.value)} />
          </div>
          <Button onClick={run}>Generate</Button>
        </CardContent>
      </Card>
      <div>
        <SectionTitle>Packages</SectionTitle>
        <div className="grid gap-2">
          {s.deliveryPackages.map(p => (
            <div key={p.id} className="rounded-md border p-3 text-xs flex items-start justify-between gap-3">
              <div>
                <div className="font-mono">{p.id} · {p.title}</div>
                <div className="text-muted-foreground">{p.kind} v{p.version} · {p.dependencies.length} dependencies · readiness {p.readinessScore}</div>
                <div className="text-muted-foreground">Hash: <span className="font-mono">{p.hash}</span></div>
              </div>
              <Button size="sm" variant="outline" onClick={() => download(p.id)}>Download JSON</Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DeliveriesPanel() {
  const s = useSnapshot()!;
  return (
    <div className="grid gap-2">
      {s.deliveryRuns.map(r => (
        <div key={r.id} className="rounded-md border p-3 text-xs flex items-start justify-between">
          <div>
            <div className="font-mono">{r.id} · pkg {r.packageId} → {r.connectionId}</div>
            <div className="text-muted-foreground">{r.attempts.length} attempt(s) · idempotency {r.idempotencyKey}</div>
          </div>
          <DeliveryBadge status={r.status} />
        </div>
      ))}
      {s.deliveryRuns.length === 0 && <EmptyState title="No delivery runs" />}
    </div>
  );
}

function MappingsPanel() {
  const s = useSnapshot()!;
  return (
    <div className="space-y-4">
      <div>
        <SectionTitle>Sync mappings</SectionTitle>
        <div className="grid gap-2">
          {s.syncMappings.map(m => (
            <div key={m.id} className="rounded-md border p-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-mono">{m.id} · {m.internalEntityKind}/{m.internalEntityId} ↔ {m.externalId}</div>
                <Badge variant="outline" className={m.status === "conflict" ? "bg-red-500/10 text-red-600 border-red-500/30" : ""}>{m.status}</Badge>
              </div>
              <div className="text-muted-foreground">{m.direction} · owner {m.owner} · last sync {m.lastSyncAt ?? "never"}</div>
              {m.conflictReason && <div className="text-amber-700 mt-1">Conflict: {m.conflictReason}</div>}
            </div>
          ))}
        </div>
      </div>
      <div>
        <SectionTitle>External references</SectionTitle>
        <div className="grid gap-2">
          {s.externalReferences.map(r => (
            <div key={r.id} className="rounded-md border p-3 text-xs">
              <div className="font-mono">{r.id} · {r.internalEntityKind}/{r.internalEntityId} → {r.provider}</div>
              <div className="text-muted-foreground">{r.externalUrl}</div>
              {r.orphaned && <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 mt-1">orphaned</Badge>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ApiClientsPanel() {
  const s = useSnapshot()!;
  return (
    <div className="grid gap-2">
      {s.apiClients.map(c => (
        <Card key={c.id}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">{c.name}</CardTitle>
              <div className="text-xs text-muted-foreground">{c.id} · {c.environment} · {c.rateLimitPerMinute} req/min</div>
            </div>
            <Badge variant={c.enabled ? "default" : "secondary"}>{c.enabled ? "enabled" : "disabled"}</Badge>
          </CardHeader>
          <CardContent className="text-xs">
            <div className="text-muted-foreground">Key: <span className="font-mono">{c.keyPrefix}</span></div>
            <div className="mt-1">Scopes: {c.scopes.map(sc => <Badge key={sc} variant="outline" className="mr-1">{sc}</Badge>)}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
