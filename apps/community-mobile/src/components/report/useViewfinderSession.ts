import { useEffect, useState } from "react"
import {
  OUTPUT_DETACH_DEFER_MS,
  SESSION_RESUME_GRACE_MS,
  armsResumeGrace,
  cameraSessionRunning,
  cameraSessionVeto,
  cancelsResumeGrace,
  viewfinderPreviewEnabled,
  viewfinderVideoOutputEnabled,
  type CameraSessionVeto,
  type ViewfinderCaptureMode,
} from "@/lib/cameraSession"
import { useAppLifecycleState } from "@/hooks/useAppLifecycleState"

export interface ViewfinderSessionInputs {
  active: boolean
  resumeGrace: boolean
  mode: ViewfinderCaptureMode
  recordingBusy: boolean
  hasPermission: boolean
  hasDevice: boolean
}

export interface ViewfinderSession {
  sessionRunning: boolean
  sessionRunningOnSurface: boolean
  veto: CameraSessionVeto
  previewEnabled: boolean
  videoOutputEnabled: boolean
}

export function useViewfinderSession({
  active,
  resumeGrace,
  mode,
  recordingBusy,
  hasPermission,
  hasDevice,
}: ViewfinderSessionInputs): ViewfinderSession {
  const appState = useAppLifecycleState()

  const [graceHeld, setGraceHeld] = useState(false)
  const [outputsLinger, setOutputsLinger] = useState(false)
  const [everRan, setEverRan] = useState(false)

  const [seenActive, setSeenActive] = useState(active)
  if (seenActive !== active) {
    setSeenActive(active)
    if (
      armsResumeGrace({
        hostActive: active,
        graceEligible: resumeGrace,
        everRan,
        appState,
        recordingBusy,
      })
    ) {
      setGraceHeld(true)
      setOutputsLinger(true)
    }
  }

  const sessionInputs = {
    hostActive: active || graceHeld,
    appState,
    hasPermission,
    hasDevice,
  }
  const sessionRunning = cameraSessionRunning(sessionInputs)

  useEffect(() => {
    if (sessionRunning) setEverRan(true)
  }, [sessionRunning])

  useEffect(() => {
    if (cancelsResumeGrace(active, appState)) {
      setGraceHeld(false)
      setOutputsLinger(false)
    }
  }, [active, appState])

  useEffect(() => {
    if (!graceHeld) return
    const timer = setTimeout(() => setGraceHeld(false), SESSION_RESUME_GRACE_MS)
    return () => clearTimeout(timer)
  }, [graceHeld])

  useEffect(() => {
    if (!outputsLinger) return
    const timer = setTimeout(() => setOutputsLinger(false), OUTPUT_DETACH_DEFER_MS)
    return () => clearTimeout(timer)
  }, [outputsLinger])
  const surfaceInputs = { ...sessionInputs, hostActive: active }
  const sessionRunningOnSurface = cameraSessionRunning(surfaceInputs)
  const veto = cameraSessionVeto(surfaceInputs)

  const previewEnabled = viewfinderPreviewEnabled(active || graceHeld)
  const videoOutputEnabled = viewfinderVideoOutputEnabled({
    hostActive: active || (graceHeld && outputsLinger),
    mode,
    recordingBusy,
  })

  return { sessionRunning, sessionRunningOnSurface, veto, previewEnabled, videoOutputEnabled }
}
