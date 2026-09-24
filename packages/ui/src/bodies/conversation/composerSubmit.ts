/**
 * One mode -> action decision for the chat composer's submit button, shared by the press handler and the
 * button's `disabled` prop so the two cannot disagree. Edit mode needs a non-empty draft that differs from
 * the original body; any other mode needs text or ready media. A reply routes like a send because the
 * caller attaches the reference. Transport gates (uploads in flight, room errors) stay with the caller.
 */

export type ComposerModeKind = "edit" | "reply"

export interface ComposerSubmitMode {
  kind: ComposerModeKind
  messageId: string
  originalBody: string
}

export type ComposerSubmitResolution =
  | { action: "send"; body: string }
  | { action: "edit"; messageId: string; body: string }
  | { action: "noop" }

/** `noop` doubles as "disabled". Edit mode is text-only, so `hasReadyMedia` only matters for a send. */
export function resolveComposerSubmit(
  mode: ComposerSubmitMode | null,
  draft: string,
  hasReadyMedia = false,
): ComposerSubmitResolution {
  const body = draft.trim()
  if (mode && mode.kind === "edit") {
    if (body.length === 0) return { action: "noop" }
    if (body === mode.originalBody.trim()) return { action: "noop" }
    return { action: "edit", messageId: mode.messageId, body }
  }
  if (body.length === 0 && !hasReadyMedia) return { action: "noop" }
  return { action: "send", body }
}
