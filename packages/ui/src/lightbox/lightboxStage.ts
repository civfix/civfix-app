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
