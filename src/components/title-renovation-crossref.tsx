import { Link } from "@tanstack/react-router";

type Gate = {
  gate: string;
  milestone: string;
  meaning: string;
  safe: string[];
  unsafe: string[];
  tone: "warn" | "gold" | "default" | "evergreen";
};

const GATES: Gate[] = [
  {
    gate: "Gate 1",
    milestone: "Contract signed · title commitment received",
    meaning:
      "Schedule A shows who must sign and what is conveyed. Schedule B-I lists every requirement that must be cleared before the policy issues.",
    safe: ["Measure and design", "Collect contractor bids", "Price materials", "Read Schedule B-II restrictions"],
    unsafe: ["Non-refundable deposits", "Material orders", "Demo or any on-site work"],
    tone: "warn",
  },
  {
    gate: "Gate 2",
    milestone: "All Schedule B-I requirements cleared in writing",
    meaning:
      "Releases recorded, liens paid, heirship/divorce documents delivered, name affidavits signed, survey or boundary issues resolved. Curative delay here is the #1 cause of a slipped start date.",
    safe: ["Order long-lead items (tile, cabinets, windows) on refundable or resellable terms", "Lock contractor calendar slots"],
    unsafe: ["Custom or non-cancelable fabrication", "Crew mobilization", "Permit applications in your name"],
    tone: "gold",
  },
  {
    gate: "Gate 3",
    milestone: "Loan funded",
    meaning: "Money has moved, but funding is not recording. You still do not hold title.",
    safe: ["Confirm start date", "Stage deliveries off-site", "Finalize draw schedule with a renovation lender"],
    unsafe: ["Any work on the property", "Deliveries to the property without written owner consent"],
    tone: "default",
  },
  {
    gate: "Gate 4",
    milestone: "Deed recorded · possession delivered",
    meaning: "You are the owner of record. Insurance, lien rights, and permit authority are now yours.",
    safe: ["Pull permits", "Mobilize crews", "Begin demolition and installation"],
    unsafe: ["Nothing — proceed on the construction plan"],
    tone: "evergreen",
  },
];

const RISKS = [
  {
    risk: "Unreleased prior mortgage or judgment lien",
    effect: "Schedule B-I requirement; closing slips days to weeks while the servicer or creditor issues a release.",
    action: "Treat as a construction hold. Do not order materials until the release is recorded.",
  },
  {
    risk: "Heirship gap, missing ex-spouse signature, name discrepancy",
    effect: "Requires probate documents, quitclaim deed, or one-and-the-same affidavit; timeline is unpredictable.",
    action: "Push the start date; renegotiate the contract closing date in writing early.",
  },
  {
    risk: "Boundary encroachment or easement (Schedule B-II)",
    effect: "May prohibit the addition, fence, driveway, or exterior finish you budgeted for.",
    action: "Read exception documents before signing any construction contract.",
  },
  {
    risk: "Seller-side work in progress, unpaid contractors",
    effect: "Mechanic's liens attach to the property; the underwriter will not insure over them.",
    action: "Pay in full and collect signed final lien waivers before the settlement statement is final.",
  },
  {
    risk: "Open or missing permits",
    effect: "Surfaces in the search; creates disclosure, appraisal, and financing problems.",
    action: "Close out permits before listing; never rely on 'the buyer can deal with it'.",
  },
  {
    risk: "Renovation financing (203(k), HomeStyle, construction-to-perm)",
    effect: "Funding requires approved plans, bids, and a draw schedule — a second calendar that can slip independently.",
    action: "Run curative work and construction underwriting in parallel on one shared timeline.",
  },
  {
    risk: "Pre-closing access to start work early",
    effect: "Title and liability exposure; improvements may be lost if the sale fails.",
    action: "Require written seller, lender, and insurer consent stating who owns improvements if closing does not occur.",
  },
];

const toneClass: Record<Gate["tone"], string> = {
  warn: "border-l-4 border-l-destructive",
  gold: "border-l-4 border-l-heritage",
  default: "border-l-4 border-l-muted-foreground/40",
  evergreen: "border-l-4 border-l-primary",
};

export function TitleRenovationCrossRef({ from }: { from: "PL-206" | "PL-211" }) {
  const other = from === "PL-211" ? "PL-206" : "PL-211";
  const otherLabel =
    from === "PL-211" ? "PL-206 — Best Home Upgrades to Do and Not Do" : "PL-211 — The Title Guide";

  return (
    <section className="rounded-lg border bg-card text-card-foreground shadow-sm" aria-labelledby="crossref-heading">
      <header className="p-4 border-b">
        <h2 id="crossref-heading" className="text-lg font-semibold">
          Cross-Reference: Escrow, Title, and Closing Risk → When Renovation Work Can Start
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Renovation timing is a title question before it is a contractor question. You are not the owner when the offer
          is accepted, the loan is approved, or you sign — you are the owner when the deed records.
        </p>
        <Link
          to="/publications/$id"
          params={{ id: other }}
          className="inline-block mt-2 text-sm underline text-heritage"
        >
          Open the paired guide: {otherLabel} →
        </Link>
      </header>

      <div className="p-4 space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">The four start gates</h3>
        {GATES.map((g) => (
          <div key={g.gate} className={`rounded-md bg-muted/40 p-3 ${toneClass[g.tone]}`}>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xs font-bold uppercase tracking-wide">{g.gate}</span>
              <span className="text-sm font-medium">{g.milestone}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{g.meaning}</p>
            <div className="grid sm:grid-cols-2 gap-2 mt-2 text-sm">
              <div>
                <p className="font-medium">Safe to do</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {g.safe.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium">Not yet</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {g.unsafe.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Title and escrow risks that move the start date
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3 font-medium">Risk</th>
                <th className="py-2 pr-3 font-medium">Effect on the schedule</th>
                <th className="py-2 font-medium">What to do</th>
              </tr>
            </thead>
            <tbody>
              {RISKS.map((r) => (
                <tr key={r.risk} className="border-b last:border-0 align-top">
                  <td className="py-2 pr-3 font-medium">{r.risk}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.effect}</td>
                  <td className="py-2 text-muted-foreground">{r.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Practical habit: keep one timeline with three columns — title milestone, lender milestone, construction
          milestone — and never let a construction commitment sit to the left of the title milestone that authorizes it.
          Educational content only; not legal, tax, or title advice.
        </p>
      </div>
    </section>
  );
}
