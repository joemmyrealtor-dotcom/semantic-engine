import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, MarketingPage } from "@/components/public-shell";
import { PUBLIC_PAGES } from "@/lib/marketing/content";
import { publicHead } from "@/lib/marketing/head";
import { LICENSE } from "@/lib/marketing/positioning";

export const Route = createFileRoute("/contact")({
  head: () => publicHead("contact"),
  component: PublicMarketingRoute,
});

function PublicMarketingRoute() {
  return (
    <PublicShell>
      <section
        aria-label="Direct contact"
        data-testid="contact-methods"
        className="mx-auto mt-8 max-w-3xl rounded-lg border border-border bg-card p-6"
      >
        <h2 className="font-serif text-xl text-heritage">Reach Joe directly</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Call or email with the situation and a rough timeline. Response times vary with the day
          and the volume of inquiries; no specific turnaround is promised.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          <li>
            <a className="font-medium text-heritage underline" href={LICENSE.phoneHref}>
              {LICENSE.phone}
            </a>
          </li>
          <li>
            <a className="font-medium text-heritage underline" href={LICENSE.emailHref}>
              {LICENSE.email}
            </a>
          </li>
        </ul>
      </section>
      <MarketingPage page={PUBLIC_PAGES["contact"]} />
    </PublicShell>
  );
}
