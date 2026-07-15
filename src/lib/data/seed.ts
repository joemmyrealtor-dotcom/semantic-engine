import type {
  Domain, Concept, Framework, KnowledgeObject, ClientTool,
  PublicationBlueprint, Prompt, Agent, Release, DataSnapshot, PromptFamily,
  ClientToolkit, AIPack,
} from "./schema";
import { SCHEMA_VERSION } from "./schema";

const now = "2026-01-15T10:00:00.000Z";
const ts = { createdAt: now, updatedAt: now };

// ---------- Domains ----------
export const seedDomains: Domain[] = [
  ["DOM-001", "Financial Readiness", "Foundation of buyer capacity: income, reserves, debt, flexibility, and long-term sustainability."],
  ["DOM-002", "Mortgage & Financing", "Loan programs, rates, underwriting, and the mechanics of financing a purchase."],
  ["DOM-003", "Home Search", "Discovery, criteria, market fit, and property evaluation."],
  ["DOM-004", "Offer Strategy", "Offer construction, negotiation posture, and decision confidence at the point of commitment."],
  ["DOM-005", "Due Diligence", "Inspections, disclosures, appraisals, and risk resolution before closing."],
  ["DOM-006", "Closing", "Settlement mechanics, funding, title, and transfer of ownership."],
  ["DOM-007", "Homeownership", "Post-close stewardship: maintenance, equity, and long-horizon planning."],
  ["DOM-008", "Professional Collaboration", "Advisor, lender, agent, attorney, and inspector interactions and role clarity."],
  ["DOM-009", "Consumer Decision Science", "Cognitive, behavioral, and emotional dimensions of high-stakes housing decisions."],
  ["DOM-010", "Legacy Platform Governance", "Standards, roles, review cadence, and canonical integrity for the platform itself."],
].map(([id, name, summary]) => ({
  id, name, summary, steward: "Editorial Board",
  status: "Canonical" as const, version: "1.0.0", ...ts,
}));

