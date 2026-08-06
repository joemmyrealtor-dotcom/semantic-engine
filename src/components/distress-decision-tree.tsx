/**
 * Interactive decision tree for PL-210 — "Foreclosure vs. Short Sale".
 * Presentation-only: no persistence, no data-layer writes. Guides a homeowner
 * from their current situation to the workout options that are actually
 * available to them, with credit/tax notes and chapter references.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui-kit";
import { ChevronRight, RotateCcw, Undo2, Copy } from "lucide-react";
import { toast } from "sonner";

type OutcomeTone = "evergreen" | "gold" | "warn";

type Outcome = {
  kind: "outcome";
  title: string;
  tone: OutcomeTone;
  summary: string;
  primary: string[];
  credit: string;
  tax: string;
  chapters: string[];
};

type Question = {
  kind: "question";
  prompt: string;
  help?: string;
  options: { label: string; hint?: string; next: string }[];
};

type Node = Question | Outcome;

const TREE: Record<string, Node> = {
  start: {
    kind: "question",
    prompt: "Where are you right now?",
    help: "Your position on the timeline determines which options are still open. Pick the furthest stage that applies.",
    options: [
      { label: "Current, but I can see trouble coming", hint: "No missed payments yet", next: "equity" },
      { label: "Behind on payments, no formal notice yet", hint: "Late letters and servicer calls", next: "equity" },
      { label: "I received a default or pre-foreclosure notice", hint: "Notice of Default or demand letter", next: "equity" },
      { label: "A lawsuit, summons, or sale date exists", hint: "Judicial filing or scheduled auction", next: "urgent" },
    ],
  },

  urgent: {
    kind: "outcome",
    title: "Urgent: protect the calendar first, then choose a path",
    tone: "warn",
    summary:
      "Once a lawsuit is filed or a sale date is set, deadlines — not preferences — control your options. Missing a court deadline can produce a default judgment that removes remedies you otherwise had. Stabilize the timeline before you evaluate anything else.",
    primary: [
      "Contact a real estate attorney licensed in your state today — do not wait for the next notice",
      "Call your servicer's loss mitigation line and request review for all options in writing; ask whether the sale can be postponed while review is pending",
      "Contact a HUD-approved housing counselor (free) the same day",
      "Do not move out — leaving early can forfeit occupancy, relocation assistance, and negotiating position",
      "Ask your attorney whether bankruptcy's automatic stay is appropriate for your situation",
      "Once the date is stabilized, restart this tree to compare short sale, modification, and deed in lieu",
    ],
    credit: "Damage is already underway from the delinquency string; the goal now is to avoid the completed foreclosure entry and preserve a negotiated outcome.",
    tax: "Any resolution may generate a 1099-A or 1099-C. Assemble basis records and closing statements now so a CPA can model the outcome before you sign anything.",
    chapters: ["CH-FSS-02", "CH-FSS-07", "CH-FSS-09"],
  },

  equity: {
    kind: "question",
    prompt: "Is the home worth more than what you owe?",
    help: "Compare a realistic market value to your full payoff — principal, arrears, fees, and closing costs. Many distressed owners have equity and never check.",
    options: [
      { label: "Yes — clearly worth more than the payoff", next: "equityYes" },
      { label: "Roughly even, or I can't tell", next: "equityUnknown" },
      { label: "No — I owe more than it's worth", next: "hardship" },
    ],
  },

  equityYes: {
    kind: "outcome",
    title: "You have equity — a conventional sale is almost certainly your best outcome",
    tone: "evergreen",
    summary:
      "A short sale requires being short. If the home sells for more than the payoff, you do not need lender approval, you keep the proceeds, and you avoid the derogatory event entirely. This is the most commonly missed answer in the entire guide.",
    primary: [
      "Get a written value opinion and a current payoff statement including arrears and fees",
      "If the equity is thin, price for speed rather than for the top of the range",
      "If you want to keep the home, ask about reinstatement, a repayment plan, or a refinance/HELOC while credit still allows",
      "Keep every payment you can make current while the home is marketed — each 30-day late costs you",
      "Tell your servicer the property is listed; some will pause escalation while a legitimate sale is pending",
    ],
    credit: "A conventional sale is not a derogatory event. Your only credit damage is whatever late payments were already reported — which stops the moment the loan is paid off.",
    tax: "No cancellation-of-debt income, because nothing is forgiven. Normal sale rules apply, including the primary-residence gain exclusion if you qualify. Confirm with a CPA.",
    chapters: ["CH-FSS-08", "CH-FSS-01"],
  },

  equityUnknown: {
    kind: "outcome",
    title: "Resolve the numbers before choosing a path",
    tone: "gold",
    summary:
      "Every remaining branch depends on one figure: value minus total payoff. Guessing here sends people into a short sale they did not need, or into foreclosure with equity they never captured.",
    primary: [
      "Request a written payoff statement from the servicer — including arrears, fees, and per-diem interest",
      "Get an agent's comparative market analysis based on closed sales in the last 90 days, not listings",
      "Subtract estimated closing costs (commission, transfer taxes, title, prorations) from value",
      "If the result is positive, treat this as a conventional sale; if negative, restart and select 'I owe more than it's worth'",
      "Do all of this in parallel with a loss-mitigation request — the clock keeps running while you research",
    ],
    credit: "No change from gathering information. Keep other accounts current so the housing issue stays isolated.",
    tax: "Nothing triggers yet. Start assembling basis records — purchase price, improvements, prior refinances — because every downstream path needs them.",
    chapters: ["CH-FSS-01", "CH-FSS-08"],
  },

  hardship: {
    kind: "question",
    prompt: "Is your hardship temporary or permanent?",
    help: "Match the tool to the diagnosis. Temporary interruptions call for a pause; permanent income changes call for a permanent fix.",
    options: [
      { label: "Temporary — income returns within months", hint: "Illness, layoff with prospects, one-time expense", next: "keepTemp" },
      { label: "Permanent — income is structurally lower", hint: "Disability, divorce, retirement, business closure", next: "keep" },
      { label: "I need to leave the property regardless", hint: "Relocation, divorce sale, no longer viable", next: "exitPath" },
    ],
  },

  keepTemp: {
    kind: "outcome",
    title: "Temporary hardship: forbearance, repayment plan, or reinstatement",
    tone: "evergreen",
    summary:
      "When income returns, the objective is to bridge the gap without a permanent mark. These tools exist precisely for this case, and they are available earliest in the timeline.",
    primary: [
      "Request forbearance in writing — and ask the one question that matters: how does the paused amount come due?",
      "A lump-sum reinstatement at the end of forbearance is a very different product than a deferral to the end of the loan. Get the answer in writing before accepting",
      "If you can cover arrears over time, ask for a repayment plan instead",
      "If you can cover arrears at once, reinstatement returns the loan to current",
      "Government-backed loans may offer a partial claim or payment supplement that moves arrears into a subordinate, often no-interest, obligation — ask by name",
      "Confirm how each option is reported to the credit bureaus before you agree",
    ],
    credit: "A properly documented forbearance or plan is generally reported far more favorably than delinquency. The reporting language is negotiable-adjacent — always ask first.",
    tax: "Deferring or repaying debt is not forgiveness, so no cancellation-of-debt income arises. If any principal is written off, expect a 1099-C and call a CPA.",
    chapters: ["CH-FSS-08", "CH-FSS-04", "CH-FSS-02"],
  },

  keep: {
    kind: "question",
    prompt: "Do you want to keep the home, and could you afford a lower payment?",
    help: "A modification only works if there is a payment you can sustain. Be honest — a modification you re-default on costs you the time you had left.",
    options: [
      { label: "Yes — I want to stay and a reduced payment works", next: "modify" },
      { label: "I want to stay but nothing realistic is affordable", next: "exitPath" },
      { label: "No — I'm ready to exit the property", next: "exitPath" },
    ],
  },

  modify: {
    kind: "outcome",
    title: "Pursue a loan modification — and build the file properly",
    tone: "evergreen",
    summary:
      "A modification permanently changes rate, term, or balance to create an affordable payment. Applications fail far more often on incomplete paperwork than on merit, so treat the file as the product.",
    primary: [
      "Request the loss mitigation application package and submit it complete — partial files restart the clock",
      "Include: hardship letter stating the cause plainly, income documentation, bank statements, tax returns, and a monthly budget",
      "Log every call: date, time, representative name, reference number",
      "Ask whether dual tracking protections apply — a complete application can pause foreclosure activity in many cases",
      "Ask specifically about partial claims or payment supplements if your loan is government-backed",
      "Have a HUD-approved counselor review the file before submission. It's free and materially raises approval odds",
      "If the modification is denied, request the reason in writing and immediately evaluate a short sale while time remains",
    ],
    credit: "Delinquency already reported stays, but a successful modification stops the bleeding and begins the rebuild. Ask how the modified account will be reported.",
    tax: "If principal is forgiven as part of the modification, that amount may be cancellation-of-debt income reported on a 1099-C. Exceptions such as insolvency may apply — engage a CPA before signing.",
    chapters: ["CH-FSS-08", "CH-FSS-05", "CH-FSS-04"],
  },

  exitPath: {
    kind: "question",
    prompt: "How do you want to exit — sell it, or hand it back?",
    help: "Both end the obligation, but they differ sharply on control, credit, and your ability to negotiate away the remaining balance.",
    options: [
      { label: "Sell it — I'll list and cooperate with a buyer", hint: "Short sale", next: "shortSale" },
      { label: "Hand it back by agreement — I can't manage a sale", hint: "Deed in lieu", next: "dil" },
      { label: "I don't know which is better for me", next: "compare" },
    ],
  },

  compare: {
    kind: "outcome",
    title: "Short sale vs. deed in lieu vs. letting it foreclose",
    tone: "gold",
    summary:
      "All three end the obligation. They differ on four axes: control, timeline, credit reporting, and whether you can negotiate away the deficiency. On every one of those, a completed foreclosure is the weakest position, because it is the only one where you are not a participant.",
    primary: [
      "Short sale: you choose the agent, influence price and closing date, and — critically — can negotiate deficiency release and reporting language into the approval letter before you sign",
      "Deed in lieu: faster and simpler, sometimes with relocation assistance, but usually requires the property to be marketed first and the title to be clear of junior liens",
      "Foreclosure: the lender and court or trustee set the calendar; deficiency treatment is left to state law and lender discretion",
      "If the property is marketable and you have any runway, the short sale generally produces the better credit and deficiency outcome",
      "Whichever you choose, get written answers to two questions: is the deficiency released, and how will the account be reported?",
      "Get the same written answer separately from every junior lienholder — an unreleased second lien follows you after the house is gone",
    ],
    credit: "All three are serious derogatory marks reported roughly seven years from first delinquency. Post-event waiting periods before you can finance again are commonly shorter after a short sale than after a foreclosure.",
    tax: "Any forgiven shortfall may be cancellation-of-debt income on a 1099-C; a foreclosure or deed in lieu may also be treated as a sale, generating a 1099-A. Insolvency, bankruptcy, and principal-residence exceptions may apply. CPA first.",
    chapters: ["CH-FSS-03", "CH-FSS-04", "CH-FSS-05", "CH-FSS-09"],
  },

  shortSale: {
    kind: "outcome",
    title: "Pursue a short sale — and protect the two clauses that matter",
    tone: "gold",
    summary:
      "A short sale is a normal sale with your lender at the table. It preserves the most control and is the only exit where you can negotiate the terms of your own credit and deficiency treatment before signing.",
    primary: [
      "Confirm you are genuinely short: realistic value versus full payoff including arrears, fees, and closing costs",
      "Call loss mitigation and request the short sale package; many servicers run a defined program with published timelines",
      "Assemble the hardship file: hardship letter, income documentation, bank statements, tax returns, monthly budget, and the authorization form letting your agent speak to the servicer",
      "List with an agent who has actually closed short sales — priced to the market, not to your payoff",
      "Expect separate approval gates: junior lienholders and any mortgage insurer each approve independently",
      "Read the approval letter for exactly two things before signing: is the deficiency released, and how will the account be reported",
      "Negotiate both before closing. After closing you have nothing left to trade",
      "Keep a dated log of every call and expect repeated requests for updated documents",
    ],
    credit: "Reported as a settled account for less than the full balance — damaging, but frequently viewed differently by future underwriters than a completed foreclosure, with generally shorter waiting periods before you can finance again.",
    tax: "The forgiven shortfall may be reported on a 1099-C as cancellation-of-debt income. Insolvency, bankruptcy, and qualified principal-residence relief may reduce or eliminate it; recourse versus non-recourse status changes the analysis. Engage a CPA before signing the approval letter.",
    chapters: ["CH-FSS-06", "CH-FSS-05", "CH-FSS-04", "CH-FSS-09"],
  },

  dil: {
    kind: "outcome",
    title: "Deed in lieu — a negotiated handback, with conditions",
    tone: "gold",
    summary:
      "A deed in lieu ends the obligation by agreement instead of by auction. It is cleaner and faster than foreclosure, but lenders impose conditions and it is not automatically available.",
    primary: [
      "Expect the lender to require the property to have been genuinely marketed first — many will not consider a deed in lieu until a listing period has run",
      "Title generally must be clear: junior liens, judgments, and HOA balances can block it outright",
      "Ask directly about cash-for-keys or relocation assistance — it is frequently available and rarely volunteered",
      "Get the deficiency release in writing. A deed in lieu without a release can leave you owing the shortfall",
      "Confirm in writing how the account will be reported and on what date",
      "Document the property's condition at handover and get a written release of your obligations, including the date responsibility for taxes, insurance, and HOA transfers",
    ],
    credit: "A serious derogatory event reported roughly seven years from first delinquency, generally treated more like a foreclosure than a short sale by future underwriters.",
    tax: "May be treated as a sale of the property, generating a 1099-A, and any forgiven deficiency may generate a 1099-C. Exceptions may apply. CPA before you sign.",
    chapters: ["CH-FSS-08", "CH-FSS-05", "CH-FSS-09"],
  },
};

const TONE_CLASS: Record<OutcomeTone, string> = {
  evergreen: "border-evergreen/40",
  gold: "border-gold/40",
  warn: "border-destructive/40",
};

const TONE_LABEL: Record<OutcomeTone, string> = {
  evergreen: "text-evergreen",
  gold: "text-gold",
  warn: "text-destructive",
};

export function DistressDecisionTree() {
  const [path, setPath] = useState<{ nodeId: string; answer: string }[]>([]);
  const [nodeId, setNodeId] = useState("start");
  const node = TREE[nodeId] ?? TREE.start;

  const summaryText = useMemo(() => {
    const lines = path.map((p, i) => {
      const q = TREE[p.nodeId];
      return `${i + 1}. ${q?.kind === "question" ? q.prompt : p.nodeId} → ${p.answer}`;
    });
    if (node.kind === "outcome") {
      lines.push("", `RECOMMENDED PATH: ${node.title}`, node.summary, "", ...node.primary.map(a => `• ${a}`), "", `CREDIT: ${node.credit}`, `TAX: ${node.tax}`, `CHAPTERS: ${node.chapters.join(", ")}`);
    }
    return ["FORECLOSURE VS. SHORT SALE — DECISION SUMMARY", "", ...lines, "", "Educational content only. Not legal, tax, or financial advice."].join("\n");
  }, [path, node]);

  const choose = (answer: string, next: string) => {
    setPath(p => [...p, { nodeId, answer }]);
    setNodeId(next);
  };

  const back = () => {
    const prev = path[path.length - 1];
    if (!prev) return;
    setPath(p => p.slice(0, -1));
    setNodeId(prev.nodeId);
  };

  const restart = () => { setPath([]); setNodeId("start"); };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      toast.success("Decision summary copied to clipboard.");
    } catch {
      toast.error("Clipboard unavailable in this browser.");
    }
  };

  const step = path.length + 1;

  return (
    <section className="editorial-card p-5" aria-labelledby="decision-tree-heading">
      <div className="flex items-start justify-between gap-4 mb-1">
        <SectionTitle hint={node.kind === "outcome" ? "Result" : `Step ${step}`}>
          <span id="decision-tree-heading">Interactive decision tree</span>
        </SectionTitle>
        <div className="flex gap-2 shrink-0">
          {path.length > 0 && (
            <Button size="sm" variant="ghost" onClick={back}><Undo2 className="size-3.5 mr-1" />Back</Button>
          )}
          {path.length > 0 && (
            <Button size="sm" variant="ghost" onClick={restart}><RotateCcw className="size-3.5 mr-1" />Restart</Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Answer a few questions to see which workout options are actually available to you, and what each one does to your credit and taxes.
      </p>

      {path.length > 0 && (
        <ol className="mb-4 space-y-1" aria-label="Answers so far">
          {path.map((p, i) => (
            <li key={i} className="text-xs flex items-start gap-1.5">
              <ChevronRight className="size-3 mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-muted-foreground">{TREE[p.nodeId]?.kind === "question" ? (TREE[p.nodeId] as Question).prompt : ""}</span>
              <span className="font-medium">{p.answer}</span>
            </li>
          ))}
        </ol>
      )}

      {node.kind === "question" ? (
        <div>
          <h4 className="font-serif text-lg text-heritage mb-1">{node.prompt}</h4>
          {node.help && <p className="text-sm text-muted-foreground mb-3">{node.help}</p>}
          <div className="grid gap-2">
            {node.options.map(o => (
              <button
                key={o.label}
                type="button"
                onClick={() => choose(o.label, o.next)}
                className="text-left rounded-md border border-border px-3 py-2.5 hover:border-gold hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              >
                <div className="text-sm font-medium">{o.label}</div>
                {o.hint && <div className="text-xs text-muted-foreground mt-0.5">{o.hint}</div>}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className={`rounded-md border p-4 ${TONE_CLASS[node.tone]}`}>
          <div className={`text-xs uppercase tracking-widest mb-1 ${TONE_LABEL[node.tone]}`}>Recommended path</div>
          <h4 className="font-serif text-lg text-heritage mb-2">{node.title}</h4>
          <p className="text-sm mb-4">{node.summary}</p>

          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Do this next</div>
          <ul className="text-sm list-disc pl-5 space-y-1.5 mb-4">
            {node.primary.map((a, i) => <li key={i}>{a}</li>)}
          </ul>

          <div className="grid md:grid-cols-2 gap-3 mb-4">
            <div className="rounded border border-border p-3">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Credit effect</div>
              <p className="text-sm">{node.credit}</p>
            </div>
            <div className="rounded border border-border p-3">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Tax effect</div>
              <p className="text-sm">{node.tax}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Read next</span>
            {node.chapters.map(c => (
              <span key={c} className="font-mono text-xs rounded border border-border px-1.5 py-0.5">{c}</span>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={copySummary}><Copy className="size-3.5 mr-1" />Copy decision summary</Button>
            <Button size="sm" variant="ghost" onClick={restart}><RotateCcw className="size-3.5 mr-1" />Start over</Button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-4">
        Educational content only. Not legal, tax, or financial advice. Outcomes depend on your state, loan type, and numbers — confirm with a HUD-approved counselor, a licensed attorney, and a CPA.
      </p>
    </section>
  );
}
