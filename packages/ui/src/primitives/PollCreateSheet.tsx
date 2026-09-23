import React, { useCallback, useState } from "react"
import { View, Pressable } from "react-native"
import { TextInput } from "./TextInput"
import { makeThemedStyles, useTheme, webInputReset, focusRingProps } from "../theme"
import { Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { PrimaryButton } from "./PrimaryButton"
import { SecondaryButton } from "./SecondaryButton"
import { Toggle } from "./Toggle"
import { ModalCardSheet, modalSheetInputStyle, modalSheetInputFocusedStyle } from "./ModalCardSheet"
import { useResetOnOpen } from "./useModalClosed"
import {
  emptyPollDraft,
  setQuestion,
  setOption,
  removeOption,
  canCreatePoll,
  toCreateInput,
  POLL_QUESTION_MAX,
  POLL_OPTION_MAX,
  POLL_MIN_OPTIONS,
  type PollDraft,
} from "./pollDraft"

export interface PollCreateInput {
  question: string
  options: string[]
  allowMultiple: boolean
  anonymous: boolean
}

export interface PollCreateSheetProps {
  visible: boolean
  pending?: boolean
  error?: string | null
  onCreate: (input: PollCreateInput) => void
  onClose: () => void
}

export function PollCreateSheet({ visible, pending = false, error, onCreate, onClose }: PollCreateSheetProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("conversation-polls")
  const [draft, setDraft] = useState<PollDraft>(() => emptyPollDraft())
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [anonymous, setAnonymous] = useState(true)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  useResetOnOpen(visible, () => {
    setDraft(emptyPollDraft())
    setAllowMultiple(false)
    setAnonymous(true)
  })

  const canSubmit = !pending && canCreatePoll(draft)

  const commit = useCallback(() => {
    if (pending || !canCreatePoll(draft)) return
    const base = toCreateInput(draft)
    onCreate({ ...base, allowMultiple, anonymous })
  }, [pending, draft, allowMultiple, anonymous, onCreate])

  const removable = draft.options.length > POLL_MIN_OPTIONS

  return (
    <ModalCardSheet
      visible={visible}
      onClose={onClose}
      onCommit={commit}
      headerIcon="BarChart3"
      title={t("create_title")}
      dismissLabel={t("dismiss")}
      error={error}
      actions={
        <>
          <SecondaryButton label={t("cancel")} onPress={onClose} size="sm" />
          <PrimaryButton label={t("create")} onPress={commit} loading={pending} disabled={!canSubmit} />
        </>
      }
    >
      <TextInput
        value={draft.question}
        onChangeText={(v) => setDraft((d) => setQuestion(d, v))}
        editable={!pending}
        multiline
        maxLength={POLL_QUESTION_MAX}
        placeholder={t("question_placeholder")}
        placeholderTextColor={th.colors.textSubtle}
        accessibilityLabel={t("question_placeholder")}
        onFocus={() => setFocusedField("q")}
        onBlur={() => setFocusedField(null)}
        style={[webInputReset, styles.questionInput, focusedField === "q" ? modalSheetInputFocusedStyle(th) : null]}
      />

      <View style={styles.options}>
        {draft.options.map((opt, idx) => (
          <View key={opt.id} style={styles.optionRow}>
            <TextInput
              value={opt.text}
              onChangeText={(v) => setDraft((d) => setOption(d, idx, v))}
              editable={!pending}
              maxLength={POLL_OPTION_MAX}
              placeholder={t("option_placeholder", { index: idx + 1 })}
              placeholderTextColor={th.colors.textSubtle}
              accessibilityLabel={t("option_placeholder", { index: idx + 1 })}
              onFocus={() => setFocusedField(opt.id)}
              onBlur={() => setFocusedField(null)}
              style={[
                webInputReset,
                styles.optionInput,
                focusedField === opt.id ? modalSheetInputFocusedStyle(th) : null,
              ]}
            />
            {removable ? (
              <Pressable
                onPress={() => setDraft((d) => removeOption(d, idx))}
                disabled={pending}
                accessibilityRole="button"
                accessibilityLabel={t("remove_option", { index: idx + 1 })}
                hitSlop={6}
                {...focusRingProps}
                style={({ pressed }) => [styles.removeBtn, pressed ? styles.removeBtnPressed : null]}
              >
                <Icon icon={iconMap.Close} size={16} color={th.colors.textSubtle} />
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>

      <Toggle label={t("multiple")} value={allowMultiple} onValueChange={setAllowMultiple} />
      <Toggle label={t("anonymous")} value={anonymous} onValueChange={setAnonymous} />
    </ModalCardSheet>
  )
}

const useStyles = makeThemedStyles((t) => ({
  questionInput: {
    ...modalSheetInputStyle(t),
    minHeight: 48,
    maxHeight: 140,
    textAlignVertical: "top",
  },
  options: {
    gap: t.space["2"],
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  optionInput: {
    ...modalSheetInputStyle(t),
    flex: 1,
    minHeight: 44,
  },
  removeBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
  },
  removeBtnPressed: {
    opacity: 0.6,
  },
}))
