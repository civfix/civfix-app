import React from "react"
import { View, Pressable } from "react-native"
import { makeThemedStyles, useTheme, focusRingProps, webCursor } from "../theme"
import { Text } from "../typography"
import { SettingsToggle } from "./SettingsToggle"

export interface ToggleProps {
  label: string
  value: boolean
  onValueChange: (next: boolean) => void
  helper?: string
}

export function Toggle({ label, value, onValueChange, helper }: ToggleProps) {
  const styles = useStyles()
  const t = useTheme()
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onValueChange(!value)}
        focusable={false}
        {...({ tabIndex: -1 } as object)}
        {...focusRingProps}
        style={[styles.textCol, webCursor()]}
      >
        <Text variant="bodyStrong">{label}</Text>
        {helper ? (
          <Text variant="caption" style={styles.helper}>
            {helper}
          </Text>
        ) : null}
      </Pressable>
      <SettingsToggle
        value={value}
        onValueChange={onValueChange}
        onColor={t.colors.brand.bloom}
        accessibilityLabel={label}
      />
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["3"],
    minHeight: 56,
  },
  textCol: {
    flex: 1,
    marginRight: t.space["3"],
  },
  helper: {
    marginTop: 2,
    lineHeight: 16,
  },
}))
