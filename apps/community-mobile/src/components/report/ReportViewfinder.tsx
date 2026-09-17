import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { AppState, View, Pressable, StyleSheet, ActivityIndicator, Linking } from "react-native"
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
import { fontFamily, fontSize, makeThemedStyles, radius, themeFor, useTheme } from "@/theme"
import { Text, PrimaryButton } from "@civfix/ui"
import type { CameraViewfinderProps, CapturedMedia } from "@civfix/ui/capabilities"
import { useT } from "@civfix/ui/i18n"
import {
  BACKGROUNDED_PARK_GRACE_MS,
  MAX_VIDEO_SECONDS,
  OUTPUT_DETACH_DEFER_MS,
  SESSION_RESUME_GRACE_MS,
  armsResumeGrace,
  cameraSessionRunning,
  cameraSessionVeto,
  cancelsResumeGrace,
  dropsParkedRecording,
  micDeferralAction,
  parkIsStale,
  startsDeferredRecording,
  viewfinderPreviewEnabled,
  viewfinderVideoOutputEnabled,
  type AppLifecycleState,
} from "@/lib/cameraSession"
import { GPS_TIMEOUT_MS, LAST_KNOWN_MAX_AGE_MS, withTimeout } from "@/lib/withTimeout"

type CaptureMode = "photo" | "video"

export type ReportViewfinderProps = Omit<CameraViewfinderProps, "onCancel"> & {
  resumeGrace?: boolean
}

const stage = themeFor("light")

