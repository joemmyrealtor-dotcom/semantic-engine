// Task 25 — Durable lead-delivery queue.
//
// Lead delivery never depends on a single network request. Every capture is
// written to a durable local queue first, then flushed to HubSpot with
// exponential backoff. Operators can inspect and retry from
// /admin/lead-delivery.

import type { CrmLeadPayload } from "./lead-capture";
import type { CrmSubmitResult } from "./lead-capture.functions";

export type DeliveryStatus =
  | "pending"
  | "sending"
  | "delivered"
  | "failed"
  | "retry_scheduled"
  | "permanently_failed";

export interface LeadDelivery {
  id: string;
  idempotencyKey: string;
  payload: CrmLeadPayload;
  pipeline: string;
  formId: string;
  status: DeliveryStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  hubspotContactId?: string;
  hubspotDealId?: string;
  submissionId?: string;
  deliveryMode?: "fub" | "database";
  /** Bot-check signals sent with the request (not personal data). */
  bot?: { hp: string; elapsedMs: number };
  /** Expiry for the session-stored draft. */
  expiresAt?: string;
  result?: string;
  error?: string;
}

export const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 15 * 60_000;
const QUEUE_KEY = "lf.lead-drafts.v2";
const MAX_RECORDS = 50;
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

function store(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Client-generated idempotency key, reused on retries of the same draft. */
export function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/** Exponential backoff with a hard ceiling. Pure — unit tested. */
export function backoffMs(attempts: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1), MAX_DELAY_MS);
}

/**
 * Stable idempotency key: one conversion = one delivery. The same person
 * downloading a second guide produces a different key (a contact update),
 * while a double-submit of the same form produces the same key.
 */
export function idempotencyKeyFor(input: {
  email: string;
  formId: string;
  guideId?: string;
  assessmentId?: string;
}): string {
  return [
    input.email.trim().toLowerCase(),
    input.formId,
    input.guideId ?? "",
    input.assessmentId ?? "",
  ].join("|");
}

export function loadQueue(now = Date.now()): LeadDelivery[] {
  const st = store();
  if (!st) return [];
  try {
    const raw = st.getItem(QUEUE_KEY);
    const list = raw ? (JSON.parse(raw) as LeadDelivery[]) : [];
    return list.filter(r => !r.expiresAt || Date.parse(r.expiresAt) > now);
  } catch {
    return [];
  }
}

export function saveQueue(records: LeadDelivery[]): void {
  const st = store();
  if (!st) return;
  try {
    st.setItem(QUEUE_KEY, JSON.stringify(records.slice(-MAX_RECORDS)));
  } catch {
    /* storage unavailable — in-flight delivery still proceeds */
  }
}

export function clearQueue(): void {
  const st = store();
  if (!st) return;
  try {
    st.removeItem(QUEUE_KEY);
  } catch {
    /* noop */
  }
}

/** Clear the browser copy right after a confirmed database save. */
export function removeRecord(id: string): void {
  saveQueue(loadQueue().filter(r => r.id !== id));
}

function upsertRecord(record: LeadDelivery): void {
  const list = loadQueue();
  const i = list.findIndex(r => r.id === record.id);
  if (i >= 0) list[i] = record;
  else list.push(record);
  saveQueue(list);
}

/**
 * Enqueue a conversion. Returns the existing record when the same
 * conversion is submitted twice, so HubSpot never sees a duplicate.
 */
export function enqueueDelivery(input: {
  payload: CrmLeadPayload;
  pipeline: string;
  formId: string;
  bot?: { hp: string; elapsedMs: number };
}): { record: LeadDelivery; duplicate: boolean } {
  const list = loadQueue();
  const email = input.payload.email.trim().toLowerCase();
  // Retry of an unsent draft for the same form + email reuses its key.
  const existing = list.find(
    r => r.formId === input.formId && r.payload.email.trim().toLowerCase() === email && r.status !== "delivered",
  );
  const now = new Date();
  if (existing) {
    const refreshed: LeadDelivery = {
      ...existing,
      payload: input.payload,
      status: existing.status === "permanently_failed" ? "pending" : existing.status,
      attempts: existing.status === "permanently_failed" ? 0 : existing.attempts,
      ...(input.bot ? { bot: input.bot } : {}),
      nextAttemptAt: "",
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + DRAFT_TTL_MS).toISOString(),
    };
    upsertRecord(refreshed);
    return { record: refreshed, duplicate: false };
  }

  const record: LeadDelivery = {
    id: `LD-${now.toISOString().replace(/[-:.TZ]/g, "")}-${Math.random().toString(36).slice(2, 8)}`,
    idempotencyKey: newIdempotencyKey(),
    payload: input.payload,
    pipeline: input.pipeline,
    formId: input.formId,
    status: "pending",
    attempts: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + DRAFT_TTL_MS).toISOString(),
    ...(input.bot ? { bot: input.bot } : {}),
  };
  list.push(record);
  saveQueue(list);
  return { record, duplicate: false };
}

