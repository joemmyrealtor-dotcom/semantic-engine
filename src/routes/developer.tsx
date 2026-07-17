import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { LoadingState, EmptyState } from "@/components/ui-kit";
import { useSnapshot } from "@/lib/use-snapshot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_CATALOG, callLocalAPI, type APIEndpointId } from "@/lib/data/integrations";

export const Route = createFileRoute("/developer")({
  head: () => ({ meta: [
    { title: "API Explorer — Legacy Platform" },
    { name: "description", content: "Endpoint catalog, schemas, and local test console." },
  ] }),
  component: DeveloperExplorer,
});

function DeveloperExplorer() {
  const s = useSnapshot();
  const [selected, setSelected] = useState<APIEndpointId>("registry.list");
  const [paramsText, setParamsText] = useState<string>('{"kind":"publications","limit":"5"}');
  const [result, setResult] = useState<unknown>(null);
  const spec = useMemo(() => API_CATALOG.find(e => e.id === selected)!, [selected]);

  if (!s) return <LoadingState />;

  const run = () => {
    let params: Record<string, string> = {};
    try { params = JSON.parse(paramsText); } catch { setResult({ error: "Invalid JSON params" }); return; }
    setResult(callLocalAPI(s, selected, params));
  };

  return (
    <>
      <PageHeader
        eyebrow="Workstream 8"
        title="API Explorer"
        description="Local read/write API adapter. Contracts are stable; production hosting requires a deployed server runtime."
      />
      <PageBody>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            {API_CATALOG.map(e => (
              <button key={e.id} onClick={() => setSelected(e.id)}
                className={`w-full text-left rounded-md border p-3 text-xs hover:bg-accent ${selected === e.id ? "border-primary bg-accent" : ""}`}>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{e.method}</Badge>
                  <span className="font-mono">{e.path}</span>
                </div>
                <div className="text-muted-foreground mt-1">{e.description}</div>
              </button>
            ))}
          </div>
          <div className="md:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  <Badge variant="outline" className="mr-2">{spec.method}</Badge>
                  <span className="font-mono">{spec.path}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div>{spec.description}</div>
                <div className="text-xs"><span className="text-muted-foreground">Scopes:</span> {spec.scopes.map(s => <Badge key={s} variant="outline" className="ml-1">{s}</Badge>)}</div>
                <div className="text-xs"><span className="text-muted-foreground">Request:</span> <code className="font-mono">{spec.requestSchema}</code></div>
                <div className="text-xs"><span className="text-muted-foreground">Response:</span> <code className="font-mono">{spec.responseShape}</code></div>
                <div className="text-xs"><span className="text-muted-foreground">Example:</span> <code className="font-mono">{spec.example}</code></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Test console (local adapter)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xs text-muted-foreground" id="developer-params-label">Params (JSON)</div>
                <Input aria-labelledby="developer-params-label" value={paramsText} onChange={e => setParamsText(e.target.value)} className="font-mono text-xs" />
                <Button size="sm" onClick={run}>Send</Button>
                <div className="text-xs text-muted-foreground mt-2">Response</div>
                <pre className="bg-muted/40 p-3 rounded font-mono text-[11px] overflow-auto max-h-96">
                  {result === null ? <EmptyState title="No request yet" /> : JSON.stringify(result, null, 2)}
                </pre>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Authentication & error envelope</CardTitle></CardHeader>
              <CardContent className="text-xs space-y-2">
                <div>Auth: <code className="font-mono">Authorization: Bearer &lt;api-client-key&gt;</code> · rate limit per API client.</div>
                <div>Errors: <code className="font-mono">{`{ "error": { "code", "message", "details", "requestId" } }`}</code></div>
                <div className="text-muted-foreground">Secrets are never returned in responses. Idempotency keys are enforced on imports, webhook deliveries, and delivery runs.</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}
