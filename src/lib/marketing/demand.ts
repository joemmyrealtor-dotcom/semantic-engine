// Local SEO Expansion — Phase 1: the demand matrix.
//
// GOVERNANCE
//  * Every search metric in SEMRUSH_OBSERVATIONS was returned by the Semrush
//    connector on the date recorded below. Nothing is estimated, smoothed, or
//    invented. A term Semrush had no data for is recorded as `volume: null`
//    and scores as unknown demand — never as zero-by-assumption.
//  * Scoring weights conversion intent and topical fit above raw volume,
//    per the owner's direction.
//  * This module produces a research artifact and a build order. It does not
//    publish anything.

import type { EntryPathId } from "./positioning";

export type ClusterId =
  | "probate"
  | "inherited-property"
  | "downsizing"
  | "distressed-property"
  | "pre-foreclosure"
  | "selling"
  | "buying"
  | "investing"
  | "divorce"
  | "trust-property"
  | "sell-vs-rent"
  | "home-equity";

export type GeographyId =
  | "la-habra"
  | "brea"
  | "fullerton"
  | "whittier"
  | "la-mirada"
  | "yorba-linda"
  | "orange"
  | "orange-county";

export interface ServiceCluster {
  id: ClusterId;
  label: string;
  /** Pillar page this cluster reports to. */
  pillarPath: string;
  situation: EntryPathId;
  guideSlug: string;
  assessmentSlug: string;
  /** Head term used for the cluster-level Semrush read. */
  headKeyword: string;
  /** 1–5, editor-scored. Documented rubric in docs/LOCAL-SEO-PHASE1.md. */
  conversionIntent: number;
  topicalFit: number;
  localIntent: number;
  uniqueContentAbility: number;
  partnerRelevance: number;
  /** 1–5 penalty: how much an existing Legacy Forge page already covers it. */
  existingOverlap: number;
}

export const CLUSTERS: ServiceCluster[] = [
  { id: "probate", label: "Probate", pillarPath: "/probate", situation: "probate", guideSlug: "probate-property-roadmap", assessmentSlug: "probate-property", headKeyword: "probate real estate", conversionIntent: 5, topicalFit: 5, localIntent: 5, uniqueContentAbility: 5, partnerRelevance: 5, existingOverlap: 3 },
  { id: "inherited-property", label: "Inherited property", pillarPath: "/inherited-property", situation: "inherited-property", guideSlug: "sell-vs-rent", assessmentSlug: "probate-property", headKeyword: "sell inherited house", conversionIntent: 5, topicalFit: 5, localIntent: 4, uniqueContentAbility: 5, partnerRelevance: 5, existingOverlap: 3 },
  { id: "downsizing", label: "Downsizing", pillarPath: "/downsizing", situation: "downsizing", guideSlug: "downsizing-made-simple", assessmentSlug: "downsizing-readiness", headKeyword: "downsizing home", conversionIntent: 4, topicalFit: 5, localIntent: 4, uniqueContentAbility: 4, partnerRelevance: 4, existingOverlap: 3 },
  { id: "distressed-property", label: "Distressed property", pillarPath: "/distressed-property", situation: "distressed-property", guideSlug: "pre-foreclosure-options", assessmentSlug: "distressed-options", headKeyword: "short sale", conversionIntent: 5, topicalFit: 4, localIntent: 4, uniqueContentAbility: 4, partnerRelevance: 4, existingOverlap: 3 },
  { id: "pre-foreclosure", label: "Pre-foreclosure", pillarPath: "/distressed-property", situation: "distressed-property", guideSlug: "pre-foreclosure-options", assessmentSlug: "distressed-options", headKeyword: "pre foreclosure", conversionIntent: 5, topicalFit: 4, localIntent: 4, uniqueContentAbility: 4, partnerRelevance: 3, existingOverlap: 3 },
  { id: "selling", label: "Selling a home", pillarPath: "/sellers", situation: "sellers", guideSlug: "seller-decision-guide", assessmentSlug: "seller-readiness", headKeyword: "sell my house", conversionIntent: 5, topicalFit: 5, localIntent: 5, uniqueContentAbility: 4, partnerRelevance: 2, existingOverlap: 4 },
  { id: "buying", label: "Buying a home", pillarPath: "/buyers", situation: "buyers", guideSlug: "buyer-decision-guide", assessmentSlug: "buyer-readiness", headKeyword: "buying a house", conversionIntent: 4, topicalFit: 4, localIntent: 5, uniqueContentAbility: 3, partnerRelevance: 2, existingOverlap: 4 },
  { id: "investing", label: "Real estate investing", pillarPath: "/investing", situation: "investing", guideSlug: "buyer-decision-guide", assessmentSlug: "investor-readiness", headKeyword: "real estate investing", conversionIntent: 3, topicalFit: 3, localIntent: 3, uniqueContentAbility: 3, partnerRelevance: 2, existingOverlap: 3 },
  { id: "divorce", label: "Divorce-related real estate", pillarPath: "/sellers", situation: "sellers", guideSlug: "seller-decision-guide", assessmentSlug: "seller-readiness", headKeyword: "divorce and house", conversionIntent: 5, topicalFit: 4, localIntent: 4, uniqueContentAbility: 5, partnerRelevance: 5, existingOverlap: 1 },
  { id: "trust-property", label: "Trust property", pillarPath: "/probate", situation: "probate", guideSlug: "probate-property-roadmap", assessmentSlug: "probate-property", headKeyword: "trust property sale", conversionIntent: 5, topicalFit: 5, localIntent: 3, uniqueContentAbility: 5, partnerRelevance: 5, existingOverlap: 2 },
  { id: "sell-vs-rent", label: "Sell versus rent", pillarPath: "/inherited-property", situation: "inherited-property", guideSlug: "sell-vs-rent", assessmentSlug: "seller-readiness", headKeyword: "should i sell or rent my house", conversionIntent: 4, topicalFit: 5, localIntent: 3, uniqueContentAbility: 5, partnerRelevance: 3, existingOverlap: 3 },
  { id: "home-equity", label: "Home equity decisions", pillarPath: "/sellers", situation: "sellers", guideSlug: "seller-decision-guide", assessmentSlug: "seller-readiness", headKeyword: "home equity", conversionIntent: 3, topicalFit: 3, localIntent: 2, uniqueContentAbility: 3, partnerRelevance: 3, existingOverlap: 2 },
];

