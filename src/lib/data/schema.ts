// Legacy Platform v2.0 — Entity Schema
// All entities share timestamps and lifecycle status.

export type Role = "Owner" | "Editor" | "Reviewer" | "Contributor" | "Viewer";

export type Status =
  | "Draft"
  | "In Review"
  | "Approved"
  | "Canonical"
  | "Deprecated"
  | "Archived";

export type ReleaseStage =
  | "Planned"
  | "Build"
  | "Review"
  | "QA"
  | "Release Candidate"
  | "Canonical"
  | "Archived";

export type PromptFamily =
  | "Knowledge Engineering"
  | "Editorial"
  | "Publishing"
  | "Learning"
  | "QA"
  | "Transformation"
  | "Marketing";

export type ManufacturingStatus = "Draft" | "Editorial" | "QA" | "Canonical";

export const MANUFACTURING_STATUSES: ManufacturingStatus[] = ["Draft", "Editorial", "QA", "Canonical"];

// Workstream 2/3 — unified manufacturing pipeline shared by
// publications, toolkits, and AI packs.
export type PublicationStage =
  | "Draft"
  | "Editorial"
  | "SME Review"
  | "QA"
  | "Canonical"
  | "Released";

export const PUBLICATION_STAGES: PublicationStage[] = [
  "Draft", "Editorial", "SME Review", "QA", "Canonical", "Released",
];

// Alias for the shared pipeline (used by toolkits and AI packs).
export type ManufacturingStage = PublicationStage;
export const MANUFACTURING_STAGES: ManufacturingStage[] = PUBLICATION_STAGES;

export type PublicationType =
  | "Book" | "Guide" | "Course" | "Toolkit" | "Playbook" | "Report" | "Reference";

export const PUBLICATION_TYPES: PublicationType[] = [
  "Book","Guide","Course","Toolkit","Playbook","Report","Reference",
];

export type PresentationKind =
  | "Slide Deck" | "Workshop" | "Training Video" | "Presentation" | "Course" | "Client Delivery";

export const PRESENTATION_KINDS: PresentationKind[] = [
  "Slide Deck","Workshop","Training Video","Presentation","Course","Client Delivery",
];

export interface PresentationLink {
  id: string;
  kind: PresentationKind;
  title: string;
  url: string;
  notes?: string;
}

export interface StageHistoryEntry {
  stage: ManufacturingStage;
  at: string;
  actor: string;
  note?: string;
}

export type KnowledgeObjectType =
  | "Definition"
  | "Why It Matters"
  | "Principle"
  | "Explanation"
  | "Example"
  | "Scenario"
  | "Case Study"
  | "Joe's Strategy"
  | "Mistake Alert"
  | "FAQ"
  | "Reflection Question"
  | "Professional Boundary"
  | "Assessment Item"
  | "Key Insight"
  | "Application Guide";

export const KNOWLEDGE_OBJECT_TYPES: KnowledgeObjectType[] = [
  "Definition", "Why It Matters", "Principle", "Explanation", "Example",
  "Scenario", "Case Study", "Joe's Strategy", "Mistake Alert", "FAQ",
  "Reflection Question", "Professional Boundary", "Assessment Item",
  "Key Insight", "Application Guide",
];

export interface Timestamped {
  createdAt: string;
  updatedAt: string;
}

export interface Domain extends Timestamped {
  id: string;
  name: string;
  summary: string;
  steward: string;
  status: Status;
  version: string;
}

export interface Concept extends Timestamped {
  id: string;
  canonicalName: string;
  canonicalDefinition: string;
  purpose: string;
  scope: string;
  exclusions: string;
  domainIds: string[];
  aliases: string[];
  keywords: string[];
  relatedConceptIds: string[];
  frameworkIds: string[];
  audience: string;
  readingLevel: string;
  aiRetrievalTags: string[];
  steward: string;
  status: Status;
  version: string;
  reviewCadenceMonths: number;
  lastReviewedAt: string | null;
  humanReviewCompleted: boolean;
  manufacturingStatus: ManufacturingStatus;
  publicationLinks: string[];
  clientToolkitLinks: string[];
  aiPackLinks: string[];
}

export interface Framework extends Timestamped {
  id: string;
  name: string;
  mission: string;
  decisionSolved: string;
  governingConceptIds: string[];
  inputs: string[];
  outputs: string[];
  decisionFlow: string[];
  dependencyIds: string[];
  clientToolIds: string[];
  publicationIds: string[];
  maturity: "Emerging" | "Working" | "Stable" | "Canonical";
  status: Status;
  version: string;
  steward: string;
}

