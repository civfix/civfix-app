import type { LatLng } from "./LocationPicker.types"
import type { PinTarget } from "./pins/appearance"

export interface PortraitMapPickStepProps {
  visible: boolean
  value: LatLng | null
  initialCenter?: LatLng | null
  onConfirm: (lat: number, lng: number) => void
  onCancel: () => void
  pin: PinTarget
  presentation?: "modal" | "layer"
  inert?: boolean
}

export const INLINE_PICK_HEIGHT = 360