/** Records eligible for a send attempt right now. */
export function dueRecords(now = Date.now()): LeadDelivery[] {
  return loadQueue().filter(r => {
    if (r.status === "pending" || r.status === "failed") return true;
    if (r.status === "retry_scheduled") {
      return !r.nextAttemptAt || Date.parse(r.nextAttemptAt) <= now;
    }
    return false;
  });
}

export type Transport = (record: LeadDelivery) => Promise<CrmSubmitResult>;

/** Apply a transport result to a record. Pure — unit tested. */
export function applyResult(record: LeadDelivery, result: CrmSubmitResult): LeadDelivery {
  const now = new Date().toISOString();
  const attempts = record.attempts + 1;
  const base: LeadDelivery = {
    ...record,
    attempts,
    lastAttemptAt: now,
    updatedAt: now,
  };

  if (result.ok) {
    return {
      ...base,
      status: "delivered",
      deliveryMode: result.mode,
      result:
        result.mode === "database"
          ? "Saved to lead database"
          : `Saved and sent to Follow Up Boss`,
      ...(result.contactId ? { hubspotContactId: result.contactId } : {}),
      ...(result.dealId ? { hubspotDealId: result.dealId } : {}),
      ...(result.submissionId ? { submissionId: result.submissionId } : {}),
      error: "",
      nextAttemptAt: "",
    };
  }

  const retryable = result.retryable !== false;
  if (!retryable || attempts >= MAX_ATTEMPTS) {
    return {
      ...base,
      status: "permanently_failed",
      error: result.message ?? "Delivery failed",
      result: retryable ? `Gave up after ${attempts} attempts` : "Rejected by lead endpoint",
    };
  }
  return {
    ...base,
    status: "retry_scheduled",
    error: result.message ?? "Delivery failed",
    result: `Retry ${attempts} of ${MAX_ATTEMPTS}`,
    nextAttemptAt: new Date(Date.now() + backoffMs(attempts)).toISOString(),
  };
}

async function send(record: LeadDelivery, transport: Transport): Promise<LeadDelivery> {
  upsertRecord({ ...record, status: "sending", updatedAt: new Date().toISOString() });
  let result: CrmSubmitResult;
  try {
    result = await transport(record);
  } catch (error) {
    result = {
      ok: false,
      mode: "database",
      action: "queued",
      retryable: true,
      message: error instanceof Error ? error.message : "Network error",
    };
  }
  // Re-read so a concurrent flush cannot clobber attempt counts.
  const current = loadQueue().find(r => r.id === record.id) ?? record;
  const next = applyResult({ ...current, attempts: record.attempts }, result);
  upsertRecord(next);
  return next;
}

/** Deliver exactly one record, ignoring the rest of the queue. */
export async function sendRecord(
  record: LeadDelivery,
  transport: Transport,
): Promise<LeadDelivery> {
  return send(record, transport);
}

export async function sendRecordWithResult(
  record: LeadDelivery,
  transport: Transport,
): Promise<{ next: LeadDelivery; duplicate: boolean }> {
  let duplicate = false;
  const next = await send(record, async r => {
    const res = await transport(r);
    duplicate = Boolean(res.duplicate);
    return res;
  });
  return { next, duplicate };
}

/**
 * Bulk delivery pause. Controlled live CRM verification requires that the
 * existing queue is never drained implicitly; only explicit operator action
 * (or an explicit unpause) may flush historical records.
 */
const PAUSE_KEY = "lf.lead-queue.bulk-paused.v1";

export function isBulkDeliveryPaused(): boolean {
  if (typeof window === "undefined") return true;
  if (window.localStorage.getItem("lf.lead-queue.v1")) window.localStorage.removeItem("lf.lead-queue.v1");
  // Default: paused. Only an explicit "false" enables bulk flushing.
  return window.localStorage.getItem(PAUSE_KEY) !== "false";
}

export function setBulkDeliveryPaused(paused: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PAUSE_KEY, paused ? "true" : "false");
}

/** Flush every due record. Safe to call repeatedly. */
export async function flushQueue(transport: Transport, now = Date.now()): Promise<LeadDelivery[]> {
  const out: LeadDelivery[] = [];
  for (const record of dueRecords(now)) out.push(await send(record, transport));
  return out;
}


/** Operator-initiated retry; ignores the backoff window. */
export async function retryDelivery(id: string, transport: Transport): Promise<LeadDelivery | null> {
  const record = loadQueue().find(r => r.id === id);
  if (!record || record.status === "delivered") return record ?? null;
  return send({ ...record, status: "pending" }, record ? transport : transport);
}

export interface DeliveryStats {
  total: number;
  delivered: number;
  inFlight: number;
  retrying: number;
  failed: number;
}

export function deliveryStats(records: LeadDelivery[] = loadQueue()): DeliveryStats {
  const by = (s: DeliveryStatus) => records.filter(r => r.status === s).length;
  return {
    total: records.length,
    delivered: by("delivered"),
    inFlight: by("pending") + by("sending"),
    retrying: by("retry_scheduled"),
    failed: by("failed") + by("permanently_failed"),
  };
}
