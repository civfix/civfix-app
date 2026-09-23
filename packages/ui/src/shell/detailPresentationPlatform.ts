/**
 * Whether a pushed DETAIL presents as a full PAGE on the shell's overlay layer. It is `true` on every
 * platform; the flag survives only so `resolveBodyLayout(kind, fullPageDetails)` stays unit-testable at
 * both values from a plain node vitest run.
 */
export const DETAILS_ARE_FULL_PAGE = true
