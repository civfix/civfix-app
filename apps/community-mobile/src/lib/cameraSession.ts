
export type AppLifecycleState = "active" | "background" | "inactive" | "unknown" | "extension"

export const MAX_VIDEO_SECONDS = 10

export interface CameraSessionInputs {
  hostActive: boolean
  appState: AppLifecycleState
  hasPermission: boolean
  hasDevice: boolean
}

export function cameraSessionRunning(i: CameraSessionInputs): boolean {
  return cameraSessionVeto(i) === "none"
}

export type CameraSessionVeto =
  | "none"
  | "left-surface"
  | "transient-inactive"
  | "backgrounded"
  | "no-permission"
  | "no-device"

export function cameraSessionVeto(i: CameraSessionInputs): CameraSessionVeto {
  if (!i.hostActive) return "left-surface"
  if (i.appState === "inactive") return "transient-inactive"
  if (i.appState !== "active") return "backgrounded"
  if (!i.hasPermission) return "no-permission"
  if (!i.hasDevice) return "no-device"
  return "none"
}


export const SESSION_RESUME_GRACE_MS = 10_000

export const OUTPUT_DETACH_DEFER_MS = 350

export interface ResumeGraceInputs {
  hostActive: boolean
  graceEligible: boolean
  everRan: boolean
  appState: AppLifecycleState
  recordingBusy: boolean
}

export function armsResumeGrace(i: ResumeGraceInputs): boolean {
  if (i.hostActive) return false
  if (!i.graceEligible) return false
  if (!i.everRan) return false
  if (i.appState !== "active") return false
  return !i.recordingBusy
}

export function cancelsResumeGrace(hostActive: boolean, appState: AppLifecycleState): boolean {
  return hostActive || appState !== "active"
}


export type ViewfinderCaptureMode = "photo" | "video"

export interface ViewfinderOutputInputs {
  hostActive: boolean
  mode: ViewfinderCaptureMode
  recordingBusy: boolean
}

export function viewfinderPreviewEnabled(i: ViewfinderOutputInputs): boolean {
  return i.hostActive
}

export function viewfinderVideoOutputEnabled(i: ViewfinderOutputInputs): boolean {
  if (i.recordingBusy) return true
  return i.mode === "video" && i.hostActive
}


export type MicDeferralAction = "record-now" | "defer-until-audio-commits" | "record-without-audio"

export interface MicDeferralInputs {
  audioEnabled: boolean
  granted: boolean
}

export function micDeferralAction({ audioEnabled, granted }: MicDeferralInputs): MicDeferralAction {
  if (audioEnabled) return "record-now"
  return granted ? "defer-until-audio-commits" : "record-without-audio"
}

export function startsDeferredRecording(pending: boolean, sessionRunning: boolean, audioCommitted: boolean): boolean {
  return pending && sessionRunning && audioCommitted
}

export const BACKGROUNDED_PARK_GRACE_MS = 2000

export function dropsParkedRecording(veto: CameraSessionVeto, msSinceParked: number): boolean {
  if (veto === "none" || veto === "transient-inactive") return false
  if (veto !== "backgrounded") return true
  return msSinceParked >= BACKGROUNDED_PARK_GRACE_MS
}

export function parkIsStale(msSinceParked: number): boolean {
  return msSinceParked >= BACKGROUNDED_PARK_GRACE_MS
}


export const SCAN_DEBOUNCE_MS = 1500

export interface ScannedCode {
  value?: string | null
}

export function firstCodeValue(codes: readonly ScannedCode[] | null | undefined): string | null {
  if (!codes) return null
  for (const code of codes) {
    const value = typeof code?.value === "string" ? code.value.trim() : ""
    if (value !== "") return value
  }
  return null
}

export interface ScanDebounceInputs {
  value: string
  lastValue: string | null
  lastAt: number
  now: number
}

export function acceptsScannedCode(i: ScanDebounceInputs): boolean {
  if (i.value === "") return false
  if (i.value !== i.lastValue) return true
  return i.now - i.lastAt >= SCAN_DEBOUNCE_MS
}