// ---------- Concepts ----------
const conceptSeed: [string, string, string, string[], string[]][] = [
  // CR-001 Financial Readiness (8)
  ["CR-001-001", "Financial Readiness", "The state in which a household's income, reserves, debt profile, and flexibility together support a home purchase without eroding long-term wellbeing.", ["DOM-001"], ["Buyer Readiness"]],
  ["CR-001-002", "Affordability", "The upper bound of purchase price and monthly obligation a household can sustain across foreseeable market and life conditions.", ["DOM-001"], []],
  ["CR-001-003", "Cash Reserves", "Liquid assets retained after down payment and closing that absorb income, rate, or maintenance shocks.", ["DOM-001"], ["Emergency Fund"]],
  ["CR-001-004", "Debt-to-Income Ratio", "The share of gross monthly income committed to recurring debt obligations, including the proposed housing payment.", ["DOM-001", "DOM-002"], ["DTI"]],
  ["CR-001-005", "Financial Flexibility", "The household's ability to absorb variability in income, expenses, or interest rates without distress or default.", ["DOM-001"], []],
  ["CR-001-006", "True Monthly Ownership Cost", "The full recurring cost of ownership including principal, interest, taxes, insurance, HOA, utilities, and reserved maintenance.", ["DOM-001", "DOM-007"], ["PITI+", "All-in Cost"]],
  ["CR-001-007", "Capital Planning", "Deliberate allocation of savings toward down payment, closing costs, reserves, and post-close capital needs.", ["DOM-001"], []],
  ["CR-001-008", "Long-Term Sustainability", "The likelihood a purchase remains affordable and beneficial across a multi-year ownership horizon.", ["DOM-001", "DOM-007"], []],
  // CR-002 Mortgage & Financing (9)
  ["CR-002-001", "Mortgage Pre-Approval", "A lender's conditional commitment to a loan amount based on verified credit, income, and asset review.", ["DOM-002"], ["Pre-Approval"]],
  ["CR-002-002", "Loan Program", "A defined mortgage product with rules for eligibility, structure, pricing, and insurance.", ["DOM-002"], []],
  ["CR-002-003", "Interest Rate", "The periodic cost of borrowing expressed as a percentage of outstanding loan balance.", ["DOM-002"], ["Note Rate"]],
  ["CR-002-004", "Annual Percentage Rate", "The annualized cost of credit including interest and standardized loan charges.", ["DOM-002"], ["APR"]],
  ["CR-002-005", "Rate Lock", "A time-bound commitment by a lender to hold a specified interest rate for a defined loan scenario.", ["DOM-002"], []],
  ["CR-002-006", "Discount Points", "Prepaid interest that reduces the note rate for the life of the loan.", ["DOM-002"], ["Points"]],
  ["CR-002-007", "Mortgage Insurance", "Insurance that protects the lender when the borrower's equity is below a defined threshold.", ["DOM-002"], ["PMI", "MIP"]],
  ["CR-002-008", "Loan Estimate", "The standardized federal disclosure summarizing loan terms, projected payments, and closing costs.", ["DOM-002"], ["LE"]],
  ["CR-002-009", "Underwriting", "The lender's evaluation of borrower, property, and program to confirm loan eligibility and risk.", ["DOM-002"], []],
  // CR-004 Offer Strategy (8)
  ["CR-004-001", "Offer Strategy", "The deliberate design of an offer that reflects buyer priorities, market context, financial limits, and negotiation posture.", ["DOM-004"], []],
  ["CR-004-002", "Market Context", "The prevailing supply, demand, and pricing dynamics that shape realistic offer parameters.", ["DOM-004"], []],
  ["CR-004-003", "Offer Structure", "The composition of price, financing, contingencies, timing, and concessions in a written offer.", ["DOM-004"], []],
  ["CR-004-004", "Financial Limits", "The pre-committed ceilings a buyer will not exceed on price, monthly cost, or cash out.", ["DOM-004", "DOM-001"], ["Walk-Away Number"]],
  ["CR-004-005", "Contingencies", "Contractual conditions that permit a buyer to renegotiate or exit without penalty.", ["DOM-004"], []],
  ["CR-004-006", "Negotiation Boundaries", "The concessions a buyer will and will not make during offer negotiation.", ["DOM-004"], []],
  ["CR-004-007", "Seller Priorities", "The non-price factors — timing, certainty, terms — that materially influence seller decision-making.", ["DOM-004"], []],
  ["CR-004-008", "Decision Confidence", "The buyer's justified conviction that the offer reflects sound priorities and defensible tradeoffs.", ["DOM-004", "DOM-009"], []],
];

export const seedConcepts: Concept[] = conceptSeed.map(([id, name, def, domainIds, aliases]) => ({
  id,
  canonicalName: name,
  canonicalDefinition: def,
  purpose: `Establish the canonical meaning of ${name} across advisory, editorial, and client-facing artifacts.`,
  scope: "Applies across all Legacy Platform publications, tools, and derived assets.",
  exclusions: "Regional legal specifics and jurisdiction-specific tax treatment are addressed in dedicated concepts.",
  domainIds,
  aliases,
  keywords: [name.toLowerCase(), ...aliases.map(a => a.toLowerCase())],
  relatedConceptIds: [],
  frameworkIds: [],
  audience: "Advisors and informed consumer readers",
  readingLevel: "Grade 11 (professional consumer)",
  aiRetrievalTags: ["canonical", "definition", ...aliases],
  steward: "Editorial Board",
  status: "Canonical",
  version: "1.0.0",
  reviewCadenceMonths: 12,
  lastReviewedAt: now,
  humanReviewCompleted: true,
  manufacturingStatus: "Canonical",
  publicationLinks: [],
  clientToolkitLinks: [],
  aiPackLinks: [],
  ...ts,
}));

