import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageBody } from "@/components/page-header";
import { SectionTitle } from "@/components/ui-kit";

export const Route = createFileRoute("/governance")({
  head: () => ({ meta: [{ title: "Governance Center — Legacy Platform" }] }),
  component: GovernancePage,
});

const STANDARDS = [
  { id: "LKS-001", title: "Legacy Knowledge Standards", summary: "Defines canonical fields, ID structure, review cadence, and human-review requirements for every knowledge asset." },
  { id: "LRC-001", title: "Legacy Review Cadence", summary: "Governs periodic re-review of Canonical objects and the evidence required to remain Canonical." },
  { id: "RES-001", title: "Release Standards", summary: "Specifies manifest completeness, changelog, QA evidence, traceability, and gate requirements for release promotion." },
  { id: "POL-001", title: "AI Governance Policy", summary: "Requires prompt-of-record, source manifest, human review, and lifecycle labeling for any AI-generated artifact." },
];

const MATURITY = [
  { level: "Draft", desc: "New object; not yet reviewed." },
  { level: "In Review", desc: "Under editorial or QA review." },
  { level: "Approved", desc: "Meets standards; not yet elevated to Canonical." },
  { level: "Canonical", desc: "Ratified source of truth; changes require version bump and re-review." },
  { level: "Deprecated", desc: "Superseded; retained for traceability." },
  { level: "Archived", desc: "Removed from active use." },
];

function GovernancePage() {
  return (
    <>
      <PageHeader eyebrow="Governance" title="Governance Center" description="Standards, compliance, and object maturity for the Legacy Platform." />
      <PageBody>
        <div className="grid md:grid-cols-2 gap-4">
          {STANDARDS.map(s => (
            <div key={s.id} className="editorial-card p-5">
              <div className="text-[11px] uppercase tracking-widest text-gold">{s.id}</div>
              <h3 className="font-serif text-xl text-heritage mt-1">{s.title}</h3>
              <p className="text-sm text-slate-ink mt-2">{s.summary}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 editorial-card p-5">
          <SectionTitle>Compliance checklist</SectionTitle>
          <ul className="text-sm space-y-2">
            {[
              "Every Canonical asset has a recorded steward and version.",
              "Every AI-generated draft records a prompt-of-record and source manifest.",
              "Human review is completed before any draft is promoted to Approved.",
              "Canonical promotion requires editorial and QA sign-off under LRC-001.",
              "Release manifest is complete and traceability confirmed under RES-001.",
            ].map(t => <li key={t} className="flex items-start gap-2"><span className="mt-1.5 size-1.5 rounded-full bg-evergreen" />{t}</li>)}
          </ul>
        </div>

        <div className="mt-8 editorial-card p-5">
          <SectionTitle>Object maturity model</SectionTitle>
          <div className="grid md:grid-cols-3 gap-3">
            {MATURITY.map(m => (
              <div key={m.level} className="border border-border rounded p-3">
                <div className="text-[10px] uppercase tracking-widest text-gold">{m.level}</div>
                <div className="text-sm text-slate-ink mt-1">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </PageBody>
    </>
  );
}
