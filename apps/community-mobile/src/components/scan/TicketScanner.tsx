import React, { useCallback, useEffect, useRef, useState } from "react"
import { AppState, Linking, Pressable, StyleSheet, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from "react-native-vision-camera"
import { Text, PrimaryButton } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { makeThemedStyles, radius, themeFor, useTheme } from "@/theme"
import {
  acceptsScannedCode,
  cameraSessionRunning,
  firstCodeValue,
  type AppLifecycleState,
} from "@/lib/cameraSession"

export interface TicketScannerProps {
  active: boolean
  onScanned: (token: string) => void
}

export function TicketScanner({ active, onScanned }: TicketScannerProps): React.JSX.Element {
  const { t } = useT("mobile-system")
  const th = useTheme()
  const styles = useStyles()

  const permission = useCameraPermission()
  const device = useCameraDevice("back")

  const [appState, setAppState] = useState<AppLifecycleState>(
    AppState.currentState as AppLifecycleState,
  )
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) =>
      setAppState(next as AppLifecycleState),
    )
    return () => sub.remove()
  }, [])

  const lastScanRef = useRef<{ value: string | null; at: number }>({ value: null, at: 0 })
  const onScannedRef = useRef(onScanned)
  onScannedRef.current = onScanned

  const codeScanner = useCodeScanner({
    codeTypes: ["qr"],
    onCodeScanned: (codes) => {
      const value = firstCodeValue(codes)
      if (!value) return
      const now = Date.now()
      const last = lastScanRef.current
      if (!acceptsScannedCode({ value, lastValue: last.value, lastAt: last.at, now })) return
      lastScanRef.current = { value, at: now }
      onScannedRef.current(value)
    },
  })

  const requestPermission = useCallback(() => {
    void permission.requestPermission()
  }, [permission])

  if (!permission.hasPermission || device == null) {
    const denied = !permission.hasPermission
    return (
      <View style={styles.gate}>
        <View style={styles.gateIcon}>
          <Ionicons
            name={denied ? "camera-outline" : "alert-circle-outline"}
            size={30}
            color={th.colors.brand.bloom}
          />
        </View>
        <Text variant="title" style={styles.gateTitle}>
          {denied ? t("scan.gate.title") : t("scan.gate.no_camera_title")}
        </Text>
        <Text variant="body" color={th.colors.textMuted} style={styles.gateBody}>
          {denied ? t("scan.gate.body") : t("scan.gate.no_camera_body")}
        </Text>
        {denied ? (
          <>
            <PrimaryButton
              label={t("scan.gate.continue")}
              onPress={requestPermission}
              style={styles.gateBtn}
            />
            <Pressable
              onPress={() => void Linking.openSettings()}
              accessibilityRole="button"
              hitSlop={8}
              style={({ pressed }) => [styles.settingsLink, pressed ? styles.pressed : null]}
            >
              <Text style={styles.settingsLinkText}>{t("scan.gate.open_settings")}</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    )
  }

  const sessionRunning = cameraSessionRunning({
    hostActive: active,
    appState,
    hasPermission: permission.hasPermission,
    hasDevice: device != null,
  })

  return (
    <View style={styles.root}>
      <View style={styles.viewfinder}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={sessionRunning}
          codeScanner={codeScanner}
          outputOrientation="preview"
        />
        <View style={scannerStyles.frame} pointerEvents="none" />
      </View>
      <View style={styles.hintRow}>
        <Text variant="body" color={th.colors.textMuted} style={styles.hint}>
          {t("scan.hint")}
        </Text>
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  pressed: { opacity: 0.6 },
  root: { flex: 1, backgroundColor: t.colors.bg },
  viewfinder: { flex: 1, overflow: "hidden", backgroundColor: t.colors.bgAlt },
  hintRow: {
    paddingHorizontal: t.space["6"],
    paddingTop: t.space["4"],
    paddingBottom: t.space["4"],
    backgroundColor: t.colors.bg,
  },
  hint: { textAlign: "center", lineHeight: 20 },
  gate: {
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
  settingsLink: { marginTop: t.space["4"], paddingVertical: t.space["2"] },
  settingsLinkText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
}))

const stage = themeFor("light")

const scannerStyles = StyleSheet.create({
  frame: {
    position: "absolute",
    top: "22%",
    left: 48,
    right: 48,
    bottom: "22%",
    borderWidth: 2,
    borderColor: stage.colors.onScrim,
    borderRadius: radius.lg,
  },
})
