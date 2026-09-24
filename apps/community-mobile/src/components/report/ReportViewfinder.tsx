import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { View, Pressable, StyleSheet, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  type VideoFile,
  type PhotoFile,
} from "react-native-vision-camera"
import * as ImagePicker from "expo-image-picker"
import * as Location from "expo-location"
import { CAMERA_CHROME_THEME, fontFamily, fontSize, makeThemedStyles, radius, space, useTheme } from "@/theme"
import { Text, PrimaryButton, useToast } from "@civfix/ui"
import { useHaptics, type CameraViewfinderProps, type CapturedMedia } from "@civfix/ui/capabilities"
import { useT } from "@civfix/ui/i18n"
import { withTimeout } from "@civfix/shared"
import {
  BACKGROUNDED_PARK_GRACE_MS,
  MAX_VIDEO_SECONDS,
  dropsParkedRecording,
  micDeferralAction,
  parkIsStale,
  startsDeferredRecording,
  type ViewfinderCaptureMode,
} from "@/lib/cameraSession"
import { GPS_TIMEOUT_MS, LAST_KNOWN_MAX_AGE_MS } from "@/lib/locationTimeouts"
import { locateCapture, type CaptureOrigin } from "@/lib/captureLocation"
import { capturedMediaFromPickerAsset, fileUri } from "@/lib/capturedMedia"
import { CameraPermissionGate } from "@/components/camera/CameraPermissionGate"
import { CaptureModeToggle } from "./CaptureModeToggle"
import { useViewfinderSession } from "./useViewfinderSession"

type CaptureFailure = "error.photo" | "error.recording" | "error.library"

export type ReportViewfinderProps = Omit<CameraViewfinderProps, "onCancel"> & {
  resumeGrace?: boolean
}

const stage = CAMERA_CHROME_THEME

const RECORDING_RED = "#FF3B30"

const ELAPSED_TICK_MS = 100

// A stop that races the recording's own end rejects harmlessly; a real failure reaches onRecordingError.
function stopRecordingQuietly(camera: Camera | null): void {
  camera?.stopRecording().catch(() => undefined)
}

async function readShutterLocation(): Promise<{ lat: number; lng: number } | null> {
  try {
    let granted =
      (await Location.getForegroundPermissionsAsync()).status === Location.PermissionStatus.GRANTED
    if (!granted) {
      granted =
        (await Location.requestForegroundPermissionsAsync()).status ===
        Location.PermissionStatus.GRANTED
    }
    if (!granted) return null
    const last = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }).catch(() => null)
    const pos =
      last ??
      (await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        GPS_TIMEOUT_MS,
      ))
    if (!pos) return null
    return { lat: pos.coords.latitude, lng: pos.coords.longitude }
  } catch {
    return null
  }
}

