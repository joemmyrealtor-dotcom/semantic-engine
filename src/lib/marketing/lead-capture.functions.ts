// Task 25 — HubSpot transport (server side).
//
// One endpoint for every public lead flow. Behavior:
//   - upsert contacts by email (never creates duplicates)
//   - first-touch attribution is written once and never overwritten
//   - latest-touch attribution is refreshed on every conversion
//   - deals are only opened for qualified intent (see shouldCreateDeal)
//   - failures are classified retryable vs permanent for the client queue
//
// With no HubSpot connection linked the call succeeds in "test" mode so the
// public forms keep working and the local queue retains everything.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { FIRST_TOUCH_PROPERTIES, shouldCreateDeal } from "./crm-schema";

const payloadSchema = z.object({
  properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  pipeline: z.string().max(60),
  formId: z.string().max(120),
  idempotencyKey: z.string().max(200),
});

export type CrmSubmitAction = "created" | "updated" | "queued";

export interface CrmSubmitResult {
  ok: boolean;
  mode: "hubspot" | "test";
  action: CrmSubmitAction;
  contactId?: string;
  dealId?: string;
  retryable?: boolean;
  status?: number;
  message?: string;
}

const GATEWAY_URL = "https://connector-gateway.lovable.dev/hubspot";

function retryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export const submitCrmLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => payloadSchema.parse(input))
  .handler(async ({ data }): Promise<CrmSubmitResult> => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const hubspotKey = process.env["HUBSPOT_API_KEY"];

    if (!lovableKey || !hubspotKey) {
      return {
        ok: true,
        mode: "test",
        action: "queued",
        message: "HubSpot is not connected yet; the lead was validated and retained locally.",
      };
    }

    const headers = {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": hubspotKey,
      "Content-Type": "application/json",
    };
    const email = String(data.properties["email"] ?? "").trim().toLowerCase();
    if (!email) {
      return { ok: false, mode: "hubspot", action: "queued", retryable: false, message: "Missing email" };
    }

    const fail = (status: number, body: string): CrmSubmitResult => {
      console.error(`HubSpot request failed [${status}]: ${body}`);
      return {
        ok: false,
        mode: "hubspot",
        action: "queued",
        status,
        retryable: retryableStatus(status),
        message: `HubSpot request failed [${status}]: ${body.slice(0, 400)}`,
      };
    };

    // 1. Look the contact up by email so we upsert instead of duplicating.
    const search = await fetch(`${GATEWAY_URL}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
        properties: ["email", "lf_delivery_key", ...FIRST_TOUCH_PROPERTIES],
        limit: 1,
      }),
    });
    if (!search.ok) return fail(search.status, await search.text());

    const found = (await search.json()) as {
      results?: { id: string; properties?: Record<string, string | null> }[];
    };
    const existing = found.results?.[0];

    // Same conversion already delivered — do not write again.
    if (existing?.properties?.["lf_delivery_key"] === data.idempotencyKey) {
      return {
        ok: true,
        mode: "hubspot",
        action: "updated",
        contactId: existing.id,
        message: "Already delivered (idempotent no-op).",
      };
    }

    // 2. Preserve first-touch attribution on existing contacts.
    const properties: Record<string, string | number | boolean> = {
      ...data.properties,
      email,
      lf_delivery_key: data.idempotencyKey,
    };
    if (existing) {
      for (const key of FIRST_TOUCH_PROPERTIES) {
        const stored = existing.properties?.[key];
        if (stored) delete properties[key];
      }
    }

    const res = await fetch(
      existing
        ? `${GATEWAY_URL}/crm/v3/objects/contacts/${existing.id}`
        : `${GATEWAY_URL}/crm/v3/objects/contacts`,
      {
        method: existing ? "PATCH" : "POST",
        headers,
        body: JSON.stringify({ properties }),
      },
    );
    if (!res.ok) return fail(res.status, await res.text());

    const contact = (await res.json()) as { id?: string };
    const contactId = contact.id ?? existing?.id;

    // 3. Promote to a deal only when intent justifies it.
    let dealId: string | undefined;
    const promote = shouldCreateDeal({
      classification: String(data.properties["lf_lead_classification"] ?? ""),
      consultationRequested: data.properties["lf_consultation_requested"] === true,
      timeline: String(data.properties["lf_timeline"] ?? ""),
    });
    if (promote && contactId) {
      const deal = await fetch(`${GATEWAY_URL}/crm/v3/objects/deals`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          properties: {
            dealname: `${data.properties["firstname"] ?? "Lead"} — ${data.pipeline}`,
            pipeline: data.pipeline,
            lf_lead_classification: data.properties["lf_lead_classification"] ?? "",
            lf_situation: data.properties["lf_situation"] ?? "",
            lf_timeline: data.properties["lf_timeline"] ?? "",
          },
          associations: [
            {
              to: { id: contactId },
              types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }],
            },
          ],
        }),
      });
      if (deal.ok) {
        dealId = ((await deal.json()) as { id?: string }).id;
      } else {
        // A contact was still created/updated; deal failure must not lose the lead.
        console.error(`HubSpot deal creation failed [${deal.status}]: ${await deal.text()}`);
      }
    }

    return {
      ok: true,
      mode: "hubspot",
      action: existing ? "updated" : "created",
      ...(contactId ? { contactId } : {}),
      ...(dealId ? { dealId } : {}),
    };
  });
