import React, { useCallback, useState } from "react"
import { MAX_EVENT_CANCEL_REASON } from "@civfix/shared"
import { TextInput } from "./TextInput"
import { makeThemedStyles, useTheme, webInputReset, inputFocusedStyle } from "../theme"
import { Text } from "../typography"
import { PrimaryButton } from "./PrimaryButton"
import { SecondaryButton } from "./SecondaryButton"
import { ModalCardSheet, modalSheetInputStyle } from "./ModalCardSheet"
import { useT } from "../i18n"
import { useResetOnOpen } from "./useModalClosed"

export interface CancelEventSheetProps {
  visible: boolean
  pending?: boolean
  error?: string | null
  onConfirm: (reason?: string) => void
  onClose: () => void
}

export function CancelEventSheet({
  visible,
  pending = false,
  error,
  onConfirm,
  onClose,
}: CancelEventSheetProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-cancel")
  const [reason, setReason] = useState("")
  const [focused, setFocused] = useState(false)

  useResetOnOpen(visible, () => {
    setReason("")
    setFocused(false)
  })

  const commit = useCallback(() => {
    if (pending) return
    const trimmed = reason.trim()
    onConfirm(trimmed.length > 0 ? trimmed : undefined)
  }, [pending, reason, onConfirm])

  return (
    <ModalCardSheet
      visible={visible}
      onClose={onClose}
      onCommit={commit}
      headerIcon="Ban"
      headerIconColor={th.colors.dangerInk}
      title={t("title")}
      dismissLabel={t("a11y.dismiss")}
      error={error}
      actions={
        <>
          <SecondaryButton label={t("actions.keep")} onPress={onClose} size="sm" />
          <PrimaryButton
            label={t("actions.confirm")}
            variant="destructive"
            onPress={commit}
            loading={pending}
            disabled={pending}
          />
        </>
      }
    >
      <Text variant="caption" color={th.colors.textSubtle}>
        {t("caption")}
      </Text>

      <TextInput
        value={reason}
        onChangeText={(next) => setReason(next.slice(0, MAX_EVENT_CANCEL_REASON))}
        editable={!pending}
        multiline
        maxLength={MAX_EVENT_CANCEL_REASON}
        placeholder={t("reason.placeholder")}
        placeholderTextColor={th.colors.textSubtle}
        accessibilityLabel={t("reason.a11y")}
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
    minHeight: 72,
    maxHeight: 200,
    textAlignVertical: "top",
  },
}))
