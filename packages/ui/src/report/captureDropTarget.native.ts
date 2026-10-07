/**
 * A phone or tablet has no drag source, so this reports `active: false`; the wizard gates its drop caption
 * and ring on that flag instead of branching on `Platform.OS`.
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
