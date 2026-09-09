/**
 * Whether Search rides as a morph-synced OVERLAY over a persistent base (native) or stays a normal base
 * body (web). This extension-less module is the web/tsc default (`false`); Metro resolves the sibling
 * `.native` variant to `true`. Gating the base-view/mount divergence behind this flag keeps the web shell
 * byte-identical (`effectiveBaseView` collapses to identity, `SearchBodyReveal.web` is a no-op).
 */
export const SEARCH_IS_OVERLAY = false
