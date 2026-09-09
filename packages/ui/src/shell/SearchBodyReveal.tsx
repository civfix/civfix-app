/**
 * SearchBodyReveal (platform-agnostic default) - the search-reveal overlay seam selector.
 *
 * Metro resolves `./SearchBodyReveal` -> SearchBodyReveal.native.tsx (the reanimated morph-synced overlay);
 * webpack/Next resolves -> SearchBodyReveal.web.tsx (a no-op). This extension-less file is consulted only by
 * platform-agnostic tooling (tsc, plain Node) and re-exports the web (worklet-free) seam for concrete types.
 * Mirrors BodyTransition.tsx / CompactShell.tsx.
 */
export { SearchBodyReveal } from "./SearchBodyReveal.web"
export type { SearchBodyRevealProps } from "./SearchBodyReveal.types"
