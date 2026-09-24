import React from "react"
import { View } from "react-native"
import { TextInput } from "../../../primitives/TextInput"
import { SecondaryButton } from "../../../primitives"
import { MIN_TOUCH_TARGET, makeThemedStyles, useTheme, webInputReset, inputFocusedStyle } from "../../../theme"
import { Text } from "../../../typography"
import { useT } from "../../../i18n"
import { TICKET_TOKEN_MAX } from "@civfix/shared"
import { ticketCodeReady } from "@civfix/shared/host"

export interface ManualCodeEntryProps {
  code: string
  onChangeCode: (next: string) => void
  onSubmit: () => void
  busy: boolean
  focused: boolean
  onFocusChange: (focused: boolean) => void
}

export function ManualCodeEntry({
  code,
  onChangeCode,
  onSubmit,
  busy,
  focused,
  onFocusChange,
}: ManualCodeEntryProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-checkin")
  return (
    <View style={styles.manual}>
      <Text style={styles.manualLabel}>{t("manual.label")}</Text>
      <TextInput
        value={code}
        onChangeText={onChangeCode}
        editable={!busy}
        maxLength={TICKET_TOKEN_MAX}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder={t("manual.placeholder")}
        placeholderTextColor={th.colors.textSubtle}
        accessibilityLabel={t("manual.label")}
        onSubmitEditing={onSubmit}
        onFocus={() => onFocusChange(true)}
        onBlur={() => onFocusChange(false)}
        style={[webInputReset, styles.input, focused ? inputFocusedStyle(th) : null]}
      />
      <SecondaryButton
        label={t("manual.submit")}
        onPress={onSubmit}
        disabled={busy || !ticketCodeReady(code)}
      />
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  manual: {
    gap: t.space["2"],
  },
  manualLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.text,
  },
  input: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["15"],
    letterSpacing: 1,
    color: t.colors.text,
  },
}))
