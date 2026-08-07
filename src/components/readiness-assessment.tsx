// Task 23 — Interactive readiness assessment UI. Presentation only.

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ASSESSMENT_QUESTIONS,
  ASSESSMENT_PATHS,
  scoreAssessment,
} from "@/lib/marketing/assessment";
import type { EntryPathId } from "@/lib/marketing/positioning";
import { magnetsFor } from "@/lib/marketing/lead-magnets";

export function ReadinessAssessment() {
  const [path, setPath] = useState<EntryPathId | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const complete = ASSESSMENT_QUESTIONS.every(q => answers[q.id]);
  const result = useMemo(() => scoreAssessment(answers, path), [answers, path]);
  const magnets = path ? magnetsFor(path) : [];
  const selectedPath = ASSESSMENT_PATHS.find(p => p.id === path);

  function reset() {
    setPath(null);
    setAnswers({});
    setSubmitted(false);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <fieldset className="rounded-lg border border-border bg-card p-6">
        <legend className="px-2 font-serif text-lg text-heritage">Where are you starting?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {ASSESSMENT_PATHS.map(p => (
            <button
              key={p.id}
              type="button"
              aria-pressed={path === p.id}
              onClick={() => setPath(p.id)}
              className={cn(
                "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                path === p.id
                  ? "border-gold bg-accent text-heritage"
                  : "border-border text-muted-foreground hover:border-gold",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>

      <ol className="mt-8 space-y-6">
        {ASSESSMENT_QUESTIONS.map((q, i) => (
          <li key={q.id}>
            <fieldset className="rounded-lg border border-border p-5">
              <legend className="px-2 text-sm font-medium text-heritage">
                {i + 1}. {q.prompt}
              </legend>
              {q.help && <p className="mt-1 text-xs text-muted-foreground">{q.help}</p>}
              <div className="mt-3 space-y-2">
                {q.options.map(o => (
                  <label
                    key={o.value}
                    className="flex cursor-pointer items-start gap-2 text-sm text-foreground/90"
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={o.value}
                      checked={answers[q.id] === o.value}
                      onChange={() => setAnswers(a => ({ ...a, [q.id]: o.value }))}
                      className="mt-1"
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button disabled={!complete} onClick={() => setSubmitted(true)}>
          See my readiness result
        </Button>
        <Button variant="ghost" onClick={reset}>
          <RotateCcw className="mr-1 size-4" aria-hidden="true" />
          Start over
        </Button>
        {!complete && (
          <span className="text-xs text-muted-foreground">
            Answer all {ASSESSMENT_QUESTIONS.length} questions to see your result.
          </span>
        )}
      </div>

      {submitted && complete && (
        <section aria-live="polite" className="mt-10 rounded-lg border border-gold bg-card p-6">
          <div className="text-[10px] uppercase tracking-[0.22em] text-gold">
            Readiness {result.percent}% · {result.score} of {result.maxScore}
          </div>
          <h2 className="mt-2 font-serif text-2xl text-heritage">{result.headline}</h2>
          <p className="mt-3 text-sm leading-relaxed text-foreground/90">{result.summary}</p>

          {result.urgentFlags.length > 0 && (
            <div className="mt-5 space-y-3">
              {result.urgentFlags.map(f => (
                <p key={f} className="flex gap-2 rounded-md border border-border p-3 text-sm text-foreground/90">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
                  <span>{f}</span>
                </p>
              ))}
            </div>
          )}

          <h3 className="mt-6 text-sm font-semibold uppercase tracking-widest text-heritage">
            Your next three steps
          </h3>
          <ul className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            {result.nextSteps.map(s => (
              <li key={s}>{s}</li>
            ))}
          </ul>

          {magnets.length > 0 && (
            <div className="mt-6 rounded-md border border-border p-4">
              <h3 className="font-serif text-lg text-heritage">Built for your situation</h3>
              <ul className="mt-2 space-y-2">
                {magnets.map(m => (
                  <li key={m.id} className="text-sm text-muted-foreground">
                    <span className="font-medium text-heritage">{m.title}</span> — {m.promise}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/contact">Book a strategy call</Link>
            </Button>
            {selectedPath && (
              <Button asChild variant="outline">
                <Link to={selectedPath.to}>
                  See the {selectedPath.label.toLowerCase()} plan
                  <ArrowRight className="ml-1 size-4" aria-hidden="true" />
                </Link>
              </Button>
            )}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            This assessment is educational and is not legal, tax, or financial advice.
          </p>
        </section>
      )}
    </div>
  );
}