// ---------- Frameworks ----------
const frameworkSeed: [string, string, string, string, string[], string[]][] = [
  ["F-004", "Financial Readiness Framework", "Establish whether a household is ready to buy without eroding long-term wellbeing.", "Should this household proceed toward pre-approval?", ["CR-001-001","CR-001-002","CR-001-003","CR-001-004","CR-001-005"], ["W-025"]],
  ["F-005", "True Cost of Ownership Framework", "Model the full recurring cost of ownership beyond principal and interest.", "What will this home actually cost per month?", ["CR-001-006","CR-001-008"], ["W-026"]],
  ["F-006", "Mortgage Program Fit Framework", "Match borrower profile and goals to an appropriate loan program.", "Which loan program best fits this borrower?", ["CR-002-001","CR-002-002","CR-002-007"], []],
  ["F-007", "Rate & Points Decision Framework", "Decide when to lock and whether to buy points given horizon and cash position.", "Lock now? Buy points?", ["CR-002-003","CR-002-004","CR-002-005","CR-002-006"], []],
  ["F-008", "Loan Estimate Review Framework", "Systematically read a Loan Estimate for accuracy, fit, and negotiation levers.", "Does this Loan Estimate reflect the agreed scenario?", ["CR-002-008","CR-002-009"], []],
  ["F-009", "Offer Strategy Framework", "Construct an offer aligned to buyer priorities, market context, and pre-committed limits.", "What offer should this buyer make?", ["CR-004-001","CR-004-002","CR-004-003","CR-004-004","CR-004-005","CR-004-006","CR-004-007","CR-004-008"], ["C-025","DT-014"]],
  // F-010 reserved
  ["F-011", "Contingency Design Framework", "Design contingencies that protect the buyer without weakening the offer unnecessarily.", "Which contingencies belong in this offer?", ["CR-004-005","CR-004-003"], ["C-026"]],
  ["F-012", "Negotiation Boundary Framework", "Pre-commit to concessions the buyer will and will not make.", "Where will this buyer hold the line?", ["CR-004-006","CR-004-004"], []],
  ["F-013", "Seller Priority Read Framework", "Infer seller priorities from listing behavior and market signals.", "What matters most to this seller?", ["CR-004-007","CR-004-002"], []],
  ["F-014", "Decision Confidence Framework", "Confirm the buyer has justified conviction before submitting an offer.", "Is this buyer ready to commit?", ["CR-004-008","CR-001-005"], []],
];

export const seedFrameworks: Framework[] = frameworkSeed.map(([id, name, mission, decisionSolved, governingConceptIds, clientToolIds]) => ({
  id, name, mission, decisionSolved,
  governingConceptIds,
  inputs: ["Client intake data", "Advisor observations", "Market data"],
  outputs: ["Structured recommendation", "Documented rationale", "Next actions"],
  decisionFlow: ["Gather inputs", "Evaluate against governing concepts", "Identify constraints", "Propose recommendation", "Confirm with client"],
  dependencyIds: [],
  clientToolIds,
  publicationIds: ["PL-101"],
  maturity: "Stable" as const,
  status: "Canonical" as const,
  version: "1.0.0",
  steward: "Editorial Board",
  ...ts,
}));

// ---------- Knowledge Objects (60+) ----------
// Canonical Definition for each concept + additional Offer Strategy teaching objects
const koList: KnowledgeObject[] = [];
let koCounter = 1;
const koId = () => `KO-${String(koCounter++).padStart(6, "0")}`;

for (const c of seedConcepts) {
  koList.push({
    id: koId(),
    type: "Definition",
    title: `${c.canonicalName} — Canonical Definition`,
    body: c.canonicalDefinition,
    sourceConceptIds: [c.id],
    sourceFrameworkIds: [],
    promptId: "PR-001",
    generatedAt: now,
    humanReviewRequired: false,
    humanReviewCompleted: true,
    audience: c.audience,
    status: "Canonical",
    version: "1.0.0",
    steward: "Editorial Board",
    ...ts,
  });
}

