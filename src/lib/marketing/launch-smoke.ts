// Launch-day smoke runbook — in code, executable by a human operator.
//
// This is a checklist, not an automation. It performs no navigation, no
// network call, no delivery, and no publication. Each step names the exact
// surface to open, what a PASS looks like, and what to do on failure.

export interface SmokeStep {
  id: string;
  order: number;
  surface: string;
  action: string;
  pass: string;
  onFailure: string;
  /** True when a failure here should stop the launch rather than be logged. */
  blocking: boolean;
}

export const LAUNCH_SMOKE_STEPS: SmokeStep[] = [
  {
    id: "S1",
    order: 1,
    surface: "/home",
    action: "Load the home page on a mobile viewport and a desktop viewport.",
    pass: "Page renders, primary next action is visible without horizontal scrolling, and no console error appears.",
    onFailure: "Stop. Do not announce the site. Capture the console output and re-run the build verification.",
    blocking: true,
  },
  {
    id: "S2",
    order: 2,
    surface: "Footer disclosure (any public page)",
    action: "Confirm the licensee, brokerage, and both DRE numbers render, and tap the phone and email links.",
    pass: "Phone opens the dialer, email opens a compose window, and the disclosure text is fully readable.",
    onFailure: "Stop. A public page without a complete license disclosure must not remain reachable.",
    blocking: true,
  },
  {
    id: "S3",
    order: 3,
    surface: "/guides/<any guide>",
    action: "Submit the guide form with a test address, consent checked.",
    pass: "Thank-you state renders, the lead lands in the local delivery queue with attribution, and no PII appears in analytics storage.",
    onFailure: "Stop lead-generating promotion until capture is restored; captured-but-undelivered is recoverable, uncaptured is not.",
    blocking: true,
  },
  {
    id: "S4",
    order: 4,
    surface: "/assessments/<any assessment>",
    action: "Complete an assessment end to end and submit the result form.",
    pass: "A readiness level is produced and the lead is queued with the assessment and readiness recorded.",
    onFailure: "Log and disable promotion of the assessment path only; other capture paths may continue.",
    blocking: false,
  },
  {
    id: "S5",
    order: 5,
    surface: "/contact",
    action: "Verify direct phone and email, then confirm no turnaround time is promised anywhere on the page.",
    pass: "Both contact methods work and the copy states only that timing varies.",
    onFailure: "Stop. Remove any service-level promise before continuing.",
    blocking: true,
  },
  {
    id: "S6",
    order: 6,
    surface: "Mobile high-intent page",
    action: "Scroll a situation page on a phone viewport and check the mobile conversion bar.",
    pass: "Two calm actions, tap targets comfortable, no overlap with the consent banner, no urgency language.",
    onFailure: "Log; non-blocking. The in-page conversion paths remain available.",
    blocking: false,
  },
  {
    id: "S7",
    order: 7,
    surface: "Consent banner",
    action: "Decline consent, then reload and confirm behaviour.",
    pass: "The choice persists and no analytics event is written after a decline.",
    onFailure: "Stop. A consent failure is a privacy defect, not a marketing defect.",
    blocking: true,
  },
  {
    id: "S8",
    order: 8,
    surface: "/admin/lead-delivery",
    action: "Sign in as an authorized operator and open the delivery view.",
    pass: "The view is gated, shows the queued test lead, and shows CRM delivery as not connected rather than silently succeeding.",
    onFailure: "Stop promotion. Undetected delivery failure is worse than a visible queue.",
    blocking: true,
  },
  {
    id: "S9",
    order: 9,
    surface: "/admin/growth-command",
    action: "Read the launch conversion readiness roll-up.",
    pass: "Internal readiness is READY and every external item is explicitly BLOCKED rather than assumed.",
    onFailure: "Record the deviation in the launch log before proceeding.",
    blocking: false,
  },
  {
    id: "S10",
    order: 10,
    surface: "Search surfaces",
    action: "Confirm the indexable inventory and robots directives are unchanged from the approved baseline.",
    pass: "126 indexable URLs; governed and operator routes remain noindex.",
    onFailure: "Stop. An index-surface change is a release-scope change and needs Owner authorization.",
    blocking: true,
  },
  {
    id: "S11",
    order: 11,
    surface: "Test data cleanup",
    action: "Remove every test lead created during this runbook from the delivery queue.",
    pass: "No test record remains in any queue or operator view.",
    onFailure: "Clean up before any real lead arrives so operator counts stay trustworthy.",
    blocking: true,
  },
];

export interface SmokeRunbook {
  steps: SmokeStep[];
  blockingCount: number;
  /** Explicit: this runbook is executed by a person, never by the app. */
  automated: false;
}

export function buildLaunchSmokeRunbook(): SmokeRunbook {
  const steps = [...LAUNCH_SMOKE_STEPS].sort((a, b) => a.order - b.order);
  return {
    steps,
    blockingCount: steps.filter(s => s.blocking).length,
    automated: false,
  };
}
