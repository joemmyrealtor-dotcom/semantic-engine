import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/public-shell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AnswerFirst } from "@/components/answer-first";
import { ANSWERS, answerClusters } from "@/lib/marketing/answers";
import { publicMeta, canonicalLink } from "@/lib/marketing/seo";
import { jsonLdScript, siteGraph, breadcrumbGraph } from "@/lib/marketing/schema";
import { absoluteUrl } from "@/lib/marketing/site";

const TITLE = "Seller & Buyer Questions, Answered | Legacy Forge";
const DESC =
  "Sixty of the questions Orange County sellers and buyers actually ask — each answered directly, with the mechanism, the range, and the move to make.";

export const Route = createFileRoute("/answers/")({
  head: () => ({
    meta: publicMeta({ path: "/answers", title: TITLE, description: DESC }),
    links: [canonicalLink("/answers")],
    scripts: [
      jsonLdScript(siteGraph()),
      jsonLdScript(
        breadcrumbGraph([
          { name: "Home", path: "/home" },
          { name: "Answers", path: "/answers" },
        ]),
      ),
      jsonLdScript({
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: ANSWERS.map((a, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: a.question,
          url: absoluteUrl(`/answers/${a.slug}`),
        })),
      }),
    ],
  }),
  component: AnswersIndex,
});

function AnswersIndex() {
  const clusters = answerClusters();
  return (
    <PublicShell>
      <Breadcrumbs
        crumbs={[
          { name: "Home", path: "/home" },
          { name: "Answers", path: "/answers" },
        ]}
      />
      <header className="mx-auto max-w-3xl px-4 pt-8 pb-6 md:px-6 md:pt-12">
        <div className="text-[10px] uppercase tracking-[0.22em] text-gold">Answers</div>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-heritage md:text-5xl">
          The questions sellers and buyers actually ask
        </h1>
      </header>

      <AnswerFirst
        question="How should I use this library?"
        answer={`Every entry answers one question directly in the first paragraph, then explains what drives the answer and what would change it. There are ${ANSWERS.length} of them, grouped by the decision they belong to. Start with the question keeping you up tonight, then follow the guide link at the bottom for the full sequence.`}
      />

      <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
        {clusters.map(c => (
          <section key={`${c.audience}-${c.cluster}`} className="mb-8">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold">
              {c.audience === "seller" ? "Sellers" : "Buyers"}
            </div>
            <h2 className="mt-1 font-serif text-xl text-heritage">{c.cluster}</h2>
            <ul className="mt-3 space-y-2">
              {c.answers.map(a => (
                <li key={a.slug}>
                  <Link
                    to="/answers/$slug"
                    params={{ slug: a.slug }}
                    className="text-heritage underline-offset-4 hover:underline"
                  >
                    {a.question}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PublicShell>
  );
}
