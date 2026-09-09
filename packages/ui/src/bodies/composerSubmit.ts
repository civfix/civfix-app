/**
 * composerSubmit - the pure routing brain for the chat composer's submit affordance.
 *
 * The composer field is a dual-mode surface: normally it SENDS a new message, but when the user picks
 * "Edit" on one of their bubbles it flips into an inline edit mode (ComposerModeBar above the field,
 * Check glyph on the submit button) and the same button must instead EDIT the original message. This
 * module owns that mode -> action decision, including the disabled states, so ConversationBody's press
 * handler and its button `disabled` prop share one unit-tested truth:
 *
 *   - edit mode:   trimmed draft must be non-empty AND differ from the original body (mirrors the
 *                  removed modal editor's save gate) -> `edit`; otherwise `noop`.
 *   - normal/none: trimmed draft non-empty OR ready media attached -> `send`; otherwise `noop`.
 *
 * The `reply` mode kind is typed now (P2 builds the quoted-reply flow on this union) and routes like a
 * plain send - a reply IS a send with a reference, which P2 attaches outside this helper.
 *
 * Deliberately NOT here: transport concerns the caller already owns (upload-in-flight and room-error
 * gates, mention re-filtering, scroll-to-bottom). This stays a pure (mode, draft) -> action map.
 */

/** The composer mode kinds. Only "edit" is constructed in P1; "reply" lands with P2's quoted replies. */
export type ComposerModeKind = "edit" | "reply"

/** The pure view of the active composer mode: which kind, and the target message's id + current body. */
export interface ComposerSubmitMode {
  kind: ComposerModeKind
  messageId: string
  /** The message body as it exists today - the "unchanged" comparison baseline for edits. */
  originalBody: string
}

export type ComposerSubmitResolution =
  | { action: "send"; body: string }
  | { action: "edit"; messageId: string; body: string }
  | { action: "noop" }

/**
 * Resolve what pressing the composer's submit button should do right now (and, by extension, whether
 * it is enabled - `noop` = disabled). `hasReadyMedia` is the normal-mode "attachments are staged and
 * fully uploaded" flag that lets an attachment-only message send with an empty body; edit mode is
 * text-only, so it is ignored there.
 */
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
  // No mode, or a reply (P2): a reply is a send with a reference the caller attaches.
  if (body.length === 0 && !hasReadyMedia) return { action: "noop" }
  return { action: "send", body }
}