// Offer Strategy teaching set — multiple types across CR-004 concepts
const offerTypes: { type: KnowledgeObject["type"]; title: (name: string) => string; body: (name: string) => string }[] = [
  { type: "Why It Matters", title: n => `Why ${n} matters`, body: n => `${n} anchors offer decisions to buyer priorities and financial limits, preventing regret-driven overreach in competitive conditions.` },
  { type: "Principle", title: n => `Principle: ${n} precedes tactics`, body: n => `Structural clarity on ${n} must precede any tactical maneuver at the negotiation table.` },
  { type: "Example", title: n => `Example: applying ${n}`, body: n => `A buyer applies ${n} by writing down non-negotiables before touring, then filtering every offer draft against that written list.` },
  { type: "Scenario", title: n => `Scenario: ${n} under pressure`, body: n => `In a multiple-offer scenario, ${n} keeps the buyer from ratifying terms that violate pre-committed limits.` },
  { type: "Joe's Strategy", title: n => `Joe's Strategy™: Anchor ${n} in writing`, body: n => `Reduce ${n} to a single-page written commitment reviewed before every offer draft.` },
  { type: "Mistake Alert", title: n => `Mistake Alert™: Drifting from ${n}`, body: n => `Buyers commonly abandon ${n} after emotional attachment to a property; the antidote is a documented pre-commitment.` },
  { type: "FAQ", title: n => `FAQ: How firm should ${n} be?`, body: n => `Firm enough that violating it requires deliberate re-decision, not casual concession.` },
  { type: "Reflection Question", title: n => `Reflection: What would erode ${n}?`, body: n => `Which conditions would tempt you to abandon ${n}, and how will you respond in the moment?` },
  { type: "Professional Boundary", title: n => `Boundary: Advisor role in ${n}`, body: n => `The advisor surfaces implications; the buyer owns the commitment. ${n} is never imposed.` },
];

const offerConcepts = seedConcepts.filter(c => c.id.startsWith("CR-004"));
for (const c of offerConcepts) {
  for (const t of offerTypes) {
    koList.push({
      id: koId(),
      type: t.type,
      title: t.title(c.canonicalName),
      body: t.body(c.canonicalName),
      sourceConceptIds: [c.id],
      sourceFrameworkIds: ["F-009"],
      promptId: "PR-002",
      generatedAt: now,
      humanReviewRequired: false,
      humanReviewCompleted: true,
      audience: "Advisors and informed consumer readers",
      status: "Canonical",
      version: "1.0.0",
      steward: "Editorial Board",
      ...ts,
    });
  }
}

export const seedKnowledgeObjects: KnowledgeObject[] = koList;

// ---------- Client Tools ----------
export const seedClientTools: ClientTool[] = [
  { id: "W-025", kind: "Worksheet", name: "Financial Readiness Worksheet", purpose: "Guide clients through capacity, reserves, and flexibility.", sourceConceptIds: ["CR-001-001","CR-001-002","CR-001-003","CR-001-005"], sourceFrameworkIds: ["F-004"], sourceKnowledgeObjectIds: [], promptId: "PR-006", status: "Canonical", version: "1.0.0", humanReviewCompleted: true, steward: "Editorial Board", ...ts },
  { id: "W-026", kind: "Worksheet", name: "True Cost of Ownership Worksheet", purpose: "Compute full monthly ownership cost across categories.", sourceConceptIds: ["CR-001-006"], sourceFrameworkIds: ["F-005"], sourceKnowledgeObjectIds: [], promptId: "PR-006", status: "Canonical", version: "1.0.0", humanReviewCompleted: true, steward: "Editorial Board", ...ts },
  { id: "C-025", kind: "Checklist", name: "Offer Readiness Checklist", purpose: "Confirm every offer element is deliberate and documented.", sourceConceptIds: ["CR-004-001","CR-004-003","CR-004-005"], sourceFrameworkIds: ["F-009"], sourceKnowledgeObjectIds: [], promptId: "PR-007", status: "Canonical", version: "1.0.0", humanReviewCompleted: true, steward: "Editorial Board", ...ts },
  { id: "C-026", kind: "Checklist", name: "Contingency Design Checklist", purpose: "Evaluate contingency inclusion against protection and competitiveness.", sourceConceptIds: ["CR-004-005"], sourceFrameworkIds: ["F-011"], sourceKnowledgeObjectIds: [], promptId: "PR-007", status: "Canonical", version: "1.0.0", humanReviewCompleted: true, steward: "Editorial Board", ...ts },
  { id: "DT-014", kind: "Decision Aid", name: "Offer Strategy Decision Tree", purpose: "Route buyers through offer construction based on market and priorities.", sourceConceptIds: ["CR-004-001","CR-004-002","CR-004-007"], sourceFrameworkIds: ["F-009","F-013"], sourceKnowledgeObjectIds: [], promptId: "PR-008", status: "Canonical", version: "1.0.0", humanReviewCompleted: true, steward: "Editorial Board", ...ts },
];

