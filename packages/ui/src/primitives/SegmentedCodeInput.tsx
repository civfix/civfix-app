import React, { useCallback, useImperativeHandle, useRef, useState } from "react"
import { View, TextInput, Pressable } from "react-native"
import { makeThemedStyles, webInputReset, focusRingProps } from "../theme"
import { Text } from "../typography"
import { useT } from "../i18n"

export interface SegmentedCodeInputHandle {
  focus: () => void
}

export interface SegmentedCodeInputProps {
  value: string
  onChangeText: (next: string) => void
  length?: number
  onComplete?: (code: string) => void
  editable?: boolean
  autoFocus?: boolean
  ref?: React.Ref<SegmentedCodeInputHandle>
}

export function SegmentedCodeInput({
  value,
  onChangeText,
  length = 6,
  onComplete,
  editable = true,
  autoFocus = true,
  ref,
}: SegmentedCodeInputProps) {
  const styles = useStyles()
  const { t } = useT("common")
  const inputRef = useRef<TextInput>(null)
  const [focused, setFocused] = useState(false)

  const focus = useCallback(() => inputRef.current?.focus(), [])

  useImperativeHandle(ref, () => ({ focus }), [focus])

  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, length)
    onChangeText(digits)
    if (digits.length === length) onComplete?.(digits)
  }

  const cells = Array.from({ length }, (_, i) => i)
  const activeIndex = Math.min(value.length, length - 1)

  return (
    <Pressable
      onPress={focus}
      accessibilityRole="button"
      accessibilityLabel={t("verification_code.label")}
      accessibilityHint={t("verification_code.hint")}
      {...focusRingProps}
      style={styles.row}
    >
      {cells.map((i) => {
        const char = value[i] ?? ""
        const isActive = focused && i === activeIndex && editable
        const isFilled = char.length > 0
        return (
          <View
            key={i}
            style={[
              styles.cell,
              isFilled ? styles.cellFilled : null,
              isActive ? styles.cellActive : null,
            ]}
          >
            <Text variant="title" style={styles.cellText}>
              {char}
            </Text>
          </View>
        )
      })}

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={editable}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        caretHidden
        style={[styles.hiddenInput, webInputReset]}
        accessibilityLabel={t("verification_code.label")}
      />
    </Pressable>
  )
}

const CELL = 48

const useStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: t.space["2"],
  },
  cell: {
    width: CELL,
    height: CELL + 8,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  cellFilled: {
    borderColor: t.colors.borderStrong,
  },
  cellActive: {
    borderColor: t.colors.brand.bloom,
    backgroundColor: t.colors.bloom["50"],
  },
  cellText: {
    fontFamily: t.fontFamily.mono,
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
}))
