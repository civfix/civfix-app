import { space } from "@civfix/shared/tokens"

export const INLINE_EMPTY_LAYOUT = {
  paddingVertical: space["3"],
  gap: space["3"],
  iconSize: 20,
  titleLineHeight: 20,
  bodyLineHeight: 16,
} as const

export function inlineEmptyHeight(bodyLines: number): number {
  const head = Math.max(INLINE_EMPTY_LAYOUT.iconSize, INLINE_EMPTY_LAYOUT.titleLineHeight)
  const body = Math.max(0, bodyLines) * INLINE_EMPTY_LAYOUT.bodyLineHeight
  return INLINE_EMPTY_LAYOUT.paddingVertical * 2 + head + body
}
