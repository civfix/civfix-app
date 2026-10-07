import type { ToastVariant } from "./toastContext"

export const TOAST_QUIET_MS = 2500
export const TOAST_ERROR_MS = 5000
export const TOAST_ACTION_MS = 6000

export const TOAST_MAX_WIDTH = 460

export function toastDurationMs(
  variant: ToastVariant,
  hasAction: boolean,
  override?: number,
): number {
  if (typeof override === "number" && Number.isFinite(override)) return Math.max(0, override)
  if (hasAction) return TOAST_ACTION_MS
  return variant === "error" ? TOAST_ERROR_MS : TOAST_QUIET_MS
}

export function toastBottomOffset(
  dockFootprint: number,
  safeAreaBottom: number,
  gap: number,
  keyboardHeight = 0,
): number {
  const dock = Math.max(0, dockFootprint)
  const base = dock > 0 ? dock : Math.max(0, safeAreaBottom)
  const keyboard = Math.max(0, keyboardHeight)
  return Math.round(Math.max(base, keyboard) + gap)
}

export interface ToastLiveSemantics {
  role: "alert" | "status"
  liveRegion: "assertive" | "polite" | "none"
}

/**
 * Only an error interrupts; success and info are status messages. Native speaks every toast through one
 * explicit announcement, so its live region stays off there to avoid a second reading.
 */
export function toastLiveSemantics(variant: ToastVariant, web: boolean): ToastLiveSemantics {
  const role = variant === "error" ? "alert" : "status"
  if (!web) return { role, liveRegion: "none" }
  return { role, liveRegion: variant === "error" ? "assertive" : "polite" }
}
