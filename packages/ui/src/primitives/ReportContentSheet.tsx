import React, { useCallback, useState } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import { TextInput } from "./TextInput"
import type { ContentReportReason } from "@civfix/shared"
import { a11yState, makeThemedStyles, useTheme, webInputReset, focusRingProps, inputFocusedStyle } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { PrimaryButton } from "./PrimaryButton"
import { SecondaryButton } from "./SecondaryButton"
import { ModalCardSheet, modalSheetInputStyle } from "./ModalCardSheet"
import { useResetOnOpen } from "./useModalClosed"

const REASON_VALUES: ReadonlyArray<ContentReportReason> = [
  "spam",
  "harassment",
  "hate",
  "sexual",
  "violence",
  "misinformation",
  "self_harm",
  "other",
]

const DETAILS_MAX = 1000

export interface ReportContentSheetProps {
  visible: boolean
  subjectLabel: string
  pending?: boolean
  error?: string | null
  onSubmit: (reason: ContentReportReason, details?: string) => void
  onClose: () => void
  onClosed?: () => void
}

export function ReportContentSheet({
  visible,
  subjectLabel,
  pending = false,
  error,
  onSubmit,
  onClose,
  onClosed,
}: ReportContentSheetProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-content")
  const [reason, setReason] = useState<ContentReportReason | null>(null)
  const [details, setDetails] = useState("")
  const [focused, setFocused] = useState(false)

  useResetOnOpen(visible, () => {
    setReason(null)
    setDetails("")
    setFocused(false)
  })

  const canSubmit = !pending && reason != null

  const commit = useCallback(() => {
    if (!canSubmit || reason == null) return
    const trimmed = details.trim()
    onSubmit(reason, trimmed.length > 0 ? trimmed : undefined)
  }, [canSubmit, reason, details, onSubmit])

  return (
    <ModalCardSheet
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      onCommit={commit}
      headerIcon="Flag"
      title={t("title", { subject: subjectLabel })}
      dismissLabel={t("backdrop.dismiss")}
      error={error}
      actions={
        <>
          <SecondaryButton label={t("actions.cancel")} onPress={onClose} size="sm" />
          <PrimaryButton label={t("actions.submit")} onPress={commit} loading={pending} disabled={!canSubmit} />
        </>
      }
    >
      <Text variant="caption" color={th.colors.textSubtle}>
        {t("prompt")}
      </Text>

      <View style={styles.reasons} accessibilityRole="radiogroup" accessibilityLabel={t("prompt")}>
        {REASON_VALUES.map((value) => {
          const selected = reason === value
          const label = t(`reason.${value}`)
          return (
            <Pressable
              key={value}
              {...focusRingProps}
              style={({ pressed }) => [
                styles.reasonRow,
                selected ? styles.reasonRowSelected : null,
                pressed ? styles.reasonRowPressed : null,
              ]}
              accessibilityRole="radio"
              accessibilityLabel={label}
              {...a11yState({ checked: selected })}
              disabled={pending}
              onPress={() => setReason(value)}
            >
              <Text
                variant={selected ? "bodyStrong" : "body"}
                color={selected ? th.colors.text : th.colors.textMuted}
                style={styles.reasonLabel}
              >
                {label}
              </Text>
              {selected ? <Icon icon={iconMap.Check} size={16} color={th.colors.accent} /> : null}
            </Pressable>
          )
        })}
      </View>

      <TextInput
        value={details}
        onChangeText={(next) => setDetails(next.slice(0, DETAILS_MAX))}
        editable={!pending}
        multiline
        maxLength={DETAILS_MAX}
        placeholder={t("details.placeholder")}
        placeholderTextColor={th.colors.textSubtle}
        accessibilityLabel={t("details.a11y")}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[webInputReset, styles.input, focused ? inputFocusedStyle(th) : null]}
      />
    </ModalCardSheet>
  )
}

const useStyles = makeThemedStyles((t) => ({
  reasons: {
    gap: t.space["1"],
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["2"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surfaceTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  reasonRowSelected: {
    borderColor: t.colors.accent,
  },
  reasonRowPressed: {
    opacity: 0.6,
  },
  reasonLabel: {
    flex: 1,
  },
  input: {
    ...modalSheetInputStyle(t),
    minHeight: 72,
    maxHeight: 200,
    textAlignVertical: "top",
  },
}))
