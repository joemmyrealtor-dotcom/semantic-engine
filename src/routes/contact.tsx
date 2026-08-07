import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, MarketingPage } from "@/components/public-shell";
import { PUBLIC_PAGES } from "@/lib/marketing/content";
import { publicHead } from "@/lib/marketing/head";

export const Route = createFileRoute("/contact")({
  head: () => publicHead("contact"),
  component: PublicMarketingRoute,
});

function PublicMarketingRoute() {
  return (
    <PublicShell>
      <MarketingPage page={PUBLIC_PAGES["contact"]} />
    </PublicShell>
  );
}
