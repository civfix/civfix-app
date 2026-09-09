/**
 * useKeyboardAnchor - default selector (tooling-only).
 *
 * The bundlers pick the `.web` / `.native` sibling by extension before this file is consulted; it exists
 * only for platform-unaware tooling (tsc, the .d.ts build, plain Node). Metro picks `.native.ts`; Next
 * puts `.web.ts` ahead of `.ts`. Re-export the explicit `.web` specifier so it never resolves back into
 * itself. Same convention as `useKeyboardInset.ts`. See section 7 of the UI authoring guide.
 */
export { useKeyboardAnchor } from "./useKeyboardAnchor.web"
export type { KeyboardAnchor, KeyboardAnchorOptions } from "./useKeyboardAnchor.types"