export interface Geography {
  id: GeographyId;
  label: string;
  /** City-guide slug when a submarket page exists; null for the county roll-up. */
  citySlug: string | null;
  /** 1–5 editor score: how well Legacy Forge can speak to this market. */
  localAuthority: number;
  /** 1–5: referral-partner density observed in the Apollo research cohort. */
  partnerDensity: number;
}

export const GEOGRAPHIES: Geography[] = [
  { id: "la-habra", label: "La Habra", citySlug: "la-habra", localAuthority: 5, partnerDensity: 4 },
  { id: "brea", label: "Brea", citySlug: "brea", localAuthority: 5, partnerDensity: 4 },
  { id: "fullerton", label: "Fullerton", citySlug: "fullerton", localAuthority: 5, partnerDensity: 5 },
  { id: "whittier", label: "Whittier", citySlug: "whittier", localAuthority: 4, partnerDensity: 4 },
  { id: "la-mirada", label: "La Mirada", citySlug: "la-mirada", localAuthority: 4, partnerDensity: 3 },
  { id: "yorba-linda", label: "Yorba Linda", citySlug: "yorba-linda", localAuthority: 4, partnerDensity: 3 },
  { id: "orange", label: "Orange", citySlug: "orange", localAuthority: 4, partnerDensity: 5 },
  { id: "orange-county", label: "Orange County", citySlug: null, localAuthority: 5, partnerDensity: 5 },
];

/** A Semrush metric read. `volume: null` means Semrush returned no data. */
export interface KeywordObservation {
  keyword: string;
  cluster: ClusterId;
  geography: GeographyId | null;
  volume: number | null;
  cpc: number | null;
  difficulty: number | null;
  competition: number | null;
}

export const SEMRUSH_EVIDENCE = {
  source: "Semrush (Lovable connector)",
  database: "us",
  observedAt: "2026-08-09",
  note:
    "Cluster head terms are national US reads. Hyperlocal cluster-by-city terms were read directly; most returned no measurable volume, which is the expected pattern for this market and is recorded as unknown, not zero.",
} as const;

