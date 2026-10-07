import React, { useCallback, useState } from "react"
import { MAX_EVENT_RESOURCES_MESSAGE } from "@civfix/shared"
import { TextInput } from "./TextInput"
import { makeThemedStyles, useTheme, webInputReset, inputFocusedStyle } from "../theme"
import { Text } from "../typography"
import { useT } from "../i18n"
import { PrimaryButton } from "./PrimaryButton"
import { SecondaryButton } from "./SecondaryButton"
import { ModalCardSheet, modalSheetInputStyle } from "./ModalCardSheet"
import { useResetOnOpen } from "./useModalClosed"

export interface RequestResourcesSheetProps {
  visible: boolean
  pending?: boolean
  error?: string | null
  cityName?: string | null
  onSubmit: (message: string) => void
  onClose: () => void
}

export function RequestResourcesSheet({
  visible,
  pending = false,
  error,
  cityName,
  onSubmit,
  onClose,
}: RequestResourcesSheetProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-resources")
  const [message, setMessage] = useState("")
  const [focused, setFocused] = useState(false)

  useResetOnOpen(visible, () => {
    setMessage("")
    setFocused(false)
  })

  const canSubmit = !pending && message.trim().length > 0

  const commit = useCallback(() => {
    if (!canSubmit) return
    onSubmit(message.trim())
  }, [canSubmit, message, onSubmit])

  return (
    <ModalCardSheet
      visible={visible}
      onClose={onClose}
      onCommit={commit}
      headerIcon="Building2"
      headerIconColor={th.colors.sky["700"]}
      title={t("title")}
      dismissLabel={t("dismiss_a11y")}
      error={error}
      actions={
        <>
          <SecondaryButton label={t("cancel")} onPress={onClose} size="sm" />
          <PrimaryButton label={t("submit")} onPress={commit} loading={pending} disabled={!canSubmit} />
        </>
      }
    >
      <Text variant="caption" color={th.colors.textSubtle}>
        {t("caption", { city: cityName ?? t("city_fallback") })}
      </Text>

      <TextInput
        value={message}
        onChangeText={(next) => setMessage(next.slice(0, MAX_EVENT_RESOURCES_MESSAGE))}
        editable={!pending}
        multiline
        maxLength={MAX_EVENT_RESOURCES_MESSAGE}
        placeholder={t("message_placeholder")}
        placeholderTextColor={th.colors.textSubtle}
        accessibilityLabel={t("message_a11y")}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[webInputReset, styles.input, focused ? inputFocusedStyle(th) : null]}
      />
    </ModalCardSheet>
  )
}

const useStyles = makeThemedStyles((t) => ({
  input: {
    ...modalSheetInputStyle(t),
    minHeight: 96,
    maxHeight: 240,
    textAlignVertical: "top",
  },
}))
