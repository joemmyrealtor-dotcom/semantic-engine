import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, PageBody } from "@/components/page-header";
import { SectionTitle, LoadingState } from "@/components/ui-kit";
import { useSnapshot } from "@/lib/use-snapshot";
import { Repo } from "@/lib/data/repository";
import { generateReport, renderReportHtml } from "@/lib/data/analytics";
import type { ReportKind } from "@/lib/data/schema";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — Legacy Platform v2.0" }] }),
  component: ReportsPage,
});

const KINDS: { key: ReportKind; label: string }[] = [
  { key: "weekly-manufacturing", label: "Weekly Manufacturing Report" },
  { key: "monthly-executive", label: "Monthly Executive Summary" },
  { key: "quarterly-governance", label: "Quarterly Governance Review" },
  { key: "release-readiness", label: "Release Readiness Report" },
  { key: "knowledge-health", label: "Knowledge Health Report" },
  { key: "automation-operations", label: "Automation Operations Report" },
  { key: "ai-governance", label: "AI Governance Report" },
];

function ReportsPage() {
  const s = useSnapshot();
  const [kind, setKind] = useState<ReportKind>("weekly-manufacturing");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [releaseId, setReleaseId] = useState("");
  const [format, setFormat] = useState<"json" | "html">("json");
  if (!s) return <LoadingState label="Loading reports…" />;

  const runs = [...(s.reportRuns ?? [])].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));

  const run = async () => {
    const rep = generateReport(s, {
      kind, actor: "reporting-user", format,
      params: { dateFrom: dateFrom || null, dateTo: dateTo || null, releaseId: releaseId || null, scope: null },
    });
    await Repo.create("reportRuns", rep);
  };

  const download = (id: string, fmt: "json" | "html") => {
    const r = s.reportRuns.find(x => x.id === id);
    if (!r) return;
    const blob = fmt === "html"
      ? new Blob([renderReportHtml(r)], { type: "text/html" })
      : new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${r.id}.${fmt}`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader eyebrow="Reporting Center" title="Reports"
        description="Deterministic, exportable summaries derived from repository and analytics snapshots. JSON and print-friendly HTML supported locally; no scheduled delivery." />
      <PageBody>
        <div className="editorial-card p-4 mb-6">
          <SectionTitle>Generate a report</SectionTitle>
          <div className="grid md:grid-cols-6 gap-2 items-end text-sm">
            <label className="md:col-span-2">Kind
              <select value={kind} onChange={e => setKind(e.target.value as ReportKind)} className="mt-1 w-full px-2 py-1.5 border border-border rounded">
                {KINDS.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
            </label>
            <label>From <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="mt-1 w-full px-2 py-1.5 border border-border rounded" /></label>
            <label>To <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="mt-1 w-full px-2 py-1.5 border border-border rounded" /></label>
            <label>Release
              <select value={releaseId} onChange={e => setReleaseId(e.target.value)} className="mt-1 w-full px-2 py-1.5 border border-border rounded">
                <option value="">(all)</option>
                {s.releases.map(r => <option key={r.id} value={r.id}>{r.id}</option>)}
              </select>
            </label>
            <label>Format
              <select value={format} onChange={e => setFormat(e.target.value as "json" | "html")} className="mt-1 w-full px-2 py-1.5 border border-border rounded">
                <option value="json">JSON</option><option value="html">HTML</option>
              </select>
            </label>
          </div>
          <button onClick={run} className="mt-3 text-xs px-3 py-1.5 rounded-md bg-heritage text-heritage-foreground">Generate</button>
        </div>

        <div className="editorial-card p-4">
          <SectionTitle hint={`${runs.length} runs`}>Report history</SectionTitle>
          {runs.length === 0 ? <div className="text-sm text-muted-foreground">No reports generated yet.</div>
            : <ul className="text-sm divide-y divide-border">
                {runs.map(r => (
                  <li key={r.id} className="py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs w-20">{r.id}</span>
                      <span className="flex-1 truncate">{r.title}</span>
                      <span className="text-xs text-muted-foreground">{new Date(r.generatedAt).toLocaleString()}</span>
                      <button onClick={() => download(r.id, "json")} className="text-xs px-2 py-0.5 border border-border rounded hover:bg-muted">JSON</button>
                      <button onClick={() => download(r.id, "html")} className="text-xs px-2 py-0.5 border border-border rounded hover:bg-muted">HTML</button>
                    </div>
                    <div className="text-xs text-slate-ink mt-1">{r.summary}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">Sources: {r.sourceSnapshotIds.length ? r.sourceSnapshotIds.join(", ") : "—"} · Actor {r.actor}</div>
                  </li>
                ))}
              </ul>}
        </div>
      </PageBody>
    </>
  );
}
