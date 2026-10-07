export type ComposerMode = "post" | "quote" | "reply"

export interface ComposerParams {
  mode: ComposerMode
  targetPostId?: string
}

const COMPOSER_MODES: ReadonlySet<string> = new Set<ComposerMode>(["post", "quote", "reply"])

/** Route params are untyped strings (or arrays) at runtime, whatever `useLocalSearchParams` claims. */
export function composerParams(raw: { mode?: unknown; targetPostId?: unknown }): ComposerParams {
  const mode: ComposerMode =
    typeof raw.mode === "string" && COMPOSER_MODES.has(raw.mode) ? (raw.mode as ComposerMode) : "post"
  if (mode === "post") return { mode }
  return typeof raw.targetPostId === "string" && raw.targetPostId !== ""
    ? { mode, targetPostId: raw.targetPostId }
    : { mode }
}
