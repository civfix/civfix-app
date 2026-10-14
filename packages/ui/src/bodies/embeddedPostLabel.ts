type LabelT = (key: string, options?: Record<string, unknown>) => string

export interface EmbeddedPostLabelInput {
  prominent: boolean
  name: string
  excerpt: string
  deleted: boolean
}

/**
 * The embedded card is one button on both platforms, so its name must carry what a sighted reader sees:
 * the author and the quoted text. A text-less post falls back to the author alone.
 */
export function embeddedPostA11yLabel(t: LabelT, { prominent, name, excerpt, deleted }: EmbeddedPostLabelInput): string {
  const text = deleted ? t("post_card.unavailable") : excerpt.trim()
  if (!text) return t("post_card.open_thread_a11y", { name })
  return t(prominent ? "post_card.open_repost_a11y" : "post_card.open_quote_a11y", {
    name,
    excerpt: text,
  })
}
