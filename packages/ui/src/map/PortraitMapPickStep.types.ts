import type { LatLng } from "./LocationPicker.types"

export interface PortraitMapPickStepProps {
  visible: boolean
  value: LatLng | null
  initialCenter?: LatLng | null
  onConfirm: (lat: number, lng: number) => void
  onCancel: () => void
  markerCategory?: string
  presentation?: "modal" | "layer"
  inert?: boolean
}

export const INLINE_PICK_HEIGHT = 360