const RECORDING_RED = "#FF3B30"

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
    const last = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS })
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

  const cameraPermission = useCameraPermission()
  const mic = useMicrophonePermission()
  const device = useCameraDevice("back")

  const cameraRef = useRef<Camera>(null)
  const [mode, setMode] = useState<CaptureMode>(initialMode)
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

  const [appState, setAppState] = useState<AppLifecycleState>(
    AppState.currentState as AppLifecycleState,
  )
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) =>
      setAppState(next as AppLifecycleState),
    )
    return () => sub.remove()
  }, [])

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
        recordingBusy: recordingRef.current || pendingRecordRef.current,
      })
    ) {
      setGraceHeld(true)
      setOutputsLinger(true)
    }
  }

  const sessionInputs = {
    hostActive: active || graceHeld,
    appState,
    hasPermission: cameraPermission.hasPermission,
    hasDevice: device != null,
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

  const recordingBusy = recordingRef.current || pendingRecordRef.current
  const previewEnabled = viewfinderPreviewEnabled({
    hostActive: active || graceHeld,
    mode,
    recordingBusy,
  })
  const videoOutputEnabled = viewfinderVideoOutputEnabled({
    hostActive: active || (graceHeld && outputsLinger),
    mode,
    recordingBusy,
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
    if (recordingRef.current) {
      cameraRef.current?.stopRecording().catch(() => {})
    }
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

  const emitCapture = useCallback(
    (media: CapturedMedia) => {
      void (async () => {
        const fix = await readShutterLocation()
        try {
          if (!mountedRef.current) return
          onCaptured(
            fix ? { ...media, location: { lat: fix.lat, lng: fix.lng, source: "device" } } : media,
          )
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
        uri: photo.path.startsWith("file://") ? photo.path : `file://${photo.path}`,
        kind: "image",
        mime: "image/jpeg",
        width: photo.width,
        height: photo.height,
      })
    } catch {
      setBusy(false)
    }
  }, [busy, emitCapture])

  const beginRecording = useCallback(() => {
    if (!cameraRef.current) return
    setElapsed(0)
    setRecordingState(true)
    clearTick()
    tickRef.current = setInterval(() => {
      setElapsed((e) => Math.min(MAX_VIDEO_SECONDS, Math.round((e + 0.1) * 10) / 10))
    }, 100)
    cameraRef.current.startRecording({
      fileType: "mp4",
      videoCodec: "h264",
      onRecordingFinished: (video: VideoFile) => {
        if (!mountedRef.current) return
        setRecordingState(false)
        emitCapture({
          uri: video.path.startsWith("file://") ? video.path : `file://${video.path}`,
          kind: "video",
          mime: "video/mp4",
          width: video.width,
          height: video.height,
          durationSec: video.duration,
        })
      },
      onRecordingError: () => {
        if (!mountedRef.current) return
        setRecordingState(false)
        setBusy(false)
      },
    })

    clearHardStop()
    hardStopRef.current = setTimeout(() => {
      hardStopRef.current = null
      if (cameraRef.current && recordingRef.current) {
        cameraRef.current.stopRecording().catch(() => {})
      }
    }, MAX_VIDEO_SECONDS * 1000)
  }, [clearHardStop, clearTick, emitCapture, setRecordingState])

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
    cameraRef.current?.stopRecording().catch(() => {})
  }, [sessionRunning, clearHardStop])

  const onToggleRecord = useCallback(async () => {
    if (!cameraRef.current || busy) return

    if (recordingRef.current) {
      clearHardStop()
      setBusy(true)
      try {
        await cameraRef.current.stopRecording()
      } catch {
        setRecordingState(false)
        setBusy(false)
      }
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
  }, [audioEnabled, beginRecording, busy, clearHardStop, mic, setRecordingState])

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
      const asset = result.assets[0]!
      const isVideo = asset.type === "video"
      emitCapture({
        uri: asset.uri,
        kind: isVideo ? "video" : "image",
        mime: asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg"),
        ...(asset.width ? { width: asset.width } : {}),
        ...(asset.height ? { height: asset.height } : {}),
        ...(isVideo && asset.duration ? { durationSec: asset.duration / 1000 } : {}),
      })
    } catch {
      setBusy(false)
    }
  }, [busy, emitCapture])

  if (!cameraPermission.hasPermission || device == null) {
    const denied = !cameraPermission.hasPermission
    return (
      <View style={styles.inlineGate}>
        <View style={styles.gateIcon}>
          <Ionicons
            name={denied ? "camera-outline" : "alert-circle-outline"}
            size={30}
            color={th.colors.brand.bloom}
          />
        </View>
        <Text variant="title" style={styles.gateTitle}>
          {denied ? t("gate.camera.title") : t("gate.no_camera.title")}
        </Text>
        <Text variant="body" color={th.colors.textMuted} style={styles.gateBody}>
          {denied ? t("gate.camera.body") : t("gate.no_camera.body")}
        </Text>
        {denied ? (
          <PrimaryButton
            label={t("gate.camera.continue")}
            onPress={() => {
              void cameraPermission.requestPermission()
            }}
            style={styles.gateBtn}
          />
        ) : null}
        <PrimaryButton
          label={t("gate.choose_library")}
          variant="outline"
          onPress={onPickFromLibrary}
          style={styles.gateBtnSecondary}
        />
        {denied ? (
          <Pressable
            onPress={() => void Linking.openSettings()}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [styles.settingsLink, pressed ? styles.pressed : null]}
          >
            <Text style={styles.settingsLinkText}>{t("gate.camera.open_settings")}</Text>
          </Pressable>
        ) : null}
      </View>
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
        <View style={styles.modes}>
          <Pressable
            onPress={() => setMode("photo")}
            disabled={recording}
            accessibilityRole="button"
            accessibilityLabel={t("mode.photo")}
            accessibilityState={{ selected: mode === "photo", disabled: recording }}
            hitSlop={8}
            style={({ pressed }) => (pressed && !recording ? styles.pressed : null)}
          >
            <Text style={[styles.modeText, mode === "photo" ? styles.modeOn : null]}>
              {t("mode.photo")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("video")}
            disabled={recording}
            accessibilityRole="button"
            accessibilityLabel={t("mode.video")}
            accessibilityState={{ selected: mode === "video", disabled: recording }}
            hitSlop={8}
            style={({ pressed }) => (pressed && !recording ? styles.pressed : null)}
          >
            <Text style={[styles.modeText, mode === "video" ? styles.modeOn : null]}>
              {t("mode.video")}
            </Text>
          </Pressable>
        </View>

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

  inlineGate: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: t.space["6"],
    backgroundColor: t.colors.bg,
  },
  gateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: t.colors.bloom["50"],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: t.space["4"],
  },
  gateTitle: { marginBottom: t.space["2"], textAlign: "center" },
  gateBody: { textAlign: "center", lineHeight: 20, marginBottom: t.space["5"] },
  gateBtn: { width: "100%" },
  gateBtnSecondary: { width: "100%", marginTop: t.space["3"] },
  settingsLink: { marginTop: t.space["4"], paddingVertical: t.space["2"] },
  settingsLinkText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },

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
  modes: { flexDirection: "row", justifyContent: "center", gap: 30, marginBottom: 18 },
  modeText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["12"],
    letterSpacing: 1,
    color: t.colors.textMuted,
  },
  modeOn: { color: t.colors.accentText },
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
    paddingVertical: 4,
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