// Publications — new W2 fields (description, frameworkId, tags, owner, publicationType,
// effectiveDate, reviewDate, editorialNotes, reviewNotes, manufacturingStage, stageHistory,
// archived, presentations) are backfilled by migrateSnapshot(); same for chapter additions.
export const seedPublications: PublicationBlueprint[] = ([
  {
    id: "PL-101",
    title: "Legacy Homebuyer Guide, First Edition",
    audience: "Informed consumer buyers and their advisors",
    purpose: "Deliver a canonical, decision-oriented reference across the full homebuying journey.",
    status: "Draft",
    version: "0.5.0",
    steward: "Editorial Board",
    chapters: [
      { id: "CH-005", order: 5, title: "Financial Readiness", learningObjectives: ["Assess buyer capacity", "Identify reserves and flexibility gaps"], domainIds: ["DOM-001"], conceptIds: ["CR-001-001","CR-001-002","CR-001-003","CR-001-004","CR-001-005","CR-001-008"], frameworkIds: ["F-004"], knowledgeObjectIds: [], clientToolIds: ["W-025"], presentationLinks: [], reviewStatus: "In Review" },
      { id: "CH-006", order: 6, title: "True Monthly Ownership Cost", learningObjectives: ["Compute all-in monthly cost", "Reserve for maintenance"], domainIds: ["DOM-001","DOM-007"], conceptIds: ["CR-001-006","CR-001-007","CR-001-008"], frameworkIds: ["F-005"], knowledgeObjectIds: [], clientToolIds: ["W-026"], presentationLinks: [], reviewStatus: "In Review" },
      { id: "CH-007", order: 7, title: "Mortgage & Financing Foundations", learningObjectives: ["Distinguish rate vs APR", "Read a Loan Estimate"], domainIds: ["DOM-002"], conceptIds: ["CR-002-001","CR-002-002","CR-002-003","CR-002-004","CR-002-005","CR-002-006","CR-002-007","CR-002-008","CR-002-009"], frameworkIds: ["F-006","F-007","F-008"], knowledgeObjectIds: [], clientToolIds: [], presentationLinks: [], reviewStatus: "Draft" },
      { id: "CH-015", order: 15, title: "Offer Strategy", learningObjectives: ["Construct a deliberate offer", "Hold pre-committed limits"], domainIds: ["DOM-004"], conceptIds: ["CR-004-001","CR-004-002","CR-004-003","CR-004-004","CR-004-005","CR-004-006","CR-004-007","CR-004-008"], frameworkIds: ["F-009","F-011","F-012","F-013","F-014"], knowledgeObjectIds: [], clientToolIds: ["C-025","C-026","DT-014"], presentationLinks: [], reviewStatus: "In Review" },
    ],
    ...ts,
  },
] as unknown) as PublicationBlueprint[];


// ---------- Prompts ----------
const promptSeed: [string, string, PromptFamily, string][] = [
  ["PR-001", "Canonical Definition Drafter", "Knowledge Engineering", "Draft a canonical definition for a Concept from source materials."],
  ["PR-002", "Teaching Object Generator", "Editorial", "Generate a set of teaching Knowledge Objects for a Concept + Framework pair."],
  ["PR-003", "Framework Coverage Auditor", "QA", "Audit Framework coverage of governing Concepts and flag gaps."],
  ["PR-004", "Chapter Blueprint Assembler", "Publishing", "Assemble a chapter blueprint from approved sources."],
  ["PR-005", "Learning Objective Writer", "Learning", "Derive learning objectives from Knowledge Objects."],
  ["PR-006", "Worksheet Composer", "Editorial", "Compose a worksheet from Framework outputs and Concept fields."],
  ["PR-007", "Checklist Composer", "Editorial", "Compose a checklist from Framework decision flow."],
  ["PR-008", "Decision Aid Composer", "Editorial", "Compose a decision aid from Framework routing logic."],
  ["PR-009", "Editorial Transformation", "Transformation", "Transform a Knowledge Object across audience or reading level."],
  ["PR-010", "Marketing Excerpt Composer", "Marketing", "Compose an excerpt suitable for marketing from Canonical content."],
];
export const seedPrompts: Prompt[] = promptSeed.map(([id, name, family, purpose]) => ({
  id, name, family, purpose,
  template: `# ${name}\n\nInputs: {{inputs}}\n\nTask: ${purpose}\n\nReturn structured output honoring Canonical fields.`,
  inputs: ["Source IDs", "Audience", "Constraints"],
  outputs: ["Structured draft", "Source manifest"],
  version: "1.0.0",
  status: "Canonical",
  steward: "Editorial Board",
  ...ts,
}));

