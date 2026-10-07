import React from "react"
import { Linking, Pressable, View } from "react-native"
import Ionicons from "@expo/vector-icons/Ionicons"
import { Text, PrimaryButton } from "@civfix/ui"
import { makeThemedStyles, useTheme } from "@/theme"

const GATE_ICON_SIZE = 30

export interface CameraPermissionGateCopy {
  title: string
  body: string
  continueLabel: string
  openSettingsLabel: string
}

export interface CameraPermissionGateProps {
  denied: boolean
  copy: CameraPermissionGateCopy
  onRequestPermission: () => void
  secondaryAction?: React.ReactNode
}

export function CameraPermissionGate({
  denied,
  copy,
  onRequestPermission,
  secondaryAction,
}: CameraPermissionGateProps): React.JSX.Element {
  const th = useTheme()
  const styles = useStyles()

  return (
    <View style={styles.gate}>
      <View style={styles.gateIcon}>
        <Ionicons
          name={denied ? "camera-outline" : "alert-circle-outline"}
          size={GATE_ICON_SIZE}
          color={th.colors.brand.bloom}
        />
      </View>
      <Text variant="title" style={styles.gateTitle}>
        {copy.title}
      </Text>
      <Text variant="body" color={th.colors.textMuted} style={styles.gateBody}>
        {copy.body}
      </Text>
      {denied ? (
        <PrimaryButton label={copy.continueLabel} onPress={onRequestPermission} style={styles.gateBtn} />
      ) : null}
      {secondaryAction}
      {denied ? (
        <Pressable
          onPress={() => void Linking.openSettings()}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.settingsLink, pressed ? styles.pressed : null]}
        >
          <Text style={styles.settingsLinkText}>{copy.openSettingsLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  pressed: { opacity: 0.6 },
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
