// Task 26 — Partner store.
//
// Durable local store for the research cohort. Apollo is the research source
// and HubSpot is the relationship system of record; this store is the working
// set in between, and every write is deduplicated on identity key.

import {
  RELATIONSHIP_STAGES,
  partnerIdentityKey,
  partnerSchema,
  type Partner,
  type PartnerInput,
  type RelationshipStage,
} from "./schema";
import { scorePartner } from "./scoring";

const KEY = "lf.partners.v1";
const LOG_KEY = "lf.partner-activity.v1";

export interface PartnerActivity {
  id: string;
  partnerId: string;
  at: string;
  kind:
    | "created"
    | "updated"
    | "stage_changed"
    | "outreach_drafted"
    | "outreach_approved"
    | "outreach_sent"
    | "linkedin"
    | "hubspot_handoff"
    | "referral_received";
  detail: string;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function read<T>(key: string): T[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, rows: T[]): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(key, JSON.stringify(rows));
  } catch {
    /* quota — the dashboard degrades rather than throwing into a render */
  }
}

export function loadPartners(): Partner[] {
  return read<Partner>(KEY);
}

export function savePartners(rows: Partner[]): void {
  write(KEY, rows);
}

export function clearPartners(): void {
  write(KEY, []);
  write(LOG_KEY, []);
}

export function loadActivity(): PartnerActivity[] {
  return read<PartnerActivity>(LOG_KEY);
}

export function logActivity(entry: Omit<PartnerActivity, "id" | "at">): PartnerActivity {
  const row: PartnerActivity = {
    ...entry,
    id: `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  };
  write(LOG_KEY, [row, ...loadActivity()].slice(0, 500));
  return row;
}

function newId(): string {
  return `pn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizePartner(input: PartnerInput): Partner {
  const now = new Date().toISOString();
  const base = {
    id: input.id ?? newId(),
    contactName: input.contactName,
    company: input.company ?? "",
    role: input.role ?? "",
    partnerTypeId: input.partnerTypeId,
    city: input.city ?? "",
    county: input.county ?? "",
    email: (input.email ?? "").trim().toLowerCase(),
    phone: input.phone ?? "",
    website: input.website ?? "",
    linkedinUrl: input.linkedinUrl ?? "",
    apolloId: input.apolloId ?? "",
    serviceArea: input.serviceArea ?? [],
    referralFitTier: input.referralFitTier ?? "Research",
    relationshipStage: input.relationshipStage ?? "Identified",
    lastContactAt: input.lastContactAt ?? "",
    nextAction: input.nextAction ?? "",
    nextActionDueAt: input.nextActionDueAt ?? "",
    notes: input.notes ?? "",
    leadSource: input.leadSource ?? "apollo",
    outreachStatus: input.outreachStatus ?? "not_contacted",
    linkedinStatus: input.linkedinStatus ?? "not_sent",
    hubspotContactId: input.hubspotContactId ?? "",
    owner: input.owner ?? "Joe Melendez",
    reviewed: input.reviewed ?? false,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };

  // Score is always recomputed from current data — never trusted from input.
  const score = scorePartner({
    partnerTypeId: base.partnerTypeId,
    city: base.city,
    serviceArea: base.serviceArea,
    role: base.role,
    website: base.website,
    linkedinUrl: base.linkedinUrl,
    emailPresent: Boolean(base.email),
  });

  return partnerSchema.parse({ ...base, referralFitTier: score.tier }) as Partner;
}

export interface UpsertResult {
  partner: Partner;
  created: boolean;
}

/** Insert or merge by identity key. Never creates a second row for one person. */
export function upsertPartner(input: PartnerInput, rows = loadPartners()): UpsertResult {
  const key = partnerIdentityKey(input);
  const existing = rows.find(r => partnerIdentityKey(r) === key);
  if (existing) {
    // Merge: incoming non-empty values win, manual stage/review state is kept.
    const merged = normalizePartner({
      ...existing,
      ...stripEmpty(input),
      id: existing.id,
      createdAt: existing.createdAt,
      relationshipStage: existing.relationshipStage,
      reviewed: existing.reviewed,
      outreachStatus: existing.outreachStatus,
      hubspotContactId: existing.hubspotContactId || (input.hubspotContactId ?? ""),
    });
    savePartners(rows.map(r => (r.id === existing.id ? merged : r)));
    return { partner: merged, created: false };
  }
  const created = normalizePartner(input);
  savePartners([created, ...rows]);
  logActivity({ partnerId: created.id, kind: "created", detail: `${created.company || created.contactName}` });
  return { partner: created, created: true };
}

function stripEmpty(input: PartnerInput): Partial<Partner> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as Partial<Partner>;
}

export function updatePartner(id: string, patch: Partial<Partner>): Partner | undefined {
  const rows = loadPartners();
  const current = rows.find(r => r.id === id);
  if (!current) return undefined;
  const next = normalizePartner({ ...current, ...patch, id, createdAt: current.createdAt });
  savePartners(rows.map(r => (r.id === id ? next : r)));
  return next;
}

export function setStage(id: string, stage: RelationshipStage): Partner | undefined {
  if (!RELATIONSHIP_STAGES.includes(stage)) return undefined;
  const next = updatePartner(id, { relationshipStage: stage });
  if (next) logActivity({ partnerId: id, kind: "stage_changed", detail: stage });
  return next;
}

export function markReviewed(id: string, reviewed = true): Partner | undefined {
  const next = updatePartner(id, {
    reviewed,
    outreachStatus: reviewed ? "approved_for_outreach" : "review_pending",
    ...(reviewed ? { relationshipStage: "Outreach Ready" as RelationshipStage } : {}),
  });
  if (next) {
    logActivity({
      partnerId: id,
      kind: reviewed ? "outreach_approved" : "outreach_drafted",
      detail: reviewed ? "Approved for outreach" : "Returned to review",
    });
  }
  return next;
}