export function ReportViewfinder({
  active,
  resumeGrace = false,
  mode: initialMode = "photo",
  onCaptured,
}: ReportViewfinderProps) {
  const { t } = useT("mobile-report-camera")
  const th = useTheme()
  const styles = useStyles()
  const toast = useToast()
  const haptics = useHaptics()

  const cameraPermission = useCameraPermission()
  const mic = useMicrophonePermission()
  const device = useCameraDevice("back")

  const cameraRef = useRef<Camera>(null)
  const [mode, setMode] = useState<ViewfinderCaptureMode>(initialMode)
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [audioEnabled, setAudioEnabled] = useState(mic.hasPermission)
  const pendingRecordRef = useRef(false)
  const parkedAtRef = useRef<number | null>(null)
  const recordingRef = useRef(false)
  const mountedRef = useRef(true)
  const hardStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { sessionRunning, sessionRunningOnSurface, veto, previewEnabled, videoOutputEnabled } =
    useViewfinderSession({
      active,
      resumeGrace,
      mode,
      recordingBusy: recordingRef.current || pendingRecordRef.current,
      hasPermission: cameraPermission.hasPermission,
      hasDevice: device != null,
    })

  const clearHardStop = useCallback(() => {
    if (hardStopRef.current) {
      clearTimeout(hardStopRef.current)
      hardStopRef.current = null
    }
  }, [])
  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])
  const setRecordingState = useCallback(
    (next: boolean) => {
      recordingRef.current = next
      setRecording(next)
      if (!next) {
        clearHardStop()
        clearTick()
      }
    },
    [clearHardStop, clearTick],
  )

  const stopIfRecording = useCallback(() => {
    if (recordingRef.current) stopRecordingQuietly(cameraRef.current)
  }, [])

  useLayoutEffect(() => {
    return () => {
      stopIfRecording()
    }
  }, [stopIfRecording])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      pendingRecordRef.current = false
      parkedAtRef.current = null
      clearHardStop()
      clearTick()
    }
  }, [clearHardStop, clearTick])

  const reportCaptureFailure = useCallback(
    (failure: CaptureFailure) => {
      if (!mountedRef.current) return
      setBusy(false)
      haptics.error()
      toast.show(t(failure), { variant: "error" })
    },
    [haptics, t, toast],
  )

  const emitCapture = useCallback(
    (media: CapturedMedia, origin: CaptureOrigin) => {
      void (async () => {
        const located = await locateCapture(media, origin, readShutterLocation)
        try {
          if (!mountedRef.current) return
          onCaptured(located)
        } finally {
          if (mountedRef.current) setBusy(false)
        }
      })()
    },
    [onCaptured],
  )

  const onTakePhoto = useCallback(async () => {
    if (!cameraRef.current || busy) return
    setBusy(true)
    try {
      const photo: PhotoFile = await cameraRef.current.takePhoto({
        flash: "off",
        enableShutterSound: false,
      })
      emitCapture({
        uri: fileUri(photo.path),
        kind: "image",
        mime: "image/jpeg",
        width: photo.width,
        height: photo.height,
      }, "camera")
    } catch {
      reportCaptureFailure("error.photo")
    }
  }, [busy, emitCapture, reportCaptureFailure])

  const beginRecording = useCallback(() => {
    if (!cameraRef.current) return
    setElapsed(0)
    setRecordingState(true)
    clearTick()
    tickRef.current = setInterval(() => {
      setElapsed((e) => Math.min(MAX_VIDEO_SECONDS, Math.round((e + 0.1) * 10) / 10))
    }, ELAPSED_TICK_MS)
    cameraRef.current.startRecording({
      fileType: "mp4",
      videoCodec: "h264",
      onRecordingFinished: (video: VideoFile) => {
        if (!mountedRef.current) return
        setRecordingState(false)
        emitCapture({
          uri: fileUri(video.path),
          kind: "video",
          mime: "video/mp4",
          width: video.width,
          height: video.height,
          durationSec: video.duration,
        }, "camera")
      },
      onRecordingError: () => {
        if (!mountedRef.current) return
        setRecordingState(false)
        reportCaptureFailure("error.recording")
      },
    })

    clearHardStop()
    hardStopRef.current = setTimeout(() => {
      hardStopRef.current = null
      if (recordingRef.current) stopRecordingQuietly(cameraRef.current)
    }, MAX_VIDEO_SECONDS * 1000)
  }, [clearHardStop, clearTick, emitCapture, reportCaptureFailure, setRecordingState])

  useEffect(() => {
    if (!pendingRecordRef.current) return
    const msSinceParked = Date.now() - (parkedAtRef.current ?? Number.NEGATIVE_INFINITY)
    if (parkIsStale(msSinceParked)) {
      pendingRecordRef.current = false
      parkedAtRef.current = null
      return
    }
    if (startsDeferredRecording(pendingRecordRef.current, sessionRunningOnSurface, audioEnabled)) {
      pendingRecordRef.current = false
      beginRecording()
      return
    }
    if (dropsParkedRecording(veto, msSinceParked)) {
      pendingRecordRef.current = false
      parkedAtRef.current = null
      return
    }
    if (veto !== "backgrounded") return
    const remainingMs = Math.max(BACKGROUNDED_PARK_GRACE_MS - msSinceParked, 0)
    const timer = setTimeout(() => {
      if (!pendingRecordRef.current) return
      const elapsedNow = Date.now() - (parkedAtRef.current ?? Number.NEGATIVE_INFINITY)
      if (dropsParkedRecording(veto, elapsedNow)) {
        pendingRecordRef.current = false
        parkedAtRef.current = null
      }
    }, remainingMs)
    return () => clearTimeout(timer)
  }, [audioEnabled, beginRecording, sessionRunningOnSurface, veto])

  useEffect(() => {
    if (mic.hasPermission) setAudioEnabled(true)
  }, [mic.hasPermission])

  useEffect(() => {
    if (sessionRunning || !recordingRef.current) return
    clearHardStop()
    stopRecordingQuietly(cameraRef.current)
  }, [sessionRunning, clearHardStop])

  const onToggleRecord = useCallback(async () => {
    if (!cameraRef.current || busy) return

    if (recordingRef.current) {
      clearHardStop()
      setBusy(true)
      stopRecordingQuietly(cameraRef.current)
      return
    }

    const granted = audioEnabled ? false : await mic.requestPermission()
    if (micDeferralAction({ audioEnabled, granted }) === "defer-until-audio-commits") {
      parkedAtRef.current = Date.now()
      pendingRecordRef.current = true
      setAudioEnabled(true)
      return
    }
    beginRecording()
  }, [audioEnabled, beginRecording, busy, clearHardStop, mic])

  const onPickFromLibrary = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        quality: 1,
        videoMaxDuration: MAX_VIDEO_SECONDS,
      })
      if (result.canceled || result.assets.length === 0) {
        setBusy(false)
        return
      }
      emitCapture(capturedMediaFromPickerAsset(result.assets[0]!), "library")
    } catch {
      reportCaptureFailure("error.library")
    }
  }, [busy, emitCapture, reportCaptureFailure])

  if (!cameraPermission.hasPermission || device == null) {
    const denied = !cameraPermission.hasPermission
    return (
      <CameraPermissionGate
        denied={denied}
        copy={{
          title: denied ? t("gate.camera.title") : t("gate.no_camera.title"),
          body: denied ? t("gate.camera.body") : t("gate.no_camera.body"),
          continueLabel: t("gate.camera.continue"),
          openSettingsLabel: t("gate.camera.open_settings"),
        }}
        onRequestPermission={() => {
          void cameraPermission.requestPermission()
        }}
        secondaryAction={
          <PrimaryButton
            label={t("gate.choose_library")}
            variant="outline"
            onPress={onPickFromLibrary}
            style={styles.gateBtnSecondary}
          />
        }
      />
    )
  }

  return (
    <View style={styles.cameraRoot}>
      <View style={styles.viewfinder}>
        {device != null ? (
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={sessionRunning}
            preview={previewEnabled}
            photo={mode === "photo"}
            video={videoOutputEnabled}
            audio={mode === "video" && audioEnabled}
            outputOrientation="preview"
          />
        ) : null}

        <View style={cameraStyles.frame} pointerEvents="none" />

        {recording ? (
          <View style={cameraStyles.recBadge}>
            <View style={cameraStyles.recDot} />
            <Text style={cameraStyles.recText}>{t("timer.elapsed", { elapsed: elapsed.toFixed(1) })}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.controls}>
        <CaptureModeToggle mode={mode} onChange={setMode} disabled={recording} />

        <View style={styles.shutterRow}>
          <Pressable
            onPress={onPickFromLibrary}
            disabled={busy || recording}
            accessibilityRole="button"
            accessibilityLabel={t("gate.choose_library")}
            hitSlop={8}
            style={({ pressed }) => [styles.sideBtn, pressed && !(busy || recording) ? styles.pressed : null]}
          >
            <Ionicons name="images" size={22} color={th.colors.text} />
          </Pressable>

          <Pressable
            onPress={mode === "photo" ? onTakePhoto : onToggleRecord}
            disabled={busy && !recording}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy && !recording, busy }}
            accessibilityLabel={
              mode === "photo"
                ? t("shutter.take_photo")
                : recording
                  ? t("shutter.stop_recording")
                  : t("shutter.start_recording")
            }
            style={({ pressed }) => [
              cameraStyles.shutter,
              recording ? cameraStyles.shutterRec : null,
              pressed && !(busy && !recording) ? cameraStyles.shutterPressed : null,
            ]}
          >
            {busy && !recording ? (
              <ActivityIndicator color={stage.colors.text} />
            ) : recording ? (
              <View style={cameraStyles.stopSquare} />
            ) : null}
          </Pressable>

          <View style={styles.sideBtn} />
        </View>
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  pressed: { opacity: 0.6 },

  gateBtnSecondary: { width: "100%", marginTop: t.space["3"] },

  cameraRoot: { flex: 1, backgroundColor: t.colors.bg },
  viewfinder: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: t.colors.bgAlt,
  },
  controls: {
    paddingTop: 18,
    paddingBottom: t.space["4"],
    alignItems: "center",
    backgroundColor: t.colors.bg,
  },
  shutterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 320,
  },
  sideBtn: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
}))

const cameraStyles = StyleSheet.create({
  frame: {
    position: "absolute",
    top: 60,
    left: 60,
    right: 60,
    bottom: 60,
    borderWidth: 1,
    borderColor: stage.colors.lightboxControl,
    borderStyle: "dashed",
    borderRadius: 8,
  },
  recBadge: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: stage.colors.scrimStrong,
    paddingHorizontal: 10,
    paddingVertical: space["1"],
    borderRadius: radius.pill,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: RECORDING_RED },
  recText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize["12"],
    color: stage.colors.neutral.card,
  },

  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: stage.colors.neutral.card,
    borderWidth: 4,
    borderColor: stage.colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterRec: { backgroundColor: RECORDING_RED },
  shutterPressed: { transform: [{ scale: 0.94 }] },
  stopSquare: { width: 24, height: 24, borderRadius: 5, backgroundColor: stage.colors.neutral.card },
})
