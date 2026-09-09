/**
 * Whether the compact shell KEEPS one map instance mounted under every view (native) or tears it down on
 * the way out of the Map tab and rebuilds it on the way back in (web). This extension-less module is the
 * web/tsc/vitest default (`false`); Metro resolves the sibling `.native` variant to `true`.
 *
 * The third member of the same seam family as `searchRevealPlatform.ts` and `detailPresentationPlatform.ts`,
 * including the belt-and-braces `.web` sibling: the bare file is ALREADY `false`, so a bundler that resolves
 * neither extension still lands on web behaviour. `bodyLayout.ts` imports none of them - the flag is threaded
 * in from AppShell as `portraitShellPlan`'s `retainMap` argument, which is what keeps that module pure and
 * unit-testable at BOTH values from a plain node vitest run (see `__tests__/mapRetention.test.ts`).
 *
 * WHY WEB IS AND STAYS FALSE, stated so nobody "completes" the seam by flipping it: the web map is a
 * maplibre-gl WebGL context that the Next app's `home-shell.tsx` supplies UNCONDITIONALLY, so retaining it
 * here would leave a live GL context resident under every mobile-web page and buy nothing - web has no
 * report-tab camera whose rebuild the retention is protecting, and a browser tab that leaves the map is a
 * real navigation. The cost being removed is native-only: an AVCaptureSession and a MapLibre GL surface
 * being constructed inside the same tab tap.
 */
export const MAP_IS_RETAINED = false