export interface KnowledgeObject extends Timestamped {
  id: string;
  type: KnowledgeObjectType;
  title: string;
  body: string;
  sourceConceptIds: string[];
  sourceFrameworkIds: string[];
  promptId: string | null;
  generatedAt: string | null;
  humanReviewRequired: boolean;
  humanReviewCompleted: boolean;
  audience: string;
  status: Status;
  version: string;
  steward: string;
}

export interface ClientTool extends Timestamped {
  id: string;
  kind: "Worksheet" | "Checklist" | "Decision Aid";
  name: string;
  purpose: string;
  sourceConceptIds: string[];
  sourceFrameworkIds: string[];
  sourceKnowledgeObjectIds: string[];
  promptId: string | null;
  status: Status;
  version: string;
  humanReviewCompleted: boolean;
  steward: string;
}

export interface ChapterBlueprint {
  id: string;
  title: string;
  learningObjectives: string[];
  domainIds: string[];
  conceptIds: string[];
  frameworkIds: string[];
  knowledgeObjectIds: string[];
  clientToolIds: string[];
  presentationLinks: string[];
  reviewStatus: Status;
  order: number;
  description: string;
  editorialNotes: string;
  estimatedEffortHours: number;
  chapterVersion: string;
  parentChapterId: string | null;
  presentations: PresentationLink[];
  manufacturingStage: PublicationStage;
}

export interface PublicationBlueprint extends Timestamped {
  id: string;
  title: string;
  audience: string;
  purpose: string;
  chapters: ChapterBlueprint[];
  status: Status;
  version: string;
  steward: string;
  description: string;
  frameworkId: string | null;
  tags: string[];
  owner: string;
  publicationType: PublicationType;
  effectiveDate: string | null;
  reviewDate: string | null;
  editorialNotes: string;
  reviewNotes: string;
  manufacturingStage: PublicationStage;
  stageHistory: StageHistoryEntry[];
  archived: boolean;
  presentations: PresentationLink[];
}

export interface Prompt extends Timestamped {
  id: string;
  name: string;
  family: PromptFamily;
  purpose: string;
  template: string;
  inputs: string[];
  outputs: string[];
  version: string;
  status: Status;
  steward: string;
}

export type AgentUseCase =
  | "Advisory Assistant" | "Editorial Assistant" | "QA Auditor"
  | "Content Author" | "Client Coach" | "Compliance Reviewer" | "Retrieval Bot";
export const AGENT_USE_CASES: AgentUseCase[] = [
  "Advisory Assistant","Editorial Assistant","QA Auditor",
  "Content Author","Client Coach","Compliance Reviewer","Retrieval Bot",
];

export type AgentEvaluationStatus = "not-run" | "pass" | "fail";

export interface AgentSpecification {
  id: string;                         // AS-###
  version: string;
  isActive: boolean;
  systemPrompt: string;
  capabilities: string[];
  tools: string[];
  boundaries: string;
  safetyPolicy: string;
  changelog: string;
  author: string;
  createdAt: string;
}

export interface AgentEvaluationCase {
  id: string;                         // AE-###
  title: string;
  scenario: string;
  expectedBehavior: string;
  prohibitedBehavior: string;
  requiredCitations: string[];
  reviewerStatus: "Draft" | "Reviewed" | "Approved";
  status: AgentEvaluationStatus;
  notes: string;
  coversConceptIds: string[];
  coversFrameworkIds: string[];
}

export interface Agent extends Timestamped {
  id: string;
  name: string;
  role: string;
  responsibilities: string[];
  governingPromptIds: string[];
  status: Status;
  version: string;
  steward: string;

  // Workstream 4 additions
  description: string;
  purpose: string;
  useCase: AgentUseCase;
  targetModel: string;
  owner: string;
  tags: string[];
  archived: boolean;
  manufacturingStage: ManufacturingStage;
  stageHistory: StageHistoryEntry[];
  effectiveDate: string | null;
  reviewDate: string | null;
  conceptIds: string[];
  frameworkIds: string[];
  knowledgeObjectIds: string[];
  publicationIds: string[];
  clientToolkitIds: string[];
  aiPackIds: string[];
  clientToolIds: string[];
  specifications: AgentSpecification[];
  evaluationCases: AgentEvaluationCase[];
  usagePolicy: string;
  boundaryConditions: string;
  prohibitedUses: string;
  escalationGuidance: string;
  provenanceNotes: string;
  humanReviewCompleted: boolean;
  releaseIds: string[];
}

