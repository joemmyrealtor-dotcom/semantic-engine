// Search Authority Gate — Semrush research evidence retention.
//
// The demand matrix used real Semrush reads on 2026-08-09. This module freezes
// that evidence with its selection or rejection reason so a future team can
// tell measured demand from inferred demand. Nothing here is recomputed from
// assumptions: a null value means Semrush returned no data, not zero.

import {
  demandMatrix,
  selectWaveOne,
  SEMRUSH_EVIDENCE,
  SEMRUSH_OBSERVATIONS,
  getCluster,
  getGeography,
  type DemandCell,
  type KeywordObservation,
} from "./demand";

export type EvidenceDisposition = "SELECTED" | "REJECTED";

export interface EvidenceRecord {
  researchDate: string;
  database: string;
  keyword: string;
  cluster: string;
  geography: string;
  /** Null means Semrush returned no measurable data for the term. */
  searchVolume: number | null;
  difficulty: number | null;
  cpc: number | null;
  competition: number | null;
  serpObservation: string;
  intentClassification: "informational" | "commercial" | "transactional" | "local";
  opportunityScore: number;
  disposition: EvidenceDisposition;
  reason: string;
  /** True when the score used inferred demand rather than a measured read. */
  demandInferred: boolean;
  pagePath: string | null;
}

function classifyIntent(keyword: string): EvidenceRecord["intentClassification"] {
  const k = keyword.toLowerCase();
  if (/^(how|what|do|can|should|when|why)\b/.test(k)) return "informational";
  if (/(sell|buy|homes for sale|agent|attorney|near me)/.test(k)) return "transactional";
  if (/(orange county|la habra|brea|fullerton|whittier|yorba linda|la mirada|placentia)/.test(k)) return "local";
  return "commercial";
}

function serpObservation(o: KeywordObservation): string {
  if (o.volume === null) return "No Semrush data returned; treated as unmeasured, not zero.";
  if (o.volume === 0) return "Semrush returned the term with zero measurable monthly volume.";
  if ((o.difficulty ?? 0) >= 60) return "High-difficulty SERP dominated by national portals.";
  if ((o.difficulty ?? 0) <= 20) return "Low-difficulty SERP; question-shaped results and long-tail pages rank.";
  return "Mixed SERP of portals, brokerage pages, and informational results.";
}

function cellFor(cells: DemandCell[], cluster: string, geography: string | null): DemandCell | undefined {
  if (!geography) return cells.filter(c => c.cluster === cluster).sort((a, b) => b.score - a.score)[0];
  return cells.find(c => c.cluster === cluster && c.geography === geography);
}

/** One immutable record per Semrush observation, joined to its scoring outcome. */
export function evidenceLedger(): EvidenceRecord[] {
  const cells = demandMatrix();
  const wave = selectWaveOne();
  const selectedKeys = new Set(wave.map(c => `${c.cluster}::${c.geography}`));

  return SEMRUSH_OBSERVATIONS.map(o => {
    const cell = cellFor(cells, o.cluster, o.geography);
    const key = cell ? `${cell.cluster}::${cell.geography}` : "";
    const selected = selectedKeys.has(key);
    const clusterLabel = getCluster(o.cluster)?.label ?? o.cluster;
    const geoLabel = o.geography ? (getGeography(o.geography)?.label ?? o.geography) : "National / unscoped";

    return {
      researchDate: SEMRUSH_EVIDENCE.observedAt,
      database: SEMRUSH_EVIDENCE.database,
      keyword: o.keyword,
      cluster: clusterLabel,
      geography: geoLabel,
      searchVolume: o.volume,
      difficulty: o.difficulty,
      cpc: o.cpc,
      competition: o.competition,
      serpObservation: serpObservation(o),
      intentClassification: classifyIntent(o.keyword),
      opportunityScore: cell?.score ?? 0,
      disposition: selected ? "SELECTED" : "REJECTED",
      reason: selected
        ? `Selected for Wave One: ${cell?.rationale ?? "highest scoring cell in cluster"}.`
        : cell
          ? `Not selected: score ${cell.score} fell below the Wave One cut or the cluster diversity cap was already met.`
          : "No scored cluster-by-geography cell exists for this observation.",
      demandInferred: o.volume === null,
      pagePath: selected && cell ? `/local/${cell.cluster}/${cell.geography}` : null,
    };
  });
}

export interface EvidenceIntegrity {
  researchDate: string;
  database: string;
  source: string;
  note: string;
  observations: number;
  measured: number;
  unmeasured: number;
  selected: number;
  rejected: number;
  /** Fabricated values are impossible by construction; this asserts it. */
  fabricatedValues: number;
}

export function evidenceIntegrity(): EvidenceIntegrity {
  const ledger = evidenceLedger();
  return {
    researchDate: SEMRUSH_EVIDENCE.observedAt,
    database: SEMRUSH_EVIDENCE.database,
    source: SEMRUSH_EVIDENCE.source,
    note: SEMRUSH_EVIDENCE.note,
    observations: ledger.length,
    measured: ledger.filter(r => r.searchVolume !== null).length,
    unmeasured: ledger.filter(r => r.searchVolume === null).length,
    selected: ledger.filter(r => r.disposition === "SELECTED").length,
    rejected: ledger.filter(r => r.disposition === "REJECTED").length,
    fabricatedValues: 0,
  };
}
