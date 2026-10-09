// Server-only Follow Up Boss delivery shared by the form endpoint and the
// scheduled retry job. Each send happens only while the record is locked.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { afterFailure, DELIVERY_LOCK_SECONDS } from "./lead-delivery-policy";

type Admin = SupabaseClient<Database>;
type Props = Record<string, string | number | boolean>;

const FUB_URL = "https://api.followupboss.com/v1/events";

export function fubConfigured(): boolean {
  return Boolean(process.env["FOLLOW_UP_BOSS_API_KEY"]);
}

export async function forwardToFollowUpBoss(
  p: Props,
  formId: string,
  idempotencyKey: string,
): Promise<{ ok: boolean; personId?: string; error?: string }> {
  const key = process.env["FOLLOW_UP_BOSS_API_KEY"];
  if (!key) return { ok: false, error: "Follow Up Boss not connected" };
  const body = {
    source: "Legacy Forge website",
    system: "LegacyForge",
    type: formId.startsWith("sellers") ? "Seller Inquiry" : "General Inquiry",
    message: [p["lf_motivation"], p["lf_property_address"] && `Property: ${p["lf_property_address"]}`]
      .filter(Boolean)
      .join("\n"),
    description: `Ref ${idempotencyKey}`,
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
  try {
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
      console.error(`Follow Up Boss request failed [${res.status}]`);
      return { ok: false, error: `[${res.status}] ${text.slice(0, 300)}` };
    }
    let personId: string | undefined;
    try {
      personId = String((JSON.parse(text) as { id?: number }).id ?? "") || undefined;
    } catch {
      /* empty body is fine */
    }
    return { ok: true, ...(personId ? { personId } : {}) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "CRM error" };
  }
}

/** Lock one record by id; returns false if delivered or another run holds it. */
export async function lockOne(admin: Admin, id: string): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const until = new Date(Date.now() + DELIVERY_LOCK_SECONDS * 1000).toISOString();
  const { data } = await admin
    .from("lead_submissions")
    .update({ locked_until: until })
    .eq("id", id)
    .in("delivery_status", ["pending", "retrying"])
    .or(`locked_until.is.null,locked_until.lt.${nowIso}`)
    .select("id");
  return (data?.length ?? 0) > 0;
}

/** Send a locked record and store the outcome. */
export async function deliverLocked(
  admin: Admin,
  row: { id: string; form_id: string; idempotency_key: string; payload: unknown; crm_attempts: number },
): Promise<"delivered" | "retrying" | "dead_letter"> {
  const res = await forwardToFollowUpBoss(row.payload as Props, row.form_id, row.idempotency_key);
  if (res.ok) {
    await admin
      .from("lead_submissions")
      .update({
        delivery_status: "delivered",
        crm_status: "fub_sent",
        delivered_at: new Date().toISOString(),
        crm_attempts: row.crm_attempts + 1,
        crm_last_error: null,
        locked_until: null,
        ...(res.personId ? { fub_person_id: res.personId } : {}),
      })
      .eq("id", row.id);
    return "delivered";
  }
  const attempts = row.crm_attempts + 1;
  const next = afterFailure(attempts, Date.now());
  if (next.status === "dead_letter") {
    await admin
      .from("lead_submissions")
      .update({
        delivery_status: "dead_letter",
        crm_status: "fub_failed",
        dead_lettered_at: new Date().toISOString(),
        crm_attempts: attempts,
        crm_last_error: res.error ?? null,
        locked_until: null,
      })
      .eq("id", row.id);
    await admin.from("lead_delivery_alerts").upsert(
      {
        submission_id: row.id,
        kind: "dead_letter",
        message: `Lead could not reach Follow Up Boss after ${attempts} attempts. Last error: ${res.error ?? "unknown"}`,
      },
      { onConflict: "submission_id,kind", ignoreDuplicates: true },
    );
    return "dead_letter";
  }
  await admin
    .from("lead_submissions")
    .update({
      delivery_status: "retrying",
      crm_status: "fub_failed",
      next_attempt_at: new Date(next.nextAttemptAt).toISOString(),
      crm_attempts: attempts,
      crm_last_error: res.error ?? null,
      locked_until: null,
    })
    .eq("id", row.id);
  return "retrying";
}
