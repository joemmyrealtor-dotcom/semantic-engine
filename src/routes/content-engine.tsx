import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { buildContentPlan, PLAN_WEEKS } from "@/lib/marketing/content-calendar";
import { ANSWERS } from "@/lib/marketing/answers";
import { assetsFor, CHANNEL_LABEL, CHANNELS } from "@/lib/marketing/distribution";

export const Route = createFileRoute("/content-engine")({
  head: () => ({
    meta: [
      { title: "Content Authority Engine | Legacy Forge" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ContentEngineRoute,
});

function ContentEngineRoute() {
  const plan = useMemo(() => buildContentPlan(), []);
  const [week, setWeek] = useState(1);
  const [answerSlug, setAnswerSlug] = useState(ANSWERS[0]?.slug ?? "");
  const answer = ANSWERS.find(a => a.slug === answerSlug);
  const assets = answer ? assetsFor(answer) : [];
  const weekSlots = plan.slots.filter(s => s.week === week);

  return (
    <AppShell>
      <PageHeader
        title="Content Authority Engine"
        description={`90-day publishing plan, ${plan.startDate} to ${plan.endDate}. Every item is a draft for human review — nothing publishes or posts from here.`}
      />

      <div className="grid gap-4 p-4 md:grid-cols-4 md:p-6">
        {[
          { label: "Answers in bank", value: plan.coverage.totalAnswers },
          { label: "Scheduled slots", value: plan.slots.length },
          { label: "Draft assets", value: plan.assets.length },
          { label: "Cities covered", value: plan.coverage.citiesScheduled },
        ].map(k => (
          <div key={k.label} className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</div>
            <div className="mt-1 font-serif text-2xl text-heritage">{k.value}</div>
          </div>
        ))}
      </div>

      <section className="px-4 pb-6 md:px-6">
        <h2 className="font-serif text-xl text-heritage">Calendar</h2>
        <div className="mt-3 flex flex-wrap gap-1">
          {Array.from({ length: PLAN_WEEKS }, (_, i) => i + 1).map(w => (
            <Button
              key={w}
              size="sm"
              variant={w === week ? "default" : "outline"}
              onClick={() => setWeek(w)}
            >
              W{w}
            </Button>
          ))}
        </div>
        <ul className="mt-4 space-y-2">
          {weekSlots.map(s => (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm"
            >
              <span className="font-mono text-xs text-muted-foreground">{s.date}</span>
              <span className="rounded bg-muted px-2 py-0.5 text-xs">{s.channelLabel}</span>
              <span className="flex-1 text-heritage">{s.title}</span>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {s.status}
              </span>
              <Link to={s.path} className="text-xs underline underline-offset-4">
                View page
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="px-4 pb-10 md:px-6">
        <h2 className="font-serif text-xl text-heritage">Channel drafts</h2>
        <select
          aria-label="Choose an answer"
          className="mt-3 w-full max-w-xl rounded-md border border-border bg-background p-2 text-sm"
          value={answerSlug}
          onChange={e => setAnswerSlug(e.target.value)}
        >
          {ANSWERS.map(a => (
            <option key={a.slug} value={a.slug}>
              {a.audience === "seller" ? "Seller" : "Buyer"} — {a.question}
            </option>
          ))}
        </select>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {assets.map(asset => (
            <article key={asset.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-heritage">{CHANNEL_LABEL[asset.channel]}</h3>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {asset.status}
                </span>
              </div>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-muted-foreground">
                {asset.body}
              </pre>
            </article>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Channels: {CHANNELS.map(c => CHANNEL_LABEL[c]).join(" · ")}
        </p>
      </section>
    </AppShell>
  );
}
