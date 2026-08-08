import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, MarketingPage } from "@/components/public-shell";
import { PUBLIC_PAGES } from "@/lib/marketing/content";
import { publicHead } from "@/lib/marketing/head";

export const Route = createFileRoute("/editorial-policy")({
  head: () => publicHead("editorial-policy"),
  component: EditorialPolicyRoute,
});

function EditorialPolicyRoute() {
  return (
    <PublicShell>
      <MarketingPage page={PUBLIC_PAGES["editorial-policy"]} pageKey="editorial-policy" />
    </PublicShell>
  );
}
