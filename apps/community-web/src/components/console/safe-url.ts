import { isSafeMarkdownHref } from "@civfix/shared/markdown"

export function safeExternalHref(value: string | null | undefined): string | null {
  if (!value) return null
  return isSafeMarkdownHref(value) ? value : null
}