export interface Release extends Timestamped {
  id: string;
  name: string;
  stage: ReleaseStage;
  version: string;
  manifest: { entityType: string; ids: string[] }[];
  changelog: string[];
  releaseNotes: string;
  validationSummary: string;
  editorialReview: string;
  qaEvidence: string;
  traceability: string;
  knownIssues: string[];
  migrationNotes: string;
  gateChecklist: { id: string; label: string; passed: boolean }[];
  blockingErrors: number;
  alignmentWarnings: number;
  steward: string;
}

// ===================================================================
// Workstream 3 — Client Toolkits
// ===================================================================

export type ClientToolkitType =
  | "Advisor Toolkit"
  | "Client Delivery Kit"
  | "Workshop Kit"
  | "Onboarding Kit"
  | "Assessment Kit"
  | "Playbook";

export const CLIENT_TOOLKIT_TYPES: ClientToolkitType[] = [
  "Advisor Toolkit","Client Delivery Kit","Workshop Kit","Onboarding Kit","Assessment Kit","Playbook",
];

export type ClientSegment =
  | "First-Time Buyer"
  | "Move-Up Buyer"
  | "Downsizer"
  | "Investor"
  | "Advisor"
  | "Enterprise";

export const CLIENT_SEGMENTS: ClientSegment[] = [
  "First-Time Buyer","Move-Up Buyer","Downsizer","Investor","Advisor","Enterprise",
];

export interface ClientToolkitSection {
  id: string;                              // TS-###
  title: string;
  description: string;
  order: number;
  parentSectionId: string | null;
  objective: string;                       // learning or delivery objective
  conceptIds: string[];
  frameworkIds: string[];
  knowledgeObjectIds: string[];
  clientToolIds: string[];
  publicationIds: string[];
  presentations: PresentationLink[];
  estimatedDurationMinutes: number;
  facilitatorNotes: string;
  clientNotes: string;
  manufacturingStage: ManufacturingStage;
  humanReviewCompleted: boolean;
}

export interface ClientToolkit extends Timestamped {
  id: string;                              // TK-###
  title: string;
  description: string;
  purpose: string;
  audience: string;
  toolkitType: ClientToolkitType;
  clientSegment: ClientSegment;
  owner: string;
  steward: string;
  tags: string[];
  version: string;
  status: Status;
  manufacturingStage: ManufacturingStage;
  stageHistory: StageHistoryEntry[];
  effectiveDate: string | null;
  reviewDate: string | null;
  archived: boolean;

  sections: ClientToolkitSection[];

  // Top-level canonical references (in addition to per-section refs)
  conceptIds: string[];
  frameworkIds: string[];
  knowledgeObjectIds: string[];
  clientToolIds: string[];
  publicationIds: string[];
  presentations: PresentationLink[];

  deliveryContext: string;
  usageGuidance: string;
  facilitatorNotes: string;
  customizationNotes: string;

  releaseIds: string[];
  provenanceNotes: string;
}

// ===================================================================
// Workstream 3 — AI Packs
// ===================================================================

export type AIPackUseCase =
  | "Retrieval"
  | "Reasoning"
  | "Drafting"
  | "Assessment"
  | "Compliance Review"
  | "Client-Facing Assistant"
  | "Internal Advisor";

export const AI_PACK_USE_CASES: AIPackUseCase[] = [
  "Retrieval","Reasoning","Drafting","Assessment","Compliance Review","Client-Facing Assistant","Internal Advisor",
];

export type AIPackModuleKind =
  | "Concept"
  | "Framework"
  | "Knowledge Object"
  | "Publication"
  | "Client Toolkit"
  | "Prompt"
  | "Agent"
  | "Policy"
  | "Instruction";

export interface AIPackModule {
  id: string;                              // AM-###
  kind: AIPackModuleKind;
  title: string;
  referenceId: string | null;              // canonical asset id when kind references a repo entity
  packInstructions: string;                // pack-specific overlay text (never overrides canonical content)
  order: number;
  required: boolean;
  humanReviewCompleted: boolean;
}

export type EvaluationStatus = "not-run" | "pass" | "fail";

