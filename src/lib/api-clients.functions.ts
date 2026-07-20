// Server-authoritative api_clients registry.
//
// Governed by RLS: members read, only owners (workspace role = 'owner')
// may create/update/disable. Rows never contain bearer values — only a
// key_reference_name pointing at a runtime secret managed out-of-band.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ListInput = z.object({ workspaceId: z.string().min(1) });

const UpsertInput = z.object({
  workspaceId: z.string().min(1),
  slug: z.string().min(3).max(64).regex(/^[A-Za-z0-9_.-]+$/),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  environment: z.enum(["production", "staging", "local-demo"]),
  owner: z.string().max(120).default(""),
  scopes: z.array(z.string().min(1)).default([]),
  keyReferenceName: z.string().min(1).max(256).nullable(),
  keyPrefix: z.string().max(64).default(""),
  rateLimitPerMinute: z.number().int().min(0).max(100000).default(60),
  enabled: z.boolean(),
  isDemo: z.boolean().default(false),
});

const SetEnabledInput = z.object({
  workspaceId: z.string().min(1),
  slug: z.string().min(1),
  enabled: z.boolean(),
});

async function requireOwner(context: {
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
  };
  userId: string;
}, workspaceId: string) {
  const { data: isMember } = await context.supabase.rpc("is_workspace_member", {
    _user_id: context.userId, _workspace_id: workspaceId,
  });
  if (!isMember) throw new Error("Forbidden: not a member of the target workspace");
  const { data: role } = await context.supabase.rpc("workspace_role", {
    _user_id: context.userId, _workspace_id: workspaceId,
  });
  if (role !== "owner") throw new Error(`Forbidden: role ${role ?? "none"} may not manage api_clients`);
}

export const listApiClientsServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("api_clients")
      .select("id, workspace_id, slug, name, description, environment, owner, scopes, key_reference_name, key_prefix, rate_limit_per_minute, enabled, is_demo, last_used_at, created_by, created_at, updated_at")
      .eq("workspace_id", data.workspaceId)
      .order("slug", { ascending: true });
    if (error) throw new Error(`listApiClients: ${error.message}`);
    return { rows: rows ?? [], generatedAt: new Date().toISOString() };
  });

export const upsertApiClientServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpsertInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireOwner(context, data.workspaceId);
    if (data.slug === "APIC-001" && data.enabled) {
      throw new Error("APIC-001 is the demo bearer and must remain disabled/removed for H3.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      workspace_id: data.workspaceId,
      slug: data.slug,
      name: data.name,
      description: data.description,
      environment: data.environment,
      owner: data.owner,
      scopes: data.scopes,
      key_reference_name: data.keyReferenceName,
      key_prefix: data.keyPrefix,
      rate_limit_per_minute: data.rateLimitPerMinute,
      enabled: data.enabled,
      is_demo: data.isDemo,
      created_by: context.userId,
    };
    const { data: inserted, error } = await supabaseAdmin
      .from("api_clients")
      .upsert(row, { onConflict: "workspace_id,slug" })
      .select("id, slug, enabled")
      .single();
    if (error || !inserted) throw new Error(`upsertApiClient failed: ${error?.message ?? "no row"}`);
    return { ok: true, id: inserted.id, slug: inserted.slug, enabled: inserted.enabled };
  });

export const setApiClientEnabledServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetEnabledInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireOwner(context, data.workspaceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("api_clients")
      .update({ enabled: data.enabled })
      .eq("workspace_id", data.workspaceId)
      .eq("slug", data.slug);
    if (error) throw new Error(`setApiClientEnabled failed: ${error.message}`);
    return { ok: true };
  });
