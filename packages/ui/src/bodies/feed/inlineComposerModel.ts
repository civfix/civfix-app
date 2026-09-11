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