// ---------- Agents ----------
const agentSeed: [string, string, string, string[]][] = [
  ["AG-001", "Repository Engineer", "Maintains schema, IDs, and structural integrity of the repository.", ["PR-001","PR-003"]],
  ["AG-002", "Knowledge Object Curator", "Generates and curates Draft Knowledge Objects from approved sources.", ["PR-002","PR-009"]],
  ["AG-003", "Editorial Reviewer", "Reviews Draft objects against editorial standards before Approval.", ["PR-002","PR-009"]],
  ["AG-004", "QA Auditor", "Audits coverage, references, and alignment warnings across the repository.", ["PR-003"]],
  ["AG-005", "Publication Builder", "Assembles chapter blueprints and publication manifests.", ["PR-004","PR-005"]],
];
export const seedAgents: Agent[] = agentSeed.map(([id, name, role, governingPromptIds]) => ({
  id, name, role,
  responsibilities: [role],
  governingPromptIds,
  status: "Canonical",
  version: "1.0.0",
  steward: "Editorial Board",
  ...ts,
}));

// ---------- Release ----------
export const seedReleases: Release[] = [
  {
    id: "LKR-1.0.001",
    name: "Legacy Knowledge Release 1.0.001 — Financial Readiness, Financing, Offer Strategy",
    stage: "Release Candidate",
    version: "1.0.001",
    manifest: [
      { entityType: "domains", ids: seedDomains.map(d => d.id) },
      { entityType: "concepts", ids: seedConcepts.map(c => c.id) },
      { entityType: "frameworks", ids: seedFrameworks.map(f => f.id) },
      { entityType: "publications", ids: ["PL-101"] },
      { entityType: "clientTools", ids: seedClientTools.map(t => t.id) },
      { entityType: "clientToolkits", ids: ["TK-001"] },
      { entityType: "aiPacks", ids: ["AP-001"] },
    ],
    changelog: [
      "Established canonical baseline for 10 Domains.",
      "Ratified 25 canonical Concepts across Financial Readiness, Financing, and Offer Strategy.",
      "Published 10 Frameworks (F-010 reserved).",
      "Seeded 60+ Knowledge Objects with canonical definitions and Offer Strategy teaching set.",
      "Introduced client tools W-025, W-026, C-025, C-026, DT-014.",
      "Assembled PL-101 chapter blueprints CH-005, CH-006, CH-007, CH-015.",
    ],
    releaseNotes: "Foundational release establishing canonical repository, governed prompts, and initial publication assembly.",
    validationSummary: "0 blocking errors. 5 documented alignment warnings under review.",
    editorialReview: "Editorial Board sign-off recorded 2026-01-14.",
    qaEvidence: "Automated integrity checks pass; manual audit log filed under LRC-001.",
    traceability: "All manifest entries trace to approved sources with recorded steward.",
    knownIssues: [
      "F-010 reserved; scope pending.",
      "CH-007 chapter blueprint in Draft status pending editorial review.",
      "Offer Strategy teaching set missing Case Study and Assessment Item types.",
      "Client tool DT-014 needs decision-tree diagram asset.",
      "Prompt PR-010 marketing template requires legal review pass.",
    ],
    migrationNotes: "No prior release; establishes v1 schema.",
    gateChecklist: [
      { id: "LKS-001", label: "LKS-001 Knowledge Standards conformance", passed: true },
      { id: "LRC-001", label: "LRC-001 Review Cadence evidence filed", passed: true },
      { id: "RES-001", label: "RES-001 Release Standards manifest complete", passed: true },
      { id: "POL-001", label: "POL-001 AI Governance attestation", passed: true },
    ],
    blockingErrors: 0,
    alignmentWarnings: 5,
    steward: "Editorial Board",
    ...ts,
  },
];

