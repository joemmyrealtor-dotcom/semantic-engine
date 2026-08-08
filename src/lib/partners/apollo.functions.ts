// Task 26 — Apollo research (server side).
//
// Research and qualification only: people search and enrichment. Nothing here
// sends a message. With no Apollo connection linked the call reports
// `configured: false` so the cohort UI stays usable on fixture data.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ApolloPerson } from "./apollo";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/apollo";

const searchSchema = z.object({
  titles: z.array(z.string().trim().max(120)).max(20).default([]),
  cities: z.array(z.string().trim().max(80)).max(40).default([]),
  page: z.number().int().min(1).max(20).default(1),
  perPage: z.number().int().min(1).max(50).default(25),
});

export interface ApolloSearchResult {
  configured: boolean;
  ok: boolean;
  people: ApolloPerson[];
  total: number;
  message?: string;
  status?: number;
}

export const searchApolloPartners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => searchSchema.parse(input))
  .handler(async ({ data }): Promise<ApolloSearchResult> => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const apolloKey = process.env["APOLLO_API_KEY"];
    if (!lovableKey || !apolloKey) {
      return {
        configured: false,
        ok: true,
        people: [],
        total: 0,
        message:
          "Apollo is not connected yet. Cohort research runs on the local fixture until a connection is linked.",
      };
    }

    const url = new URL(`${GATEWAY_URL}/api/v1/mixed_people/search`);
    const params = new URLSearchParams();
    for (const t of data.titles) params.append("person_titles[]", t);
    for (const c of data.cities) params.append("person_locations[]", `${c}, California`);
    params.set("page", String(data.page));
    params.set("per_page", String(data.perPage));
    url.search = params.toString();

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": apolloKey,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Apollo request failed [${res.status}]: ${body}`);
      return {
        configured: true,
        ok: false,
        people: [],
        total: 0,
        status: res.status,
        message: `Apollo request failed [${res.status}]: ${body.slice(0, 400)}`,
      };
    }

    const json = (await res.json()) as {
      people?: ApolloPerson[];
      contacts?: ApolloPerson[];
      pagination?: { total_entries?: number };
    };
    const people = [...(json.people ?? []), ...(json.contacts ?? [])];
    return {
      configured: true,
      ok: true,
      people,
      total: json.pagination?.total_entries ?? people.length,
    };
  });
