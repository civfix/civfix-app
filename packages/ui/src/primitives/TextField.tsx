import React, { useId, useState } from "react"
import {
  View,
  TextInput,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { makeThemedStyles, useTheme, webInputReset } from "../theme"
import { Text } from "../typography"

export interface TextFieldProps extends Omit<TextInputProps, "style"> {
  label?: string
  helper?: string
  multiline?: boolean
  containerStyle?: StyleProp<ViewStyle>
}

export function TextField({
  label,
  helper,
  multiline = false,
  containerStyle,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const styles = useStyles()
  const t = useTheme()
  const [focused, setFocused] = useState(false)
  const labelId = useId()

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text variant="label" style={styles.label} nativeID={labelId}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          multiline ? styles.fieldMultiline : null,
          focused ? styles.fieldFocused : null,
        ]}
      >
        <TextInput
          {...rest}
          multiline={multiline}
          accessibilityLabelledBy={label ? labelId : undefined}
          placeholderTextColor={t.colors.textSubtle}
          selectionColor={t.colors.brand.bloom}
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          style={[styles.input, multiline ? styles.inputMultiline : null, webInputReset]}
        />
      </View>
      {helper ? (
        <Text variant="caption" style={styles.helper}>
          {helper}
        </Text>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  container: {
    width: "100%",
  },
  label: {
    marginBottom: t.space["2"],
    fontFamily: t.fontFamily.bodySemiBold,
    color: t.colors.textMuted,
  },
  field: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    paddingHorizontal: t.space["4"],
    minHeight: 52,
    justifyContent: "center",
  },
  fieldMultiline: {
    minHeight: 110,
    paddingVertical: t.space["3"],
  },
  fieldFocused: {
    borderColor: t.colors.brand.bloom,
  },
  input: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["16"],
    color: t.colors.text,
    paddingVertical: t.space["3"],
  },
  inputMultiline: {
    minHeight: 84,
    textAlignVertical: "top",
  },
  helper: {
    marginTop: t.space["2"],
    lineHeight: 16,
  },
}))
