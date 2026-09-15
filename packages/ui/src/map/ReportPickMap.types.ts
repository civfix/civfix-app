import type { BBox, ReportPinDTO } from "@civfix/shared"
import type { LatLng } from "@civfix/shared/geocode"

export type ReportPickPinState = "idle" | "selected" | "linked" | "unlinking"

export interface ReportPickPinLook {
  active: boolean
  badge: "check" | "plus" | null
  muted: boolean
}

export interface ReportPickMapProps {
  center: LatLng
  radiusM: number
  zoom: number
  pins: readonly ReportPinDTO[]
  stateOf: (id: string) => ReportPickPinState
  focusedId: string | null
  lookFor: (state: ReportPickPinState, focused: boolean) => ReportPickPinLook
  pinLabel: (pin: ReportPinDTO, state: ReportPickPinState) => string
  clusterLabel: (count: number) => string
  mapLabel: string
  meetingPointLabel: string
  onPressPin: (id: string) => void
  onPressMap?: () => void
  onRegionChange: (bbox: BBox, zoom: number) => void
  attributionBottomInset?: number
}

export interface ReportPickMapHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void
}

export const REPORT_PICK_PIN_SIZE = 34
export const REPORT_PICK_MEETING_PIN_SIZE = 30
export const REPORT_PICK_MUTED_OPACITY = 0.62
export const REPORT_PICK_RADIUS_FILL_ALPHA = 0.08
export const REPORT_PICK_RADIUS_LINE_ALPHA = 0.35
export const REPORT_PICK_FLY_MS = 450
