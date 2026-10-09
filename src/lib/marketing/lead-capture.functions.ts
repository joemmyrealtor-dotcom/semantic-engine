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

export { MIN_FILL_MS, assessBot } from "./lead-delivery-policy";
export const RATE_LIMIT = { windowSeconds: 600, max: 5 };

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

const fail = (message: string, retryable: boolean, status?: number): CrmSubmitResult => ({
  ok: false, mode: "database", action: "queued", retryable, message, ...(status ? { status } : {}),
});

export const submitCrmLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => payloadSchema.parse(input))
  .handler(async ({ data }): Promise<CrmSubmitResult> => {
    const { assessBot } = await import("./lead-delivery-policy");
    if (!data.bot || data.bot.hp.trim() !== "") return fail("Submission rejected", false, 400);

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

    // Speed is a risk signal; reject only when paired with repeat requests.
    const bot = assessBot(data.bot, rl?.[0]?.current_count ?? 1);
    if (bot.reject) return fail("Submission rejected", false, 400);

    // Insert; a repeat of the same client key returns the existing row.
    let duplicate = false;
    type Row = { id: string; delivery_status: string; form_id: string; idempotency_key: string; payload: unknown; crm_attempts: number };
    let row: Row | null = null;
    const cols = "id, delivery_status, form_id, idempotency_key, payload, crm_attempts";
    const ins = await supabaseAdmin
      .from("lead_submissions")
      .insert({
        idempotency_key: data.idempotencyKey, form_id: data.formId, pipeline: data.pipeline, email,
        payload: data.properties, bot_risk: bot.risk === "none" ? null : bot.risk,
      })
      .select(cols)
      .single();
    if (ins.error?.code === "23505") {
      duplicate = true;
      const ex = await supabaseAdmin.from("lead_submissions").select(cols).eq("idempotency_key", data.idempotencyKey).single();
      row = ex.data;
    } else if (ins.error) {
      console.error("lead_submissions insert failed:", ins.error.message);
      return fail("Lead could not be saved", true, 500);
    } else {
      row = ins.data;
    }
    if (!row) return fail("Lead could not be saved", true, 500);

    // First delivery attempt now; failures are picked up by the retry job.
    const { fubConfigured, lockOne, deliverLocked } = await import("./lead-delivery.server");
    let mode: CrmSubmitResult["mode"] = row.delivery_status === "delivered" ? "fub" : "database";
    if (mode === "database" && fubConfigured() && (await lockOne(supabaseAdmin, row.id))) {
      const outcome = await deliverLocked(supabaseAdmin, row);
      if (outcome === "delivered") mode = "fub";
    }

    return {
      ok: true,
      mode,
      action: duplicate ? "updated" : "created",
      submissionId: row.id,
      duplicate,
    };
  });
