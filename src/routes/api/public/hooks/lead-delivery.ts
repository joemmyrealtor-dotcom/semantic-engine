// Scheduled retry job (every 5 minutes). Only sends leads already saved in
// the database to the owner's Follow Up Boss account; idempotent because
// each record is locked before sending and delivered records are skipped.
import { createFileRoute } from "@tanstack/react-router";
import { DELIVERY_BATCH, DELIVERY_LOCK_SECONDS } from "@/lib/marketing/lead-delivery-policy";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/public/hooks/lead-delivery")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace("Bearer ", "");
        if (!token) return json({ error: "Unauthorized" }, 401);

        const { fubConfigured, deliverLocked } = await import("@/lib/marketing/lead-delivery.server");
        // Without a key, leave records pending so no retries are used up.
        if (!fubConfigured()) return json({ ok: true, skipped: "not_configured" });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: rows, error } = await supabaseAdmin.rpc("claim_due_lead_deliveries", {
          p_limit: DELIVERY_BATCH,
          p_lock_seconds: DELIVERY_LOCK_SECONDS,
        });
        if (error) {
          console.error("claim_due_lead_deliveries failed:", error.message);
          return json({ ok: false }, 500);
        }
        const results: Record<string, number> = { delivered: 0, retrying: 0, dead_letter: 0 };
        for (const row of rows ?? []) {
          const outcome = await deliverLocked(supabaseAdmin, row);
          results[outcome] = (results[outcome] ?? 0) + 1;
        }
        return json({ ok: true, processed: rows?.length ?? 0, ...results });
      },
    },
  },
});
