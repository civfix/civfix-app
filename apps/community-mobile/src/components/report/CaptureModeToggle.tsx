import React from "react"
import { Pressable, View } from "react-native"
import { Text } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import type { ViewfinderCaptureMode } from "@/lib/cameraSession"
import { makeThemedStyles } from "@/theme"

const CAPTURE_MODES: readonly ViewfinderCaptureMode[] = ["photo", "video"]

const MODE_LABEL_KEYS = { photo: "mode.photo", video: "mode.video" } as const satisfies Record<
  ViewfinderCaptureMode,
  string
>

export interface CaptureModeToggleProps {
  mode: ViewfinderCaptureMode
  onChange: (mode: ViewfinderCaptureMode) => void
  disabled: boolean
}

export function CaptureModeToggle({ mode, onChange, disabled }: CaptureModeToggleProps) {
  const { t } = useT("mobile-report-camera")
  const styles = useStyles()

  return (
    <View style={styles.modes}>
      {CAPTURE_MODES.map((option) => (
        <Pressable
          key={option}
          onPress={() => onChange(option)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={t(MODE_LABEL_KEYS[option])}
          accessibilityState={{ selected: mode === option, disabled }}
          hitSlop={8}
          style={({ pressed }) => (pressed && !disabled ? styles.pressed : null)}
        >
          <Text style={[styles.modeText, mode === option ? styles.modeOn : null]}>
            {t(MODE_LABEL_KEYS[option])}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  pressed: { opacity: 0.6 },
  modes: { flexDirection: "row", justifyContent: "center", gap: 30, marginBottom: 18 },
  modeText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["12"],
    letterSpacing: 1,
    color: t.colors.textMuted,
  },
  modeOn: { color: t.colors.accentText },
}))