export const SEMRUSH_OBSERVATIONS: KeywordObservation[] = [
  // Cluster head terms.
  { keyword: "probate real estate", cluster: "probate", geography: null, volume: 720, cpc: 2.73, difficulty: 40, competition: 0.15 },
  { keyword: "probate sale", cluster: "probate", geography: null, volume: 1300, cpc: 1.35, difficulty: 36, competition: 0.07 },
  { keyword: "can you sell a house in probate", cluster: "probate", geography: null, volume: 210, cpc: 6.07, difficulty: 8, competition: 0.11 },
  { keyword: "do i need probate to sell a house", cluster: "probate", geography: null, volume: 20, cpc: 0, difficulty: 0, competition: 0.43 },
  { keyword: "sell inherited house", cluster: "inherited-property", geography: null, volume: 480, cpc: 11.05, difficulty: 35, competition: 0.43 },
  { keyword: "inherited property", cluster: "inherited-property", geography: null, volume: 480, cpc: 1.98, difficulty: 34, competition: 0.13 },
  { keyword: "how to sell an inherited house", cluster: "inherited-property", geography: null, volume: 110, cpc: 5.56, difficulty: 13, competition: 0.25 },
  { keyword: "capital gains on inherited property", cluster: "inherited-property", geography: null, volume: 1300, cpc: 0.2, difficulty: 38, competition: 0.15 },
  { keyword: "downsizing home", cluster: "downsizing", geography: null, volume: 590, cpc: 0.29, difficulty: 31, competition: 0.1 },
  { keyword: "downsizing checklist for seniors", cluster: "downsizing", geography: null, volume: 110, cpc: 0.17, difficulty: 6, competition: 0.17 },
  { keyword: "short sale", cluster: "distressed-property", geography: null, volume: 12100, cpc: 1.59, difficulty: 54, competition: 0.45 },
  { keyword: "short sale vs foreclosure", cluster: "distressed-property", geography: null, volume: 1300, cpc: 3.37, difficulty: 40, competition: 0.14 },
  { keyword: "pre foreclosure", cluster: "pre-foreclosure", geography: null, volume: 2400, cpc: 1.51, difficulty: 35, competition: 0.13 },
  { keyword: "sell my house", cluster: "selling", geography: null, volume: 18100, cpc: 60.86, difficulty: 79, competition: 0.59 },
  { keyword: "buying a house", cluster: "buying", geography: null, volume: 6600, cpc: 2.37, difficulty: 50, competition: 0.51 },
  { keyword: "real estate investing", cluster: "investing", geography: null, volume: 165000, cpc: 4.96, difficulty: 74, competition: 0.25 },
  { keyword: "divorce and house", cluster: "divorce", geography: null, volume: 110, cpc: 1.97, difficulty: 14, competition: 0.13 },
  { keyword: "selling a house during divorce california", cluster: "divorce", geography: null, volume: 40, cpc: 4.24, difficulty: 6, competition: 0.39 },
  { keyword: "trust property sale", cluster: "trust-property", geography: null, volume: 20, cpc: 0, difficulty: 0, competition: 0.03 },
  { keyword: "should i sell or rent my house", cluster: "sell-vs-rent", geography: null, volume: 390, cpc: 3.21, difficulty: 15, competition: 0.26 },
  { keyword: "sell or rent", cluster: "sell-vs-rent", geography: null, volume: 140, cpc: 3.05, difficulty: 21, competition: 0.17 },
  { keyword: "home equity", cluster: "home-equity", geography: null, volume: 22200, cpc: 9.61, difficulty: 77, competition: 0.44 },

  // Hyperlocal reads. Null volume = Semrush returned no data for the term.
  { keyword: "probate real estate la habra", cluster: "probate", geography: "la-habra", volume: null, cpc: null, difficulty: null, competition: null },
  { keyword: "probate sale orange county", cluster: "probate", geography: "orange-county", volume: 0, cpc: 0, difficulty: 0, competition: 0 },
  { keyword: "probate attorney brea", cluster: "probate", geography: "brea", volume: null, cpc: null, difficulty: null, competition: null },
  { keyword: "sell inherited house fullerton", cluster: "inherited-property", geography: "fullerton", volume: null, cpc: null, difficulty: null, competition: null },
  { keyword: "inherited property whittier", cluster: "inherited-property", geography: "whittier", volume: null, cpc: null, difficulty: null, competition: null },
  { keyword: "inherited house taxes california", cluster: "inherited-property", geography: null, volume: 0, cpc: 0, difficulty: 0, competition: 0 },
  { keyword: "downsizing la mirada", cluster: "downsizing", geography: "la-mirada", volume: null, cpc: null, difficulty: null, competition: null },
  { keyword: "downsizing orange county", cluster: "downsizing", geography: "orange-county", volume: null, cpc: null, difficulty: null, competition: null },
  { keyword: "sell house fast yorba linda", cluster: "distressed-property", geography: "yorba-linda", volume: 10, cpc: 0, difficulty: 0, competition: 0 },
  { keyword: "short sale orange county ca", cluster: "distressed-property", geography: "orange-county", volume: null, cpc: null, difficulty: null, competition: null },
  { keyword: "pre foreclosure orange county", cluster: "pre-foreclosure", geography: "orange-county", volume: 0, cpc: 0, difficulty: 0, competition: 0 },
  { keyword: "sell my house la habra", cluster: "selling", geography: "la-habra", volume: 20, cpc: 0, difficulty: 0, competition: 0 },
  { keyword: "sell my house brea", cluster: "selling", geography: "brea", volume: null, cpc: null, difficulty: null, competition: null },
  { keyword: "sell my house fullerton", cluster: "selling", geography: "fullerton", volume: 10, cpc: 0, difficulty: 0, competition: 0 },
  { keyword: "sell my house whittier", cluster: "selling", geography: "whittier", volume: 10, cpc: 0, difficulty: 0, competition: 0 },
  { keyword: "homes for sale la habra ca", cluster: "buying", geography: "la-habra", volume: 110, cpc: 0.1, difficulty: 37, competition: 0.42 },
  { keyword: "homes for sale brea ca", cluster: "buying", geography: "brea", volume: 110, cpc: 0.17, difficulty: 34, competition: 0.39 },
  { keyword: "homes for sale fullerton ca", cluster: "buying", geography: "fullerton", volume: 320, cpc: 0.2, difficulty: 29, competition: 0.4 },
  { keyword: "homes for sale yorba linda", cluster: "buying", geography: "yorba-linda", volume: 590, cpc: 0.18, difficulty: 32, competition: 0.42 },
  { keyword: "real estate investing orange county", cluster: "investing", geography: "orange-county", volume: null, cpc: null, difficulty: null, competition: null },
  { keyword: "divorce house sale california", cluster: "divorce", geography: null, volume: 10, cpc: 0, difficulty: 0, competition: 0 },
  { keyword: "trust sale property california", cluster: "trust-property", geography: null, volume: null, cpc: null, difficulty: null, competition: null },
  { keyword: "sell or rent my house", cluster: "sell-vs-rent", geography: null, volume: 170, cpc: 4.85, difficulty: 16, competition: 0.37 },
  { keyword: "home equity loan orange county", cluster: "home-equity", geography: "orange-county", volume: 0, cpc: 0, difficulty: 0, competition: 1 },
];

