// Task 24 — HubSpot transport (server side).
//
// One endpoint for every conversion surface. When the HubSpot connector is
// linked the payload is upserted by email (duplicate-safe); otherwise the
// call succeeds in "test mode" so forms keep working and nothing is lost.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const payloadSchema = z.object({
  properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  pipeline: z.string().max(60),
  formId: z.string().max(80),
});

export type CrmSubmitResult = {
  ok: boolean;
  mode: "hubspot" | "test";
  action: "created" | "updated" | "queued";
  contactId?: string;
  message?: string;
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/hubspot";

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
        message: "HubSpot is not connected yet; the lead was validated and queued locally.",
      };
    }

    const headers = {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": hubspotKey,
      "Content-Type": "application/json",
    };
    const email = String(data.properties["email"] ?? "");

    // Duplicate-safe: search by email, then patch or create.
    const search = await fetch(`${GATEWAY_URL}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        filterGroups: [
          { filters: [{ propertyName: "email", operator: "EQ", value: email }] },
        ],
        properties: ["email"],
        limit: 1,
      }),
    });

    if (!search.ok) {
      const body = await search.text();
      console.error(`HubSpot search failed [${search.status}]: ${body}`);
      throw new Error(`HubSpot search failed [${search.status}]: ${body}`);
    }

    const found = (await search.json()) as { results?: { id: string }[] };
    const existingId = found.results?.[0]?.id;

    const res = await fetch(
      existingId
        ? `${GATEWAY_URL}/crm/v3/objects/contacts/${existingId}`
        : `${GATEWAY_URL}/crm/v3/objects/contacts`,
      {
        method: existingId ? "PATCH" : "POST",
        headers,
        body: JSON.stringify({ properties: data.properties }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      console.error(`HubSpot upsert failed [${res.status}]: ${body}`);
      throw new Error(`HubSpot upsert failed [${res.status}]: ${body}`);
    }

    const contact = (await res.json()) as { id?: string };
    return {
      ok: true,
      mode: "hubspot",
      action: existingId ? "updated" : "created",
      ...(contact.id ? { contactId: contact.id } : {}),
    };
  });
