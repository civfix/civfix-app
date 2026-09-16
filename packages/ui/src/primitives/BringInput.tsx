import React, { useState } from "react"
import { View, Pressable, StyleSheet, Platform, type ViewStyle } from "react-native"
import { TextInput } from "./TextInput"
import { tokens } from "@civfix/shared/tokens"
import {
  makeThemedStyles,
  useTheme,
  webInputReset,
  focusRingProps,
  webCursorPointer,
  webTransition,
  webHover,
} from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"

const SUGGESTION_KEYS = [
  "work_gloves",
  "water_bottle",
  "hat_sunscreen",
  "sturdy_shoes",
  "trash_grabber",
  "reusable_bags",
] as const

export interface BringInputProps {
  value: string[]
  onChange: (next: string[]) => void
}

export function BringInput({ value, onChange }: BringInputProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-bring")
  const [draft, setDraft] = useState("")
  const [focused, setFocused] = useState(false)

  const add = (raw: string) => {
    const item = raw.trim()
    if (item.length === 0) return
    const exists = value.some((v) => v.toLowerCase() === item.toLowerCase())
    if (!exists) onChange([...value, item])
    setDraft("")
  }

  const remove = (item: string) => {
    onChange(value.filter((v) => v !== item))
  }

  const remaining = SUGGESTION_KEYS.map((key) => t(`suggestions.${key}`)).filter(
    (s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()),
  )

  return (
    <View>
      <View style={[styles.inputRow, focused ? styles.inputRowFocused : null]}>
        <Icon icon={iconMap.ShoppingBag} size={18} color={th.colors.textSubtle} />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => add(draft)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={t("input.a11y_label")}
          placeholder={t("input.placeholder")}
          placeholderTextColor={th.colors.textSubtle}
          selectionColor={th.colors.brand.bloom}
          returnKeyType="done"
          blurOnSubmit={false}
          style={[styles.input, webInputReset]}
        />
        {draft.trim().length > 0 ? (
          <Pressable
            onPress={() => add(draft)}
            accessibilityRole="button"
            accessibilityLabel={t("input.add_a11y")}
            hitSlop={8}
            {...focusRingProps}
            style={(state) => [
              styles.addBtn,
              webCursorPointer,
              webTransition,
              webHover(state) ? styles.addBtnHovered : null,
              state.pressed ? styles.pressed : null,
            ]}
          >
            <Icon icon={iconMap.Plus} size={18} color={th.colors.onAccent} />
          </Pressable>
        ) : null}
      </View>

      {value.length > 0 ? (
        <View style={styles.chips}>
          {value.map((item) => (
            <Pressable
              key={item}
              onPress={() => remove(item)}
              accessibilityRole="button"
              accessibilityLabel={t("chip.remove_a11y", { item })}
              hitSlop={8}
              {...focusRingProps}
              style={(state) => [
                styles.chip,
                webCursorPointer,
                webTransition,
                webHover(state) ? styles.chipHovered : null,
                state.pressed ? styles.pressed : null,
              ]}
            >
              <Text
                variant="caption"
                color={th.colors.moss["700"]}
                style={styles.chipText}
                numberOfLines={1}
              >
                {item}
              </Text>
              <Icon icon={iconMap.Close} size={13} color={th.colors.moss["600"]} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {remaining.length > 0 ? (
        <View style={styles.suggestBlock}>
          <Text variant="caption" color={th.colors.textSubtle} style={styles.suggestLabel}>
            {t("suggestions.label")}
          </Text>
          <View style={styles.chips}>
            {remaining.map((s) => (
              <Pressable
                key={s}
                onPress={() => add(s)}
                accessibilityRole="button"
                accessibilityLabel={t("suggestions.add_a11y", { item: s })}
                hitSlop={8}
                {...focusRingProps}
                style={(state) => [
                  styles.suggestPill,
                  webCursorPointer,
                  webTransition,
                  webHover(state) ? styles.suggestPillHovered : null,
                  state.pressed ? styles.pressed : null,
                ]}
              >
                <Icon icon={iconMap.Plus} size={13} color={th.colors.textMuted} />
                <Text variant="caption" color={th.colors.textMuted} style={styles.suggestText}>
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    paddingHorizontal: t.space["4"],
    minHeight: 52,
  },
  inputRowFocused:
    Platform.OS === "web"
      ? ({ boxShadow: tokens.shadow.ring, borderColor: t.colors.accent } as ViewStyle)
      : { borderColor: t.colors.accent },
  input: {
    flex: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["16"],
    color: t.colors.text,
    paddingVertical: t.space["3"],
  },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: t.colors.brand.bloom,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnHovered: {
    backgroundColor: t.colors.bloom["700"],
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.space["2"],
    marginTop: t.space["3"],
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: "100%",
    paddingLeft: t.space["3"],
    paddingRight: t.space["2"],
    paddingVertical: 6,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.moss["50"],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.moss["100"],
  },
  chipHovered: {
    backgroundColor: t.colors.moss["100"],
  },
  chipText: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
  },
  suggestBlock: {
    marginTop: t.space["4"],
  },
  suggestLabel: {
    fontFamily: t.fontFamily.bodyMedium,
    marginBottom: 2,
  },
  suggestPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: t.space["3"],
    paddingVertical: 6,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  suggestPillHovered: {
    backgroundColor: t.colors.surfaceTint,
    borderColor: t.colors.borderStrong,
  },
  suggestText: {
    fontFamily: t.fontFamily.bodyMedium,
  },
  pressed: {
    opacity: 0.7,
  },
}))
