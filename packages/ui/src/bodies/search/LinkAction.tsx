import React from "react"
import { Pressable } from "react-native"
import { focusRingProps, webHover, webTransition } from "../../theme"
import { Text } from "../../typography"
import { useSearchStyles } from "./searchStyles"

export function LinkAction({
  label,
  a11yLabel,
  onPress,
}: {
  label: string
  a11yLabel: string
  onPress: () => void
}) {
  const styles = useSearchStyles()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      onPress={onPress}
      {...focusRingProps}
      style={(state) => [styles.clear, webTransition, state.pressed ? styles.pressed : null]}
    >
      {(state) => (
        <Text
          style={[
            styles.clearLabel,
            webHover(state) ? styles.linkHovered : null,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  )
}
