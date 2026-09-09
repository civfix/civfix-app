/**
 * Capture-step file DROP target - NATIVE seam: there is no drag source on a phone or tablet, so this is a
 * no-op that reports `active: false`. The wizard's caption and ring are gated on that flag, which is why
 * the capture card stays byte-identical on native without a single `Platform.OS` branch in the body.
 */
import type { ViewStyle } from "react-native"
import type { Theme } from "../theme"
import type { CaptureDropTarget, DroppedItem } from "./captureDropTarget.shared"

const INERT: CaptureDropTarget = { ref: () => {}, dragging: false, active: false }

export function useCaptureDropTarget(
  _enabled: boolean,
  _onDrop: (items: readonly DroppedItem[]) => void,
): CaptureDropTarget {
  return INERT
}

export const captureDropTargetStyle: ViewStyle = {}

export function captureDropActiveStyleFor(_theme: Theme): ViewStyle {
  return {}
}
