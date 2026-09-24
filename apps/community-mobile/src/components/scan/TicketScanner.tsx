import React, { useCallback, useRef } from "react"
import { StyleSheet, View } from "react-native"
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from "react-native-vision-camera"
import { Text } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { CAMERA_CHROME_THEME, makeThemedStyles, radius, useTheme } from "@/theme"
import { acceptsScannedCode, cameraSessionRunning, firstCodeValue } from "@/lib/cameraSession"
import { useAppLifecycleState } from "@/hooks/useAppLifecycleState"
import { CameraPermissionGate } from "@/components/camera/CameraPermissionGate"

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

  const appState = useAppLifecycleState()

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
      <CameraPermissionGate
        denied={denied}
        copy={{
          title: denied ? t("scan.gate.title") : t("scan.gate.no_camera_title"),
          body: denied ? t("scan.gate.body") : t("scan.gate.no_camera_body"),
          continueLabel: t("scan.gate.continue"),
          openSettingsLabel: t("scan.gate.open_settings"),
        }}
        onRequestPermission={requestPermission}
      />
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
  root: { flex: 1, backgroundColor: t.colors.bg },
  viewfinder: { flex: 1, overflow: "hidden", backgroundColor: t.colors.bgAlt },
  hintRow: {
    paddingHorizontal: t.space["6"],
    paddingTop: t.space["4"],
    paddingBottom: t.space["4"],
    backgroundColor: t.colors.bg,
  },
  hint: { textAlign: "center", lineHeight: 20 },
}))

const scannerStyles = StyleSheet.create({
  frame: {
    position: "absolute",
    top: "22%",
    left: 48,
    right: 48,
    bottom: "22%",
    borderWidth: 2,
    borderColor: CAMERA_CHROME_THEME.colors.onScrim,
    borderRadius: radius.lg,
  },
})