export interface AIPackEvaluationCase {
  id: string;                              // EV-###
  title: string;
  scenario: string;
  expectedBehavior: string;
  prohibitedBehavior: string;
  requiredCitations: string[];             // ids of concepts/frameworks/KOs
  reviewerStatus: "Draft" | "Reviewed" | "Approved";
  status: EvaluationStatus;
  notes: string;
  coversConceptIds: string[];
  coversFrameworkIds: string[];
  coversPolicyIds: string[];
}

export interface AIPack extends Timestamped {
  id: string;                              // AP-###
  title: string;
  description: string;
  purpose: string;
  useCase: AIPackUseCase;
  targetModel: string;
  owner: string;
  steward: string;
  tags: string[];
  version: string;
  manufacturingStage: ManufacturingStage;
  stageHistory: StageHistoryEntry[];
  effectiveDate: string | null;
  reviewDate: string | null;
  archived: boolean;

  // Canonical asset references
  conceptIds: string[];
  frameworkIds: string[];
  knowledgeObjectIds: string[];
  publicationIds: string[];
  clientToolkitIds: string[];
  promptIds: string[];
  agentIds: string[];

  modules: AIPackModule[];

  // Governance and policy
  systemInstructions: string;
  usagePolicy: string;
  boundaryConditions: string;
  prohibitedUses: string;
  escalationGuidance: string;

  evaluationCases: AIPackEvaluationCase[];

  provenanceNotes: string;
  humanReviewCompleted: boolean;
  releaseIds: string[];
}

// ===================================================================
// Snapshot & Entity keys
// ===================================================================

export type EntityType =
  | "domains"
  | "concepts"
  | "frameworks"
  | "knowledgeObjects"
  | "clientTools"
  | "publications"
  | "prompts"
  | "agents"
  | "releases"
  | "clientToolkits"
  | "aiPacks"
  | "automations"
  | "automationRuns";

// ===================================================================
// Workstream 5 — Automation, Orchestration, Operational Governance
// ===================================================================

export type AutomationTriggerKind =
  | "manual" | "stage-transition" | "readiness-threshold" | "release-gate"
  | "review-due" | "broken-reference" | "coverage-gap" | "canonical-updated" | "scheduled"
  // Workstream 6 — Knowledge Intelligence triggers
  | "duplicate-detected" | "knowledge-health-threshold" | "dependency-change"
  | "relationship-added" | "relationship-removed" | "coverage-drop";

export const AUTOMATION_TRIGGER_KINDS: AutomationTriggerKind[] = [
  "manual","stage-transition","readiness-threshold","release-gate",
  "review-due","broken-reference","coverage-gap","canonical-updated","scheduled",
  "duplicate-detected","knowledge-health-threshold","dependency-change",
  "relationship-added","relationship-removed","coverage-drop",
];

export type AutomationActionKind =
  | "generate-readiness-report" | "assign-review-checkpoint" | "notify-owner"
  | "add-release-candidate" | "remove-release-candidate" | "block-release"
  | "create-draft-asset" | "link-canonical-asset" | "update-metadata"
  | "export-manifest" | "request-promotion" | "escalate-overdue-review"
  | "flag-broken-references";

export const AUTOMATION_ACTION_KINDS: AutomationActionKind[] = [
  "generate-readiness-report","assign-review-checkpoint","notify-owner",
  "add-release-candidate","remove-release-candidate","block-release",
  "create-draft-asset","link-canonical-asset","update-metadata",
  "export-manifest","request-promotion","escalate-overdue-review","flag-broken-references",
];

export type AutomationEntityScope =
  | "concept" | "framework" | "knowledgeObject" | "publication"
  | "clientToolkit" | "aiPack" | "agent" | "clientTool" | "release" | "any";

export const AUTOMATION_ENTITY_SCOPES: AutomationEntityScope[] = [
  "concept","framework","knowledgeObject","publication",
  "clientToolkit","aiPack","agent","clientTool","release","any",
];

export type AutomationState = "active" | "paused" | "archived";
export type AutomationRunStatus =
  | "pending" | "running" | "succeeded" | "failed" | "waiting-approval" | "cancelled";
export type AutomationStepStatus =
  | "pending" | "running" | "succeeded" | "failed" | "skipped" | "waiting-approval";

export interface AutomationCondition {
  field: string;
  op: "eq" | "neq" | "gte" | "lte" | "contains";
  value: string | number | boolean;
}

export interface AutomationStep {
  id: string;                            // AST-###
  name: string;
  action: AutomationActionKind;
  parameters: Record<string, string | number | boolean | string[]>;
  conditions: AutomationCondition[];
  requiresApproval: boolean;
  onFailure: "abort" | "continue" | "retry";
}

