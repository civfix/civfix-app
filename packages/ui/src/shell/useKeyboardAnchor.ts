/**
 * Platform selector for tooling only (tsc, the .d.ts build, plain Node): Metro picks `.native.ts` and
 * Next puts `.web.ts` ahead of `.ts`. The explicit `.web` specifier never resolves back into this file.
 */
export { useKeyboardAnchor } from "./useKeyboardAnchor.web"
export type { KeyboardAnchor, KeyboardAnchorOptions } from "./useKeyboardAnchor.types"