/** Weights sum to 100. Conversion intent and topical fit outrank volume. */
export const SCORE_WEIGHTS = {
  conversionIntent: 24,
  topicalFit: 20,
  localIntent: 12,
  demand: 14,
  difficulty: 10,
  uniqueContent: 10,
  partnerRelevance: 6,
  localAuthority: 4,
} as const;

export interface DemandCell {
  cluster: ClusterId;
  clusterLabel: string;
  geography: GeographyId;
  geographyLabel: string;
  /** 0–100. */
  score: number;
  /** Best measured monthly volume for the cluster; null when unmeasured. */
  clusterVolume: number | null;
  /** Measured local volume for a cluster-by-city term; null when unmeasured. */
  localVolume: number | null;
  /** Semrush difficulty for the cluster head term, when measured. */
  difficulty: number | null;
  /** True when no Semrush datapoint exists for this cluster at all. */
  demandUnknown: boolean;
  rationale: string;
}

function clusterObservations(cluster: ClusterId) {
  return SEMRUSH_OBSERVATIONS.filter(o => o.cluster === cluster);
}

function bestVolume(obs: KeywordObservation[]): number | null {
  const measured = obs.map(o => o.volume).filter((v): v is number => v !== null);
  return measured.length ? Math.max(...measured) : null;
}

/** log-scaled 0–1 so a 165k head term cannot swamp a 210/mo buying question. */
function demandScore(volume: number | null): number {
  if (volume === null) return 0.35; // unknown, not zero — scored conservatively
  if (volume <= 0) return 0.1;
  return Math.min(1, Math.log10(volume + 1) / Math.log10(5000));
}

function difficultyScore(difficulty: number | null): number {
  if (difficulty === null) return 0.5;
  return Math.max(0, 1 - difficulty / 100);
}

