import React from "react"
import { View } from "react-native"
import { makeThemedStyles, MIN_TOUCH_TARGET, useTheme, webInputReset } from "../../theme"
import { Text } from "../../typography"
import { fieldFocusedStyle } from "../../primitives"
import { TextInput } from "../../primitives/TextInput"
import { useT } from "../../i18n"
import { counterVisible } from "./orgManageModel"

const MULTILINE_MIN_HEIGHT = 110

export interface OrgFieldProps {
  id: string
  value: string
  onChange: (next: string) => void
  label: string
  max: number
  editable: boolean
  focused: boolean
  onFocusChange: (id: string | null) => void
  error?: string | undefined
  hint?: string | undefined
  multiline?: boolean
  prefix?: string | undefined
  placeholder?: string | undefined
}

export function OrgField({
  id,
  value,
  onChange,
  label,
  max,
  editable,
  focused,
  onFocusChange,
  error,
  hint,
  multiline = false,
  prefix,
  placeholder,
}: OrgFieldProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-org")

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {counterVisible(value.length, max) ? (
          <Text variant="caption">{t("manage.counter", { used: value.length, max })}</Text>
        ) : null}
      </View>
      <View style={styles.inputRow}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={(next) => onChange(next.slice(0, max))}
          editable={editable}
          maxLength={max}
          multiline={multiline}
          autoCapitalize={prefix ? "none" : "sentences"}
          autoCorrect={!prefix}
          accessibilityLabel={label}
          {...(placeholder ? { placeholder } : {})}
          placeholderTextColor={th.colors.textSubtle}
          onFocus={() => onFocusChange(id)}
          onBlur={() => onFocusChange(null)}
          style={[
            webInputReset,
            styles.input,
            multiline ? styles.inputMultiline : null,
            focused ? fieldFocusedStyle(th) : null,
            error ? styles.inputInvalid : null,
          ]}
        />
      </View>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption">{hint}</Text>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  field: {
    gap: t.space["1"],
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: t.space["2"],
  },
  label: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.text,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  prefix: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  input: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["2"],
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  inputMultiline: {
    minHeight: MULTILINE_MIN_HEIGHT,
    textAlignVertical: "top",
  },
  inputInvalid: {
    borderColor: t.colors.dangerInk,
  },
  error: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.dangerInk,
  },
}))
