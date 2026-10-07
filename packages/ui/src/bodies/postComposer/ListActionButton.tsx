import React from "react"
import { Pressable, type AccessibilityState } from "react-native"
import { focusRingProps, useLayoutMode } from "../../theme"
import { Text } from "../../typography"
import { usePostComposerStyles } from "./postComposerStyles"

const LIST_ACTION_HIT_SLOP = { left: 10, right: 10 }

export function ListActionButton({
  label,
  onPress,
  accessibilityState,
  disabled,
}: {
  label: string
  onPress: () => void
  accessibilityState: AccessibilityState
  disabled?: boolean
}) {
  const styles = usePostComposerStyles()
  const flush = useLayoutMode() === "expanded"
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      disabled={disabled}
      onPress={onPress}
      hitSlop={LIST_ACTION_HIT_SLOP}
      {...focusRingProps}
      style={({ pressed }) => [
        flush ? [styles.listAction, styles.listActionFlush] : styles.listAction,
        pressed ? styles.listActionPressed : null,
      ]}
    >
      <Text style={styles.listActionText}>{label}</Text>
    </Pressable>
  )
}
