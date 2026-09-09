/**
 * Platform selector for the portrait overlay's page host. Metro resolves `./PageStack` to the native
 * seam (retained layers + edge-swipe back + push/pop slides); webpack/Next and plain `tsc` resolve it
 * here, which re-exports the worklet-free web seam. Mirrors BodyTransition.tsx / PortraitShell.tsx.
 *
 * The explicit `./PageStack.web` specifier (not the bare `./PageStack`) avoids resolving back into this
 * module.
 */
export { PageStack } from "./PageStack.web"
export type { PageStackProps, PageStackRenderBody } from "./PageStack.types"
