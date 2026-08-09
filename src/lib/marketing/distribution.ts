// Content Authority Engine — distribution assets.
//
// One answer record fans out into channel-specific drafts. Every asset is
// derived deterministically from governed content: no claims, numbers, or
// promises are introduced here that the source answer does not already make.
// Everything is produced as a DRAFT for human review — nothing publishes or
// posts from this module.

import { absoluteUrl } from "./site";
import { BRAND } from "./positioning";
import type { AnswerRecord } from "./answers";

export type Channel = "seo" | "linkedin" | "facebook" | "x" | "youtube" | "email";

export const CHANNELS: Channel[] = ["seo", "linkedin", "facebook", "x", "youtube", "email"];

export const CHANNEL_LABEL: Record<Channel, string> = {
  seo: "Answer page (SEO/AEO)",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  x: "X",
  youtube: "YouTube Short",
  email: "Email",
};

/** Hard caps enforced on generated drafts. */
export const CHANNEL_LIMITS: Record<Channel, number> = {
  seo: 4000,
  linkedin: 2800,
  facebook: 1800,
  x: 280,
  youtube: 1200,
  email: 2200,
};

export interface DistributionAsset {
  id: string;
  answerSlug: string;
  channel: Channel;
  /** Always "Draft" — review is a human step outside this engine. */
  status: "Draft";
  title: string;
  body: string;
  cta: string;
  url: string;
  /** Plain topical tags. No hashtag spam: three maximum. */
  tags: string[];
}

const DISCLAIMER =
  "Educational only — not legal, tax, or financial advice. Equal Housing Opportunity.";

function clamp(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1).trimEnd()}…`;
}

function tagsFor(answer: AnswerRecord): string[] {
  return [answer.audience === "seller" ? "SellingAHome" : "BuyingAHome", "OrangeCounty", "RealEstate"];
}

export function answerUrl(answer: AnswerRecord): string {
  return absoluteUrl(`/answers/${answer.slug}`);
}

export function assetsFor(answer: AnswerRecord): DistributionAsset[] {
  const url = answerUrl(answer);
  const tags = tagsFor(answer);
  const short = answer.shortAnswer;

  const drafts: Omit<DistributionAsset, "id" | "answerSlug" | "status" | "url" | "tags">[] = [
    {
      channel: "seo",
      title: answer.question,
      body: `${short}\n\n${answer.detail}`,
      cta: "Read the full answer and the related guide.",
    },
    {
      channel: "linkedin",
      title: answer.question,
      body: `${answer.question}\n\n${short}\n\nFull breakdown, including what changes the recommendation: ${url}\n\n${DISCLAIMER}`,
      cta: "Read the full answer",
    },
    {
      channel: "facebook",
      title: answer.question,
      body: `${answer.question}\n\n${short}\n\n${url}`,
      cta: "Read the full answer",
    },
    {
      channel: "x",
      title: answer.question,
      body: `${answer.question} ${clamp(short, 180)} ${url}`,
      cta: "Read more",
    },
    {
      channel: "youtube",
      title: clamp(answer.question, 90),
      body: [
        `HOOK: ${answer.question}`,
        `ANSWER (say it first): ${short}`,
        `DETAIL: ${clamp(answer.detail, 500)}`,
        `CLOSE: The written version, with the numbers, is at ${url}.`,
        `ON-SCREEN: ${DISCLAIMER}`,
      ].join("\n"),
      cta: "Link the answer page in the description",
    },
    {
      channel: "email",
      title: clamp(answer.question, 70),
      body: `${short}\n\n${clamp(answer.detail, 900)}\n\nFull answer: ${url}\n\n— ${BRAND.advisor}, ${BRAND.publisher}\n${DISCLAIMER}`,
      cta: "Read the full answer",
    },
  ];

  return drafts.map(d => ({
    ...d,
    id: `${answer.id}-${d.channel.toUpperCase()}`,
    answerSlug: answer.slug,
    status: "Draft" as const,
    url,
    tags,
    body: clamp(d.body, CHANNEL_LIMITS[d.channel]),
  }));
}

export function allAssets(answers: AnswerRecord[]): DistributionAsset[] {
  return answers.flatMap(assetsFor);
}
