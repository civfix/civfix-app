/**
 * Whether a pushed DETAIL presents as a full PAGE on the shell's overlay layer (native) or as the compact
 * pull-up SHEET (web). This extension-less module is the web/tsc/vitest default (`false`); Metro resolves
 * the sibling `.native` variant to `true`.
 *
 * The seam exists because `BODY_LAYOUT` is ONE shared, platform-blind table: editing it flips web AND
 * native together, and web deliberately keeps its sheet. So the table stays the platform-free source of
 * truth and `resolveBodyLayout(kind, fullPageDetails)` applies this flag on top of it - which is what keeps
 * `bodyLayout.ts` pure and unit-testable at BOTH flag values from a plain node vitest run.
 *
 * Mirrors `searchRevealPlatform.ts` exactly, including the belt-and-braces `.web` sibling: the bare file is
 * ALREADY `false`, so a bundler that resolves neither extension still lands on web behaviour.
 */
export const DETAILS_ARE_FULL_PAGE = false
