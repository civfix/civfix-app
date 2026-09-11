import type { TFunction } from "i18next"
import type { PostSubmitResolution } from "../postComposerSubmit"

export type InlineComposerState = "collapsed" | "open"

export interface InlineComposerDraftOwnership {
  mode: string
  replyToPostId: string | null
  quotePostId: string | null
  attachedEventId: string | null
  attachedReportId: string | null
}

/**
 * The nav entry that re-opens a draft the inline composer does not own IN THE MODE IT WAS WRITTEN.
 * `PostComposer` re-stamps mode and target from its props on mount, so pushing a bare composer entry
 * would rewrite a reply into a top-level post - the exact conversion `reset(keep)` exists to prevent.
 */
export function composerEntryFor(
  draft: InlineComposerDraftOwnership,
): { composerMode: "post" | "quote" | "reply"; targetPostId?: string } {
  const mode = draft.mode === "reply" || draft.mode === "quote" ? draft.mode : "post"
  const target = mode === "reply" ? draft.replyToPostId : mode === "quote" ? draft.quotePostId : null
  return { composerMode: mode, ...(target ? { targetPostId: target } : {}) }
}

export function inlineComposerOwnsDraft(draft: InlineComposerDraftOwnership): boolean {
  return (
    draft.mode === "post" &&
    draft.replyToPostId === null &&
    draft.quotePostId === null &&
    draft.attachedEventId === null &&
    draft.attachedReportId === null
  )
}

export interface InlineComposerModel {
  state: InlineComposerState
  placeholder: string
  submitLabel: string
  submitDisabled: boolean
}

export function buildInlineComposerModel(
  input: {
    open: boolean
    hasAuthor: boolean
    sending: boolean
    resolution: PostSubmitResolution["action"]
  },
  t: TFunction,
): InlineComposerModel {
  const open = input.open
  return {
    state: open ? "open" : "collapsed",
    placeholder: t("mode.post.placeholder"),
    submitLabel: input.sending ? t("action.posting") : t("action.post"),
    submitDisabled: !open || !input.hasAuthor || input.sending || input.resolution !== "submit",
  }
}

export function inlineComposerClosesOnBlur(input: { body: string; mediaCount: number }): boolean {
  return input.body.trim().length === 0 && input.mediaCount === 0
}
