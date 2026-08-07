// Task 24 — Analytics consent banner. Nothing reaches a marketing vendor
// until the visitor decides; the app still functions either way.

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { consentUndecided, setConsent } from "@/lib/marketing/consent";

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(consentUndecided());
  }, []);

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Analytics consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 p-4 backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:items-center">
        <p className="text-sm text-muted-foreground">
          We use privacy-respecting analytics to see which guides help. Assessment answers stay on
          your device and are never sent to advertising tools.{" "}
          <Link to="/privacy" className="underline">
            Privacy policy
          </Link>
          .
        </p>
        <div className="flex gap-2 md:ml-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setConsent({ analytics: "denied", marketing: "denied" });
              setVisible(false);
            }}
          >
            Decline
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setConsent({ analytics: "granted", marketing: "granted" });
              setVisible(false);
            }}
          >
            Allow analytics
          </Button>
        </div>
      </div>
    </div>
  );
}
