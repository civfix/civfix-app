import { tokens } from "@civfix/shared/tokens"

export const LIGHTBOX_FALLBACK_ASPECT_RATIO = 16 / 9

export const LIGHTBOX_STAGE_MAX_WIDTH = 1100

export const LIGHTBOX_STAGE_PADDING_X = tokens.space["6"]

export const LIGHTBOX_STAGE_PADDING_Y = tokens.space["16"]

export interface LightboxDimensions {
  width?: number | null
  height?: number | null
}

export function lightboxAspectRatio(item: LightboxDimensions | null | undefined): number {
  const width = item?.width
  const height = item?.height
  if (typeof width !== "number" || typeof height !== "number") return LIGHTBOX_FALLBACK_ASPECT_RATIO
  if (!Number.isFinite(width) || !Number.isFinite(height)) return LIGHTBOX_FALLBACK_ASPECT_RATIO
  if (width <= 0 || height <= 0) return LIGHTBOX_FALLBACK_ASPECT_RATIO
  return width / height
}

export interface LightboxMediaWidthInput {
  ratio: number
  windowWidth: number
  windowHeight: number
}

export function lightboxMediaWidth({ ratio, windowWidth, windowHeight }: LightboxMediaWidthInput): number {
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : LIGHTBOX_FALLBACK_ASPECT_RATIO
  const byWidth = Math.min(windowWidth, LIGHTBOX_STAGE_MAX_WIDTH) - LIGHTBOX_STAGE_PADDING_X * 2
  const byHeight = (windowHeight - LIGHTBOX_STAGE_PADDING_Y * 2) * safeRatio
  return Math.max(1, Math.min(byWidth, byHeight))
}

export function lightboxMediaHeight(width: number, ratio: number): number {
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : LIGHTBOX_FALLBACK_ASPECT_RATIO
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1
  return Math.max(1, safeWidth / safeRatio)
}

export const LIGHTBOX_CLOSE_GUTTER = tokens.space["4"]

export const LIGHTBOX_CHEVRON_GUTTER = tokens.space["3"]

export interface LightboxSafeAreaInsets {
  top?: number | null
  right?: number | null
  bottom?: number | null
  left?: number | null
}

export interface LightboxControlOffsets {
  close: { top: number; right: number }
  prev: { left: number }
  next: { right: number }
}

function safeInset(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0
  return value
}

export function lightboxControlOffsets(
  insets: LightboxSafeAreaInsets | null | undefined,
): LightboxControlOffsets {
  const top = safeInset(insets?.top)
  const right = safeInset(insets?.right)
  const left = safeInset(insets?.left)
  return {
    close: { top: top + LIGHTBOX_CLOSE_GUTTER, right: right + LIGHTBOX_CLOSE_GUTTER },
    prev: { left: left + LIGHTBOX_CHEVRON_GUTTER },
    next: { right: right + LIGHTBOX_CHEVRON_GUTTER },
  }
}