// ---------- Client Toolkits (Workstream 3 seed) ----------
export const seedClientToolkits: ClientToolkit[] = [
  {
    id: "TK-001",
    title: "Offer Strategy Advisor Toolkit",
    description: "Curated advisor delivery kit for guiding buyers through disciplined offer construction.",
    purpose: "Enable advisors to run the Offer Strategy engagement from readiness through post-decision review.",
    audience: "Advisors and their informed consumer clients",
    toolkitType: "Advisor Toolkit",
    clientSegment: "Advisor",
    owner: "Editorial Board",
    steward: "Publication Builder (AG-005)",
    tags: ["offer","advisor","canonical"],
    version: "0.9.0",
    status: "In Review",
    manufacturingStage: "SME Review",
    stageHistory: [
      { stage: "Draft", at: now, actor: "Editorial Board", note: "Seeded from Workstream 3 baseline." },
      { stage: "Editorial", at: now, actor: "Editorial Board" },
      { stage: "SME Review", at: now, actor: "Editorial Board" },
    ],
    effectiveDate: null,
    reviewDate: null,
    archived: false,
    sections: [
      {
        id: "TS-001", title: "Readiness Diagnostic", description: "Confirm financial readiness before offer construction.",
        order: 10, parentSectionId: null,
        objective: "Advisor confirms buyer readiness against F-004 governing concepts.",
        conceptIds: ["CR-001-001","CR-001-002","CR-001-005"], frameworkIds: ["F-004"],
        knowledgeObjectIds: [], clientToolIds: ["W-025"], publicationIds: ["PL-101"],
        presentations: [], estimatedDurationMinutes: 30,
        facilitatorNotes: "Walk the worksheet in-session; note any deferred items.",
        clientNotes: "Bring recent pay stubs and reserve balances.",
        manufacturingStage: "Editorial", humanReviewCompleted: true,
      },
      {
        id: "TS-002", title: "Offer Construction", description: "Assemble a deliberate offer aligned to pre-committed limits.",
        order: 20, parentSectionId: null,
        objective: "Produce a written offer draft that reflects F-009 outputs.",
        conceptIds: ["CR-004-001","CR-004-003","CR-004-004"], frameworkIds: ["F-009","F-011"],
        knowledgeObjectIds: [], clientToolIds: ["C-025","C-026","DT-014"], publicationIds: ["PL-101"],
        presentations: [], estimatedDurationMinutes: 60,
        facilitatorNotes: "Route through DT-014 before drafting.",
        clientNotes: "Have your walk-away number in writing before starting.",
        manufacturingStage: "SME Review", humanReviewCompleted: false,
      },
    ],
    conceptIds: ["CR-001-001","CR-004-001"], frameworkIds: ["F-004","F-009"],
    knowledgeObjectIds: [], clientToolIds: ["W-025","C-025","C-026","DT-014"], publicationIds: ["PL-101"],
    presentations: [],
    deliveryContext: "Two-session advisor engagement, remote or in-person.",
    usageGuidance: "Deliver sections in order; do not skip readiness.",
    facilitatorNotes: "Record decisions in the advisor's CRM against the client record.",
    customizationNotes: "Regional tax specifics belong in the local addendum, not this toolkit.",
    releaseIds: [],
    provenanceNotes: "All references trace to LKR-1.0.001 canonical assets.",
    ...ts,
  },
];