export interface AutomationApprovalCheckpoint {
  id: string;                            // AC-###
  afterStepId: string | null;            // null => before first step
  approverRole: Role | "Owner";
  instructions: string;
}

export interface AutomationTrigger {
  kind: AutomationTriggerKind;
  entityScope: AutomationEntityScope;
  entityIds: string[];
  readinessThreshold?: number;
  stage?: ManufacturingStage;
  scheduleLabel?: string;
  reviewDueWithinDays?: number;
}

export interface AutomationRecipe extends Timestamped {
  id: string;                            // AUT-###
  name: string;
  description: string;
  owner: string;
  steward: string;
  tags: string[];
  state: AutomationState;
  version: string;
  trigger: AutomationTrigger;
  steps: AutomationStep[];
  approvals: AutomationApprovalCheckpoint[];
  retryPolicy: { maxAttempts: number; backoffSeconds: number };
  concurrencyKey: string;                // "recipe" | "recipe+entity"
  idempotencyWindowMinutes: number;
  lastRunAt: string | null;
  nextEligibleAt: string | null;
  successCount: number;
  failureCount: number;
  changeNotes: string;
}

export interface AutomationStepRun {
  stepId: string;
  status: AutomationStepStatus;
  attempt: number;
  startedAt: string;
  endedAt: string | null;
  output: string;
  error: string | null;
  mutations: string[];
}

export type AutomationRunEventKind =
  | "created" | "started" | "step-succeeded" | "step-failed" | "step-skipped"
  | "awaiting-approval" | "approved" | "rejected" | "completed" | "failed"
  | "cancelled" | "retried" | "concurrency-blocked" | "idempotency-skipped";

export interface AutomationRunEvent {
  at: string;
  actor: string;
  kind: AutomationRunEventKind;
  message: string;
}

export interface AutomationApprovalRecord {
  checkpointId: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejected: boolean;
  note: string;
}

export interface AutomationRun extends Timestamped {
  id: string;                            // RUN-###
  recipeId: string;
  recipeVersion: string;
  recipeSnapshot: AutomationRecipe;      // immutable
  triggerKind: AutomationTriggerKind;
  triggerEventId: string;
  entityIds: string[];
  actor: string;
  status: AutomationRunStatus;
  dryRun: boolean;
  idempotencyKey: string;
  stepRuns: AutomationStepRun[];
  events: AutomationRunEvent[];
  startedAt: string | null;
  completedAt: string | null;
  approvals: AutomationApprovalRecord[];
  errorSummary: string | null;
}

export interface DataSnapshot {
  schemaVersion: number;
  exportedAt: string;
  domains: Domain[];
  concepts: Concept[];
  frameworks: Framework[];
  knowledgeObjects: KnowledgeObject[];
  clientTools: ClientTool[];
  publications: PublicationBlueprint[];
  prompts: Prompt[];
  agents: Agent[];
  releases: Release[];
  clientToolkits: ClientToolkit[];
  aiPacks: AIPack[];
  automations: AutomationRecipe[];
  automationRuns: AutomationRun[];
}

export const SCHEMA_VERSION = 4;

export const ID_PATTERNS: Record<string, RegExp> = {
  domain: /^DOM-\d{3}$/,
  concept: /^CR-\d{3}-\d{3}$/,
  framework: /^F-\d{3}$/,
  knowledgeObject: /^KO-\d{6}$/,
  clientTool: /^(W|C|DT)-\d{3}$/,
  publication: /^PL-\d{3}$/,
  chapter: /^CH-\d{3}$/,
  prompt: /^PR-\d{3}$/,
  agent: /^AG-\d{3}$/,
  release: /^LKR-\d+\.\d+\.\d{3}$/,
  clientToolkit: /^TK-\d{3}$/,
  toolkitSection: /^TS-\d{3}$/,
  aiPack: /^AP-\d{3}$/,
  aiPackModule: /^AM-\d{3}$/,
  evaluationCase: /^EV-\d{3}$/,
  agentSpec: /^AS-\d{3}$/,
  agentEvaluation: /^AE-\d{3}$/,
  automation: /^AUT-\d{3}$/,
  automationStep: /^AST-\d{3}$/,
  automationCheckpoint: /^AC-\d{3}$/,
  automationRun: /^RUN-\d{3}$/,
};
