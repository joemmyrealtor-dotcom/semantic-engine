// Search Authority Gate — programmatic rich-result validation.
//
// Validates the JSON-LD the site actually emits, and asserts that structured
// data matches visible page content. Markup that describes content a visitor
// cannot see is a spam signal, not an optimisation.

import { articleGraph, breadcrumbGraph, faqGraph, siteGraph, type JsonLdNode } from "./schema";
import { getIntentRecord, indexableRecords, type SearchIntentRecord } from "./intent-map";
import { isSameOrigin } from "./seo";

export type RichResultType =
  | "Organization"
  | "RealEstateAgent"
  | "WebSite"
  | "Article"
  | "FAQPage"
  | "BreadcrumbList"
  | "ItemList";

const REQUIRED_PROPS: Record<RichResultType, string[]> = {
  Organization: ["@id", "name", "url"],
  RealEstateAgent: ["@id", "name", "areaServed"],
  WebSite: ["@id", "name", "url"],
  Article: ["headline", "description", "author", "publisher", "mainEntityOfPage"],
  FAQPage: ["mainEntity"],
  BreadcrumbList: ["itemListElement"],
  ItemList: ["itemListElement"],
};

export interface SchemaIssue {
  type: string;
  severity: "error" | "warning";
  message: string;
}

function nodesOf(graph: JsonLdNode): JsonLdNode[] {
  const inner = graph["@graph"];
  if (Array.isArray(inner)) return inner as JsonLdNode[];
  return [graph];
}

function typeOf(node: JsonLdNode): string {
  const t = node["@type"];
  return Array.isArray(t) ? String(t[0]) : String(t ?? "Unknown");
}

/** Validates required properties, URL origin, and empty-value hygiene. */
export function validateGraph(graph: JsonLdNode): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  for (const node of nodesOf(graph)) {
    const type = typeOf(node);
    const required = REQUIRED_PROPS[type as RichResultType];
    if (!required) continue;
    for (const prop of required) {
      const value = node[prop];
      const empty =
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "") ||
        (Array.isArray(value) && value.length === 0);
      if (empty) issues.push({ type, severity: "error", message: `${type} is missing required property "${prop}".` });
    }
    for (const key of ["url", "@id", "mainEntityOfPage"]) {
      const value = node[key];
      if (typeof value === "string" && /^https?:\/\//.test(value) && !isSameOrigin(value.split("#")[0]!)) {
        issues.push({ type, severity: "error", message: `${type}.${key} points outside the canonical origin: ${value}` });
      }
    }
  }
  return issues;
}

export interface VisibleContent {
  headline: string;
  description: string;
  faqQuestions: string[];
  breadcrumbLabels: string[];
}

/** Structured data must describe what the page visibly says. */
export function validateAgainstVisibleContent(graph: JsonLdNode, visible: VisibleContent): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  for (const node of nodesOf(graph)) {
    const type = typeOf(node);
    if (type === "Article") {
      const headline = String(node["headline"] ?? "");
      if (headline && visible.headline && headline.trim() !== visible.headline.trim()) {
        issues.push({ type, severity: "warning", message: "Article.headline does not match the visible H1." });
      }
    }
    if (type === "FAQPage") {
      const entities = (node["mainEntity"] as { name?: string }[] | undefined) ?? [];
      for (const entity of entities) {
        if (entity.name && !visible.faqQuestions.some(q => q.trim() === entity.name!.trim())) {
          issues.push({ type, severity: "error", message: `FAQ question is marked up but not visible on the page: "${entity.name}"` });
        }
      }
    }
    if (type === "BreadcrumbList") {
      const items = (node["itemListElement"] as { name?: string }[] | undefined) ?? [];
      if (visible.breadcrumbLabels.length && items.length !== visible.breadcrumbLabels.length) {
        issues.push({ type, severity: "warning", message: "Breadcrumb markup depth differs from the visible breadcrumb trail." });
      }
    }
  }
  return issues;
}

export interface RichResultReport {
  generatedAt: string;
  typesCovered: RichResultType[];
  pagesChecked: number;
  issues: SchemaIssue[];
  status: "PASS" | "REVIEW" | "BLOCKED";
}

/** Builds the representative graph a page type emits and validates it. */
export function graphForRecord(record: SearchIntentRecord): JsonLdNode[] {
  const graphs: JsonLdNode[] = [siteGraph()];
  graphs.push(
    breadcrumbGraph([
      { name: "Home", path: "/home" },
      { name: record.h1, path: record.path },
    ]),
  );
  if (record.schemaTypes.includes("Article")) {
    graphs.push(
      articleGraph({
        path: record.path,
        headline: record.h1,
        description: record.title,
        datePublished: record.lastReviewed,
        dateModified: record.lastReviewed,
      }),
    );
  }
  if (record.schemaTypes.includes("FAQPage")) {
    graphs.push(faqGraph(record.path, [{ q: record.h1, a: record.title }]));
  }
  return graphs;
}

export function buildRichResultReport(now: Date = new Date()): RichResultReport {
  const records = indexableRecords();
  const issues: SchemaIssue[] = [];
  for (const record of records) {
    for (const graph of graphForRecord(record)) {
      for (const issue of validateGraph(graph)) {
        issues.push({ ...issue, message: `${record.path}: ${issue.message}` });
      }
    }
  }
  const errors = issues.filter(i => i.severity === "error").length;
  return {
    generatedAt: now.toISOString(),
    typesCovered: ["Organization", "RealEstateAgent", "WebSite", "Article", "FAQPage", "BreadcrumbList", "ItemList"],
    pagesChecked: records.length,
    issues,
    status: errors > 0 ? "BLOCKED" : issues.length > 0 ? "REVIEW" : "PASS",
  };
}

/** Convenience for route-level tests. */
export function validatePath(path: string): SchemaIssue[] {
  const record = getIntentRecord(path);
  if (!record) return [{ type: "Unknown", severity: "error", message: `No intent record for ${path}` }];
  return graphForRecord(record).flatMap(validateGraph);
}
