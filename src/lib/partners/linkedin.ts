// Task 26 — LinkedIn support.
//
// Connection context and follow-up language only. No automation, no scraping,
// no bulk invitations: a request is drafted, an operator sends it by hand, and
// the outcome is recorded here.

import { partnerType, type Partner } from "./schema";

export const LINKEDIN_RULES = [
  "One request per person. No repeat invitations after a decline.",
  "Every request carries a specific reason for connecting — never a blank invite.",
  "The request follows the introduction email; it does not lead.",
  "No sales language, no pitch, no link in the connection note.",
  "Engagement before ask: comment on their work before requesting anything.",
];

export interface LinkedInDraft {
  partnerId: string;
  connectionNote: string;
  followUpMessage: string;
  engagementIdeas: string[];
  characterCount: number;
  withinLimit: boolean;
}

const LIMIT = 300;

export function buildLinkedInDraft(partner: Partner): LinkedInDraft {
  const first = partner.contactName.split(" ")[0] ?? partner.contactName;
  const label = (partnerType(partner.partnerTypeId)?.label ?? "professional").toLowerCase();
  const city = partner.city || "north Orange County";

  const connectionNote = `${first} — I work with ${city} families on property decisions that sit alongside ${label} work. Connecting in case we ever share a client file.`;

  const followUpMessage = `Thanks for connecting, ${first}. No pitch here — I keep a free resource kit for ${label}s (checklists and client handouts on the property side of these matters). Happy to send it if it is useful, and happy to be a no-cost second opinion any time a client has a property question.`;

  return {
    partnerId: partner.id,
    connectionNote,
    followUpMessage,
    engagementIdeas: [
      `Read and comment substantively on a recent post from ${partner.company || "their firm"}.`,
      "Share one of their published articles with a note about where it applies locally.",
      "Reference a specific local matter type they handle in the first message.",
    ],
    characterCount: connectionNote.length,
    withinLimit: connectionNote.length <= LIMIT,
  };
}
