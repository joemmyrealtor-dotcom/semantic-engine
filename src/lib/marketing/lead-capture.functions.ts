// Lead endpoint (server side). Owner decisions (Oct 8 2026):
//   - A lead is delivered only once it is saved in lead_submissions.
//   - The idempotency key is client-generated and unique in the database;
//     the server lead ID (row id) is separate.
//   - Anonymous callers can only create. No list/read/update/delete/export.
//   - Rate limiting, server-side field validation and bot checks run first.
//   - Follow Up Boss is the only CRM for this release (HubSpot skipped).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const payloadSchema = z.object({
  properties: z.record(z.string().max(60), z.union([z.string().max(2000), z.number(), z.boolean()])),
  pipeline: z.string().max(60),
  formId: z.string().max(120),
  idempotencyKey: z.string().min(16).max(200),
  bot: z.object({ hp: z.string().max(200), elapsedMs: z.number() }).optional(),
});

/** Server-side field validation of the lead itself. */
export const leadFieldsSchema = z.object({
  firstname: z.string().trim().min(1).max(60),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).regex(/^[0-9()+\-.\s]*$/),
  city: z.string().trim().min(1).max(80),
  lf_situation: z.string().trim().min(1).max(60),
  lf_timeline: z.string().trim().min(1).max(30),
  lf_property_address: z.string().max(160),
  lf_motivation: z.string().max(600),
  lf_consent: z.literal(true),
});

export const MIN_FILL_MS = 2500;
export const RATE_LIMIT = { windowSeconds: 600, max: 5 };

/** Bot check: honeypot must be empty and the form must not be filled instantly. */
export function looksLikeBot(bot?: { hp: string; elapsedMs: number }): boolean {
  if (!bot) return true;
  return bot.hp.trim() !== "" || bot.elapsedMs < MIN_FILL_MS;
}

export type CrmSubmitAction = "created" | "updated" | "queued";

export interface CrmSubmitResult {
  ok: boolean;
  mode: "fub" | "database";
  action: CrmSubmitAction;
  /** Server-generated lead_submissions row id (separate from the idempotency key). */
  submissionId?: string;
  /** True when this idempotency key was already saved. */
  duplicate?: boolean;
  contactId?: string;
  dealId?: string;
  retryable?: boolean;
  status?: number;
  message?: string;
}

const FUB_URL = "https://api.followupboss.com/v1/events";

async function forwardToFollowUpBoss(
  p: Record<string, string | number | boolean>,
  formId: string,
): Promise<{ ok: boolean; skipped?: boolean; personId?: string; error?: string }> {
  const key = process.env["FOLLOW_UP_BOSS_API_KEY"];
  if (!key) return { ok: false, skipped: true, error: "Follow Up Boss not connected" };
  const body = {
    source: "Legacy Forge website",
    system: "LegacyForge",
    type: formId.startsWith("sellers") ? "Seller Inquiry" : "General Inquiry",
    message: [p["lf_motivation"], p["lf_property_address"] && `Property: ${p["lf_property_address"]}`]
      .filter(Boolean)
      .join("\n"),
    person: {
      firstName: String(p["firstname"] ?? ""),
      emails: [{ value: String(p["email"] ?? "") }],
      ...(p["phone"] ? { phones: [{ value: String(p["phone"]) }] } : {}),
      tags: [formId, String(p["lf_timeline"] ?? "")].filter(Boolean),
    },
    ...(p["lf_property_address"]
      ? { property: { street: String(p["lf_property_address"]), city: String(p["city"] ?? "") } }
      : {}),
  };
  const res = await fetch(FUB_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${key}:`)}`,
      "Content-Type": "application/json",
      "X-System": "LegacyForge",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Follow Up Boss request failed [${res.status}]: ${text.slice(0, 300)}`);
    return { ok: false, error: `[${res.status}] ${text.slice(0, 300)}` };
  }
  let personId: string | undefined;
  try {
    personId = String((JSON.parse(text) as { id?: number }).id ?? "") || undefined;
  } catch {
    /* empty body (204) is fine */
  }
  return { ok: true, ...(personId ? { personId } : {}) };
}

const fail = (message: string, retryable: boolean, status?: number): CrmSubmitResult => ({
  ok: false, mode: "database", action: "queued", retryable, message, ...(status ? { status } : {}),
});

export const submitCrmLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => payloadSchema.parse(input))
  .handler(async ({ data }): Promise<CrmSubmitResult> => {
    if (looksLikeBot(data.bot)) return fail("Submission rejected", false, 400);

    const fields = leadFieldsSchema.safeParse(data.properties);
    if (!fields.success) return fail("Invalid lead fields", false, 422);
    const email = fields.data.email.toLowerCase();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const ip =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const { data: rl } = await supabaseAdmin.rpc("consume_rate_limit", {
      p_key: `lead-submit:${ip}`,
      p_window_seconds: RATE_LIMIT.windowSeconds,
      p_max: RATE_LIMIT.max,
    });
    if (rl && rl[0] && rl[0].allowed === false) return fail("Too many requests — please call instead", false, 429);

    // Insert; a repeat of the same client key returns the existing row.
    let duplicate = false;
    let row: { id: string; crm_status: string } | null = null;
    const ins = await supabaseAdmin
      .from("lead_submissions")
      .insert({ idempotency_key: data.idempotencyKey, form_id: data.formId, pipeline: data.pipeline, email, payload: data.properties })
      .select("id, crm_status")
      .single();
    if (ins.error?.code === "23505") {
      duplicate = true;
      const ex = await supabaseAdmin
        .from("lead_submissions")
        .select("id, crm_status")
        .eq("idempotency_key", data.idempotencyKey)
        .single();
      row = ex.data;
    } else if (ins.error) {
      console.error("lead_submissions insert failed:", ins.error.message);
      return fail("Lead could not be saved", true, 500);
    } else {
      row = ins.data;
    }
    if (!row) return fail("Lead could not be saved", true, 500);

    // Database-to-CRM: forward unless this row already reached Follow Up Boss.
    let mode: CrmSubmitResult["mode"] = "database";
    let contactId: string | undefined;
    if (row.crm_status !== "fub_sent") {
      let fub: Awaited<ReturnType<typeof forwardToFollowUpBoss>>;
      try {
        fub = await forwardToFollowUpBoss(data.properties, data.formId);
      } catch (e) {
        fub = { ok: false, error: e instanceof Error ? e.message : "CRM error" };
      }
      if (fub.ok) {
        mode = "fub";
        contactId = fub.personId;
      }
      const { data: cur } = await supabaseAdmin.from("lead_submissions").select("crm_attempts").eq("id", row.id).single();
      await supabaseAdmin
        .from("lead_submissions")
        .update({
          crm_status: fub.ok ? "fub_sent" : fub.skipped ? "stored" : "fub_failed",
          crm_attempts: (cur?.crm_attempts ?? 0) + (fub.skipped ? 0 : 1),
          crm_last_error: fub.ok ? null : (fub.error ?? null),
          ...(fub.personId ? { fub_person_id: fub.personId } : {}),
        })
        .eq("id", row.id);
    } else {
      mode = "fub";
    }

    return {
      ok: true,
      mode,
      action: duplicate ? "updated" : "created",
      submissionId: row.id,
      duplicate,
      ...(contactId ? { contactId } : {}),
    };
  });
