import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, MarketingPage } from "@/components/public-shell";
import { PUBLIC_PAGES } from "@/lib/marketing/content";
import { publicHead } from "@/lib/marketing/head";
import { SellerConversion } from "@/components/seller-conversion";

export const Route = createFileRoute("/sellers")({
  head: () => publicHead("sellers"),
  component: PublicMarketingRoute,
});

function PublicMarketingRoute() {
  return (
    <PublicShell>
      <SellerConversion />
      <MarketingPage page={PUBLIC_PAGES["sellers"]} />
    </PublicShell>
  );
}
