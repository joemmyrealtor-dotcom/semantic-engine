import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, MarketingPage } from "@/components/public-shell";
import { PUBLIC_PAGES } from "@/lib/marketing/content";
import { publicHead } from "@/lib/marketing/head";

export const Route = createFileRoute("/probate")({
  head: () => publicHead("probate"),
  component: PublicMarketingRoute,
});

function PublicMarketingRoute() {
  return (
    <PublicShell>
      <MarketingPage page={PUBLIC_PAGES["probate"]} />
    </PublicShell>
  );
}
