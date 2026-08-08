import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, useRouterState, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppShell } from "@/components/app-shell";
import { isPublicPath } from "@/lib/marketing/content";
import { INTERNAL_ROBOTS } from "@/lib/marketing/seo";
import { BRAND } from "@/lib/marketing/positioning";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="text-[11px] tracking-[0.22em] uppercase text-gold">Legacy Platform</div>
        <h1 className="mt-3 font-serif text-6xl text-heritage">404</h1>
        <h2 className="mt-3 text-lg text-heritage">Page not found</h2>
        <p className="mt-2 text-sm text-slate-ink">This route is not part of the current repository.</p>
        <Link to="/" className="inline-flex mt-6 items-center justify-center rounded-md bg-heritage text-heritage-foreground px-4 py-2 text-sm hover:opacity-90">Return to dashboard</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-2xl text-heritage">Something interrupted this view</h1>
        <p className="mt-2 text-sm text-slate-ink">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-heritage text-heritage-foreground px-4 py-2 text-sm">Try again</button>
          <a href="/" className="rounded-md border border-input bg-background px-4 py-2 text-sm">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    // SEO/AEO indexation boundary: the governed console and every internal
    // operator surface default to noindex. Public marketing routes override
    // `robots` with an explicit index directive (meta merges by name).
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Legacy Platform v2.0 — JM Advisory Press" },
      { name: "description", content: "The Legacy Project Digital Knowledge Platform: canonical concepts, frameworks, publications, and governed releases." },
      { name: "author", content: "JM Advisory Press" },
      { name: "robots", content: INTERNAL_ROBOTS },
      { property: "og:site_name", content: BRAND.name },
      { property: "og:title", content: "Legacy Platform v2.0" },
      { property: "og:description", content: "Canonical knowledge, governed publishing, and release management for JM Advisory Press." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const isPublic = isPublicPath(pathname);
  return (
    <QueryClientProvider client={queryClient}>
      {isPublic ? (
        <Outlet />
      ) : (
        <AppShell>
          <Outlet />
        </AppShell>
      )}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