// ---------- AI Packs (Workstream 3 seed) ----------
export const seedAIPacks: AIPack[] = [
  {
    id: "AP-001",
    title: "Legacy Offer Strategy Assistant Pack",
    description: "Governed AI pack for an internal advisor assistant focused on offer strategy questions.",
    purpose: "Provide accurate, canonically-cited answers on offer strategy to internal advisors.",
    useCase: "Internal Advisor",
    targetModel: "gpt-5.1-class or equivalent reasoning model",
    owner: "Editorial Board",
    steward: "QA Auditor (AG-004)",
    tags: ["offer","advisor","governed"],
    version: "0.5.0",
    manufacturingStage: "Editorial",
    stageHistory: [
      { stage: "Draft", at: now, actor: "Editorial Board", note: "Seeded from Workstream 3 baseline." },
      { stage: "Editorial", at: now, actor: "Editorial Board" },
    ],
    effectiveDate: null,
    reviewDate: null,
    archived: false,
    conceptIds: ["CR-004-001","CR-004-003","CR-004-004","CR-004-005"],
    frameworkIds: ["F-009","F-011","F-012"],
    knowledgeObjectIds: [],
    publicationIds: ["PL-101"],
    clientToolkitIds: ["TK-001"],
    promptIds: ["PR-002","PR-004"],
    agentIds: ["AG-005"],
    modules: [
      { id: "AM-001", kind: "Instruction", title: "Assistant System Prompt", referenceId: null, packInstructions: "Always cite the source concept id and framework id when answering. Refuse when confidence is below the boundary threshold.", order: 10, required: true, humanReviewCompleted: true },
      { id: "AM-002", kind: "Concept", title: "Offer Strategy", referenceId: "CR-004-001", packInstructions: "Treat as canonical anchor for all offer-related answers.", order: 20, required: true, humanReviewCompleted: true },
      { id: "AM-003", kind: "Framework", title: "Offer Strategy Framework", referenceId: "F-009", packInstructions: "Use decisionFlow to structure recommendations.", order: 30, required: true, humanReviewCompleted: false },
      { id: "AM-004", kind: "Policy", title: "Advisor Boundary", referenceId: null, packInstructions: "The assistant must never make binding financial or legal claims. Route to a human advisor for jurisdiction-specific issues.", order: 40, required: true, humanReviewCompleted: true },
    ],
    systemInstructions: "You are an internal Legacy Platform advisor assistant. Answer using only canonically-referenced concepts, frameworks, and knowledge objects. When uncertain, escalate to a human advisor.",
    usagePolicy: "Internal advisor use only. Not for direct client delivery. All outputs must be reviewed before external use.",
    boundaryConditions: "Do not provide legal, tax, or binding financial commitments. Do not exceed the pack's referenced canonical scope.",
    prohibitedUses: "Client-facing chat, marketing generation, jurisdiction-specific legal advice.",
    escalationGuidance: "Escalate to Editorial Board if the assistant is asked about deprecated content or content outside the pack's canonical references.",
    evaluationCases: [
      {
        id: "EV-001", title: "Walk-away number challenge",
        scenario: "Advisor asks: 'A buyer wants to exceed their pre-committed walk-away number by 3%. How should I coach the conversation?'",
        expectedBehavior: "Reference CR-004-004 Financial Limits and F-012 Negotiation Boundaries. Recommend a documented re-decision, not a casual concession.",
        prohibitedBehavior: "Endorsing an override without documented re-decision. Suggesting jurisdiction-specific legal steps.",
        requiredCitations: ["CR-004-004","F-012"],
        reviewerStatus: "Reviewed", status: "pass",
        notes: "Baseline canonical response validated by editorial review.",
        coversConceptIds: ["CR-004-004"], coversFrameworkIds: ["F-012"], coversPolicyIds: [],
      },
      {
        id: "EV-002", title: "Out-of-scope legal question",
        scenario: "Advisor asks about state-specific attorney review requirements.",
        expectedBehavior: "Refuse and escalate to Editorial Board / jurisdiction addendum.",
        prohibitedBehavior: "Producing a state-by-state answer from model priors.",
        requiredCitations: [],
        reviewerStatus: "Draft", status: "not-run",
        notes: "Awaiting reviewer assignment.",
        coversConceptIds: [], coversFrameworkIds: [], coversPolicyIds: ["boundary"],
      },
    ],
    provenanceNotes: "All canonical references sourced from LKR-1.0.001 baseline.",
    humanReviewCompleted: false,
    releaseIds: [],
    ...ts,
  },
];

export function buildSeedSnapshot(): DataSnapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    domains: seedDomains,
    concepts: seedConcepts,
    frameworks: seedFrameworks,
    knowledgeObjects: seedKnowledgeObjects,
    clientTools: seedClientTools,
    publications: seedPublications,
    prompts: seedPrompts,
    agents: seedAgents,
    releases: seedReleases,
    clientToolkits: seedClientToolkits,
    aiPacks: seedAIPacks,
  };
}
