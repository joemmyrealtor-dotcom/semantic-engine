// Task 26 — Apollo → HubSpot handoff (server side).
//
// Apollo qualifies; HubSpot owns the relationship. The handoff is an upsert
// by email so a partner never exists twice, and partner records are written
// with a distinct lifecycle/source so they never mix with consumer leads.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/hubspot";

const partnerContactSchema = z.object({
  email: z.string().trim().email().max(255),
  properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  idempotencyKey: z.string().max(200),
});

export interface PartnerHandoffResult {
  ok: boolean;
  mode: "hubspot" | "test";
  action: "created" | "updated" | "skipped";
  contactId?: string;
  retryable?: boolean;
  status?: number;
  message?: string;
}

export const upsertPartnerContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => partnerContactSchema.parse(input))
  .handler(async ({ data }): Promise<PartnerHandoffResult> => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const hubspotKey = process.env["HUBSPOT_API_KEY"];
    if (!lovableKey || !hubspotKey) {
      return {
        ok: true,
        mode: "test",
        action: "skipped",
        message: "HubSpot is not connected yet; the partner record was validated and retained locally.",
      };
    }

    const headers = {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": hubspotKey,
      "Content-Type": "application/json",
    };
    const email = data.email.trim().toLowerCase();

    const fail = (status: number, body: string): PartnerHandoffResult => {
      console.error(`HubSpot partner handoff failed [${status}]: ${body}`);
      return {
        ok: false,
        mode: "hubspot",
        action: "skipped",
        status,
        retryable: status === 408 || status === 429 || status >= 500,
        message: `HubSpot partner handoff failed [${status}]: ${body.slice(0, 400)}`,
      };
    };

    const search = await fetch(`${GATEWAY_URL}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
        properties: ["email", "lf_partner_key", "lf_partner_first_seen_at"],
        limit: 1,
      }),
    });
    if (!search.ok) return fail(search.status, await search.text());

    const found = (await search.json()) as {
      results?: { id: string; properties?: Record<string, string | null> }[];
    };
    const existing = found.results?.[0];

    if (existing?.properties?.["lf_partner_key"] === data.idempotencyKey) {
      return {
        ok: true,
        mode: "hubspot",
        action: "updated",
        contactId: existing.id,
        message: "Already synced (idempotent no-op).",
      };
    }

    const properties: Record<string, string | number | boolean> = {
      ...data.properties,
      email,
      lf_partner_key: data.idempotencyKey,
    };
    // First-seen is written once and never overwritten.
    if (existing?.properties?.["lf_partner_first_seen_at"]) {
      delete properties["lf_partner_first_seen_at"];
    }

    const res = await fetch(
      existing
        ? `${GATEWAY_URL}/crm/v3/objects/contacts/${existing.id}`
        : `${GATEWAY_URL}/crm/v3/objects/contacts`,
      { method: existing ? "PATCH" : "POST", headers, body: JSON.stringify({ properties }) },
    );
    if (!res.ok) return fail(res.status, await res.text());

    const contact = (await res.json()) as { id?: string };
    return {
      ok: true,
      mode: "hubspot",
      action: existing ? "updated" : "created",
      ...(contact.id || existing?.id ? { contactId: contact.id ?? (existing?.id as string) } : {}),
    };
  });
