/**
 * Platform selector: Metro resolves the native seam, while Next and plain `tsc` land here and get the
 * worklet-free web seam through the explicit `.web` specifier, which never resolves back into this module.
 */
export { PageStack } from "./PageStack.web"
export type { PageStackProps, PageStackRenderBody } from "./PageStack.types"
