import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/attorneys")({
  beforeLoad: () => {
    throw redirect({ to: "/attorney-partners", replace: true });
  },
});
