import React, { useState } from "react"
import { View, Pressable } from "react-native"
import { TextInput } from "../../../primitives/TextInput"
import type { EventAnswerValue, EventQuestionDTO } from "@civfix/shared"
import { MAX_LONG_TEXT_ANSWER, MAX_SHORT_TEXT_ANSWER } from "@civfix/shared"
import {
  focusRingProps,
  makeThemedStyles,
  useTheme,
  webCursor,
  webHover,
  webInputReset,
  webTransition,
} from "../../../theme"
import { Text, Icon, iconMap } from "../../../typography"
import { useT } from "../../../i18n"
import { modalSheetInputFocusedStyle as fieldFocusedStyle } from "../../../primitives/ModalCardSheet"
import { type AnswerMap, toggleMultiSelect } from "./questionModel"

export interface RegistrationQuestionsProps {
  questions: readonly EventQuestionDTO[]
  answers: AnswerMap
  onChange: (questionId: string, value: EventAnswerValue) => void
  invalid?: ReadonlySet<string>
  disabled?: boolean
}

function CheckRow({
  label,
  checked,
  onToggle,
  disabled,
  a11yLabel,
}: {
  label: string
  checked: boolean
  onToggle: () => void
  disabled: boolean
  a11yLabel: string
}) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <Pressable
      onPress={disabled ? undefined : onToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={a11yLabel}
      {...focusRingProps}
      style={(state) => [
        styles.checkRow,
        webTransition,
        webCursor(disabled),
        webHover(state) && !disabled ? styles.checkRowHovered : null,
      ]}
    >
      <View style={[styles.box, checked ? styles.boxChecked : null]}>
        {checked ? <Icon icon={iconMap.Check} size={13} color={th.colors.onAccent} /> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  )
}

export function RegistrationQuestions({
  questions,
  answers,
  onChange,
  invalid,
  disabled = false,
}: RegistrationQuestionsProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-ticket")
  const [focusedId, setFocusedId] = useState<string | null>(null)

  if (questions.length === 0) return null

  return (
    <View style={styles.list}>
      {questions.map((question) => {
        const value = answers[question.id]
        const isInvalid = invalid?.has(question.id) ?? false
        return (
          <View key={question.id} style={styles.field}>
            {question.kind === "consent" ? null : (
              <Text style={styles.prompt}>
                {question.prompt}
                {question.required ? <Text style={styles.required}> *</Text> : null}
              </Text>
            )}
            {question.helpText ? <Text style={styles.help}>{question.helpText}</Text> : null}

            {question.kind === "short_text" || question.kind === "long_text" ? (
              <TextInput
                value={typeof value === "string" ? value : ""}
                onChangeText={(next) => onChange(question.id, next)}
                editable={!disabled}
                multiline={question.kind === "long_text"}
                maxLength={
                  question.kind === "long_text" ? MAX_LONG_TEXT_ANSWER : MAX_SHORT_TEXT_ANSWER
                }
                placeholder={t("questions.text_placeholder")}
                placeholderTextColor={th.colors.textSubtle}
                accessibilityLabel={question.prompt}
                onFocus={() => setFocusedId(question.id)}
                onBlur={() => setFocusedId((prev) => (prev === question.id ? null : prev))}
                style={[
                  webInputReset,
                  styles.input,
                  question.kind === "long_text" ? styles.inputMultiline : null,
                  focusedId === question.id ? fieldFocusedStyle(th) : null,
                  isInvalid ? styles.inputInvalid : null,
                ]}
              />
            ) : null}

            {question.kind === "single_select" ? (
              <View
                style={styles.options}
                accessibilityRole="radiogroup"
                accessibilityLabel={question.prompt}
              >
                {question.options.map((option) => {
                  const selected = value === option.value
                  return (
                    <Pressable
                      key={option.value}
                      onPress={disabled ? undefined : () => onChange(question.id, option.value)}
                      disabled={disabled}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, disabled }}
                      accessibilityLabel={option.label}
                      {...focusRingProps}
                      style={(state) => [
                        styles.option,
                        webTransition,
                        webCursor(disabled),
                        selected ? styles.optionSelected : null,
                        webHover(state) && !disabled ? styles.optionHovered : null,
                      ]}
                    >
                      <Icon
                        icon={selected ? iconMap.CircleDot : iconMap.Circle}
                        size={16}
                        color={selected ? th.colors.brand.bloom : th.colors.textSubtle}
                      />
                      <Text style={styles.optionLabel}>{option.label}</Text>
                    </Pressable>
                  )
                })}
              </View>
            ) : null}

            {question.kind === "multi_select" ? (
              <View style={styles.options}>
                {question.options.map((option) => (
                  <CheckRow
                    key={option.value}
                    label={option.label}
                    checked={Array.isArray(value) && value.includes(option.value)}
                    disabled={disabled}
                    a11yLabel={option.label}
                    onToggle={() => onChange(question.id, toggleMultiSelect(value, option.value))}
                  />
                ))}
              </View>
            ) : null}

            {question.kind === "checkbox" || question.kind === "consent" ? (
              <CheckRow
                label={question.kind === "consent" ? (question.consentText ?? question.prompt) : question.prompt}
                checked={value === true}
                disabled={disabled}
                a11yLabel={question.prompt}
                onToggle={() => onChange(question.id, value !== true)}
              />
            ) : null}

            {isInvalid ? (
              <Text style={styles.error} accessibilityRole="alert">
                {t("questions.required_error")}
              </Text>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  list: {
    gap: t.space["4"],
  },
  field: {
    gap: t.space["2"],
  },
  prompt: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  required: {
    color: t.colors.bloom["700"],
  },
  help: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  input: {
    minHeight: 42,
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
    minHeight: 84,
    textAlignVertical: "top",
  },
  inputInvalid: {
    borderColor: t.colors.bloom["700"],
  },
  options: {
    gap: t.space["1"],
  },
  option: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    paddingHorizontal: t.space["2"],
    borderRadius: t.radius.md,
  },
  optionSelected: {
    backgroundColor: t.colors.bgAlt,
  },
  optionHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  optionLabel: {
    flex: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  checkRow: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: t.space["2"],
    paddingVertical: t.space["1"],
    paddingHorizontal: t.space["2"],
    borderRadius: t.radius.md,
  },
  checkRowHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  box: {
    width: 20,
    height: 20,
    marginTop: 1,
    borderRadius: t.radius.xs,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: {
    backgroundColor: t.colors.brand.bloom,
    borderColor: t.colors.brand.bloom,
  },
  checkLabel: {
    flex: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    lineHeight: 19,
    color: t.colors.text,
  },
  error: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.bloom["700"],
  },
}))
