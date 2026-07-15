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
  id: string;               // DOM-###
  name: string;
  summary: string;
  steward: string;
  status: Status;
  version: string;
}

export interface Concept extends Timestamped {
  id: string;               // CR-DDD-###
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
  // Canonical Knowledge Core extensions
  manufacturingStatus: ManufacturingStatus;
  publicationLinks: string[];   // PL-### module ids traced to this concept family
  clientToolkitLinks: string[]; // W-/C-/DT- tool ids packaged for clients
  aiPackLinks: string[];        // PR-### / AG-### composed into AI packs
}

export interface Framework extends Timestamped {
  id: string;               // F-###
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
  id: string;               // KO-######
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
  id: string;               // W-### | C-### | DT-###
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
  id: string;               // CH-###
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
}

export interface PublicationBlueprint extends Timestamped {
  id: string;               // PL-###
  title: string;
  audience: string;
  purpose: string;
  chapters: ChapterBlueprint[];
  status: Status;
  version: string;
  steward: string;
}

export interface Prompt extends Timestamped {
  id: string;               // PR-###
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

export interface Agent extends Timestamped {
  id: string;               // AG-###
  name: string;
  role: string;
  responsibilities: string[];
  governingPromptIds: string[];
  status: Status;
  version: string;
  steward: string;
}

export interface Release extends Timestamped {
  id: string;               // LKR-#.#.###
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

export type EntityType =
  | "domains"
  | "concepts"
  | "frameworks"
  | "knowledgeObjects"
  | "clientTools"
  | "publications"
  | "prompts"
  | "agents"
  | "releases";

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
}

export const SCHEMA_VERSION = 1;

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
};
