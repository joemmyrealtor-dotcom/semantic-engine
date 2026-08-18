// Mobile conversion bar — high-intent public pages only.
//
// Presentation only. The paths it appears on and the destinations it offers
// come from src/lib/marketing/conversion-paths.ts, so it can never point at
// an ungoverned route. Restrained by design: two calm actions, no urgency,
// no countdown, no interstitial, and it never covers the consent banner.

import { Link } from "@tanstack/react-router";
import { ClipboardCheck, MessageSquare } from "lucide-react";
import { mobileBarActions, showsMobileConversionBar } from "@/lib/marketing/conversion-paths";
import { trackAction } from "@/lib/marketing/analytics";

export function MobileConversionBar({ pathname }: { pathname: string }) {
  if (!showsMobileConversionBar(pathname)) return null;
  const [evaluate, talk] = mobileBarActions(pathname);
  if (!evaluate || !talk) return null;

  return (
    <nav
      aria-label="Next steps"
      data-testid="mobile-conversion-bar"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2">
        <Link
          to={evaluate.to}
          onClick={() => trackAction("assessment_started", { label: `mobile-bar|${pathname}` })}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-heritage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ClipboardCheck className="size-4" aria-hidden="true" />
          {evaluate.label}
        </Link>
        <Link
          to={talk.to}
          onClick={() => trackAction("consultation_clicked", { label: `mobile-bar|${pathname}` })}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MessageSquare className="size-4" aria-hidden="true" />
          {talk.label}
        </Link>
      </div>
    </nav>
  );
}
