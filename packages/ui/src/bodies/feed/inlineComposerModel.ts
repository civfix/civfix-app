import type { TFunction } from "i18next"
import type { PostSubmitResolution } from "../postComposerSubmit"

export type InlineComposerState = "collapsed" | "open"

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
  return {
    state: input.open ? "open" : "collapsed",
    placeholder: t("mode.post.placeholder"),
    submitLabel: input.sending ? t("action.posting") : t("action.post"),
    submitDisabled: !input.hasAuthor || input.sending || input.resolution !== "submit",
  }
}

export function inlineComposerClosesOnBlur(input: { body: string; mediaCount: number }): boolean {
  return input.body.trim().length === 0 && input.mediaCount === 0
}
