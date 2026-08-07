// Task 23 — Assessment runner. Presentation only; all intelligence
// lives in src/lib/marketing/assessments.ts.

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, RotateCcw, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  evaluateAssessment,
  type AssessmentDefinition,
  type ReadinessLevel,
} from "@/lib/marketing/assessments";
import { getGuide } from "@/lib/marketing/lead-magnets";
import { CITY_GUIDES } from "@/lib/marketing/cities";
import { trackEvent } from "@/lib/marketing/analytics";

const LEVEL_STYLES: Record<ReadinessLevel, string> = {
  Ready: "border-evergreen text-evergreen",
  "Nearly Ready": "border-gold text-gold",
  "Needs Planning": "border-border text-heritage",
  "Action Required": "border-destructive text-destructive",
};

export function AssessmentRunner({ assessment }: { assessment: AssessmentDefinition }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const complete = assessment.questions.every(q => answers[q.id]);
  const result = useMemo(
    () => evaluateAssessment(assessment, answers),
    [assessment, answers],
  );
  const guide = getGuide(assessment.guideSlug);

  function answer(qid: string, value: string) {
    if (!started) {
      setStarted(true);
      trackEvent("assessment_started", {
        assessmentId: assessment.id,
        situation: assessment.situation,
      });
    }
    setAnswers(a => ({ ...a, [qid]: value }));
  }

  function submit() {
    setSubmitted(true);
    trackEvent("assessment_completed", {
      assessmentId: assessment.id,
      situation: assessment.situation,
      readinessLevel: result.level,
      leadTier: result.qualification.tier,
    });
    trackEvent("assessment_result_viewed", {
      assessmentId: assessment.id,
      readinessLevel: result.level,
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 md:px-6">
      <ol className="space-y-6">
        {assessment.questions.map((q, i) => (
          <li key={q.id}>
            <fieldset className="rounded-lg border border-border p-5">
              <legend className="px-2 text-sm font-medium text-heritage">
                {i + 1}. {q.prompt}
              </legend>
              <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-gold">{q.factor}</p>
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
                      onChange={() => answer(q.id, o.value)}
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
        <Button disabled={!complete} onClick={submit}>
          See my result
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setAnswers({});
            setSubmitted(false);
            setStarted(false);
          }}
        >
          <RotateCcw className="mr-1 size-4" aria-hidden="true" />
          Start over
        </Button>
        {!complete && (
          <span className="text-xs text-muted-foreground">
            Answer all {assessment.questions.length} questions to see your result.
          </span>
        )}
      </div>

      {submitted && complete && (
        <section
          aria-live="polite"
          data-testid="assessment-result"
          className="mt-10 rounded-lg border border-border bg-card p-6"
        >
          <div
            className={cn(
              "inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-widest",
              LEVEL_STYLES[result.level],
            )}
          >
            {result.level}
          </div>
          <p className="mt-4 leading-relaxed text-foreground/90">{result.summary}</p>

          {result.priorities.length > 0 && (
            <>
              <h2 className="mt-6 flex items-center gap-2 font-serif text-xl text-heritage">
                <Target className="size-4 text-gold" aria-hidden="true" />
                Your top priorities
              </h2>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                {result.priorities.map(p => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
            </>
          )}

          {result.risks.length > 0 && (
            <>
              <h2 className="mt-6 flex items-center gap-2 font-serif text-xl text-heritage">
                <AlertTriangle className="size-4 text-gold" aria-hidden="true" />
                Risks worth taking seriously
              </h2>
              <ul className="mt-2 space-y-2">
                {result.risks.map(r => (
                  <li key={r} className="rounded-md border border-border p-3 text-sm text-foreground/90">
                    {r}
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 className="mt-6 font-serif text-xl text-heritage">Recommended next action</h2>
          <p className="mt-2 text-sm text-foreground/90">{result.nextAction}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {guide && (
              <Link
                to="/guides/$slug"
                params={{ slug: guide.slug }}
                className="rounded-lg border border-border p-4 transition-colors hover:border-gold"
              >
                <div className="text-[10px] uppercase tracking-[0.2em] text-gold">Your guide</div>
                <div className="mt-1 font-serif text-lg text-heritage">{guide.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{guide.promise}</p>
              </Link>
            )}
            <Link
              to="/local-guides"
              className="rounded-lg border border-border p-4 transition-colors hover:border-gold"
              onClick={() => trackEvent("local_guide_viewed", { assessmentId: assessment.id })}
            >
              <div className="text-[10px] uppercase tracking-[0.2em] text-gold">Local resource</div>
              <div className="mt-1 font-serif text-lg text-heritage">Orange County guides</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {CITY_GUIDES.slice(0, 4).map(c => c.city).join(", ")}, and more.
              </p>
            </Link>
          </div>

          {result.publicationIds.length > 0 && (
            <p className="mt-4 text-xs text-muted-foreground">
              Supporting publications: {result.publicationIds.join(", ")}.
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link
                to="/contact"
                onClick={() =>
                  trackEvent("consultation_cta_clicked", {
                    assessmentId: assessment.id,
                    readinessLevel: result.level,
                  })
                }
              >
                Book a strategy call
                <ArrowRight className="ml-1 size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/assessments">Try another assessment</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            This assessment is educational and is not legal, tax, or financial advice.
          </p>
        </section>
      )}
    </div>
  );
}