export function scoreCell(cluster: ServiceCluster, geo: Geography): DemandCell {
  const obs = clusterObservations(cluster.id);
  const head = obs.find(o => o.keyword === cluster.headKeyword);
  const local = obs.find(o => o.geography === geo.id) ?? null;
  const clusterVolume = bestVolume(obs.filter(o => o.geography === null));
  const localVolume = local?.volume ?? null;

  const w = SCORE_WEIGHTS;
  const raw =
    (cluster.conversionIntent / 5) * w.conversionIntent +
    (cluster.topicalFit / 5) * w.topicalFit +
    (cluster.localIntent / 5) * w.localIntent +
    demandScore(clusterVolume) * w.demand +
    difficultyScore(head?.difficulty ?? null) * w.difficulty +
    (cluster.uniqueContentAbility / 5) * w.uniqueContent +
    ((cluster.partnerRelevance / 5) * 0.6 + (geo.partnerDensity / 5) * 0.4) * w.partnerRelevance +
    (geo.localAuthority / 5) * w.localAuthority;

  // Overlap penalty: an existing page already answering this costs up to 8 pts.
  const penalty = ((cluster.existingOverlap - 1) / 4) * 8;
  const score = Math.round((raw - penalty) * 10) / 10;

  const rationale = [
    `Conversion intent ${cluster.conversionIntent}/5, topical fit ${cluster.topicalFit}/5.`,
    clusterVolume === null
      ? "No Semrush volume measured for this cluster — treated as unknown demand."
      : `Cluster head demand ${clusterVolume}/mo${head?.difficulty !== undefined && head?.difficulty !== null ? `, KD ${head.difficulty}` : ""}.`,
    localVolume === null
      ? "No measurable local search volume for the city term."
      : `Local term measured at ${localVolume}/mo.`,
    `Existing-page overlap ${cluster.existingOverlap}/5.`,
  ].join(" ");

  return {
    cluster: cluster.id,
    clusterLabel: cluster.label,
    geography: geo.id,
    geographyLabel: geo.label,
    score,
    clusterVolume,
    localVolume,
    difficulty: head?.difficulty ?? null,
    demandUnknown: clusterVolume === null,
    rationale,
  };
}

/** All 96 cluster × geography cells, highest score first. */
export function demandMatrix(): DemandCell[] {
  const cells: DemandCell[] = [];
  for (const cluster of CLUSTERS) {
    for (const geo of GEOGRAPHIES) cells.push(scoreCell(cluster, geo));
  }
  return cells.sort((a, b) =>
    b.score === a.score ? `${a.cluster}${a.geography}`.localeCompare(`${b.cluster}${b.geography}`) : b.score - a.score,
  );
}

export interface WaveOptions {
  /** Hard cap on first-wave pages. */
  limit?: number;
  /** Prevents one cluster from monopolising the wave. */
  maxPerCluster?: number;
  /** Prevents one city from monopolising the wave. */
  maxPerGeography?: number;
  /** Cells below this score do not earn a page. */
  minScore?: number;
}

/**
 * First wave: the highest-value cells only, with diversity guards so the wave
 * is a topic graph rather than eight near-identical pages of one cluster.
 */
export function selectWaveOne(options: WaveOptions = {}): DemandCell[] {
  const { limit = 16, maxPerCluster = 3, maxPerGeography = 3, minScore = 60 } = options;
  const perCluster = new Map<ClusterId, number>();
  const perGeo = new Map<GeographyId, number>();
  const chosen: DemandCell[] = [];

  for (const cell of demandMatrix()) {
    if (chosen.length >= limit) break;
    if (cell.score < minScore) continue;
    if ((perCluster.get(cell.cluster) ?? 0) >= maxPerCluster) continue;
    if ((perGeo.get(cell.geography) ?? 0) >= maxPerGeography) continue;
    perCluster.set(cell.cluster, (perCluster.get(cell.cluster) ?? 0) + 1);
    perGeo.set(cell.geography, (perGeo.get(cell.geography) ?? 0) + 1);
    chosen.push(cell);
  }

  return chosen;
}

export function getCluster(id: ClusterId): ServiceCluster | undefined {
  return CLUSTERS.find(c => c.id === id);
}

export function getGeography(id: GeographyId): Geography | undefined {
  return GEOGRAPHIES.find(g => g.id === id);
}
