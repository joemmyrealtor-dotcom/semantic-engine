// SEO/AEO hardening — answer-first block.
//
// Answers the page's primary user question in one concise, visible paragraph
// near the top, before the deeper explanation. Plain language, no keyword
// stuffing, no claim that is not already in the page's source data.

export interface AnswerFirstProps {
  question: string;
  answer: string;
  /** Optional short supporting points, still above the fold. */
  points?: string[];
}

export function AnswerFirst({ question, answer, points }: AnswerFirstProps) {
  return (
    <section
      aria-label="Short answer"
      data-testid="answer-first"
      className="mx-auto max-w-3xl px-4 md:px-6"
    >
      <div className="rounded-lg border-l-4 border-gold bg-card p-5">
        <h2 className="font-serif text-lg text-heritage">{question}</h2>
        <p className="mt-2 leading-relaxed text-foreground/90">{answer}</p>
        {points && points.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {points.map(p => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
