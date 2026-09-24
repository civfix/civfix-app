import React, { useState } from "react"
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { tokens } from "@civfix/shared/tokens"
import { focusRingProps, makeThemedStyles, useTheme, webInputReset, MIN_TOUCH_TARGET } from "../theme"
import { Icon, iconMap } from "../typography"
import { TextInput } from "./TextInput"
import type { TextInputProps } from "./TextInput.types"

const CLEAR_BTN_SIZE = 22
const CLEAR_BTN_HIT_SLOP = (MIN_TOUCH_TARGET - CLEAR_BTN_SIZE) / 2

/**
 * `box` makes the clear control a real 44pt box, the only target rn-web honours since it drops hitSlop;
 * `slop` keeps the 22pt chip as the target and grows it with hitSlop, which reaches 44pt on native only.
 */
export type ListSearchClearTarget = "box" | "slop"

export interface ListSearchFieldProps {
  value: string
  onChangeText: (query: string) => void
  placeholder: string
  a11yLabel: string
  clearA11yLabel: string
  autoCapitalize?: TextInputProps["autoCapitalize"]
  clearTarget?: ListSearchClearTarget
  style?: StyleProp<ViewStyle>
}

export function ListSearchField({
  value,
  onChangeText,
  placeholder,
  a11yLabel,
  clearA11yLabel,
  autoCapitalize,
  clearTarget = "box",
  style,
}: ListSearchFieldProps) {
  const styles = useStyles()
  const th = useTheme()
  const [focused, setFocused] = useState(false)
  const clearIcon = <Icon icon={iconMap.Close} size={14} color={th.colors.textSubtle} />
  return (
    <View style={[styles.searchField, focused ? styles.searchFieldFocused : null, style]}>
      <Icon icon={iconMap.Search} size={16} color={th.colors.textSubtle} />
      <TextInput
        style={[styles.searchInput, webInputReset]}
        placeholder={placeholder}
        placeholderTextColor={th.colors.textSubtle}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={a11yLabel}
      />
      {!value ? null : clearTarget === "box" ? (
        <Pressable
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel={clearA11yLabel}
          {...focusRingProps}
          style={styles.clearTarget}
        >
          {({ pressed }) => (
            <View style={[styles.clearBtn, pressed ? styles.clearBtnPressed : null]}>{clearIcon}</View>
          )}
        </Pressable>
      ) : (
        <Pressable
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel={clearA11yLabel}
          hitSlop={CLEAR_BTN_HIT_SLOP}
          {...focusRingProps}
          style={({ pressed }) => [styles.clearBtn, pressed ? styles.clearBtnPressed : null]}
        >
          {clearIcon}
        </Pressable>
      )}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minHeight: MIN_TOUCH_TARGET,
    marginTop: t.space["2"],
    marginBottom: t.space["2"],
    paddingHorizontal: t.space["3"],
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    borderRadius: t.radius.md,
  },
  searchFieldFocused:
    Platform.OS === "web"
      ? ({ boxShadow: tokens.shadow.ring, borderColor: t.colors.accent } as ViewStyle)
      : { borderColor: t.colors.accent },
  searchInput: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  // The negative margin hands the box's extra width back to the field's padding, so the disc sits
  // exactly where the slop variant's disc does.
  clearTarget: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    marginRight: -CLEAR_BTN_HIT_SLOP,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  clearBtn: {
    width: CLEAR_BTN_SIZE,
    height: CLEAR_BTN_SIZE,
    borderRadius: CLEAR_BTN_SIZE / 2,
    backgroundColor: t.colors.bgAlt,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  clearBtnPressed: {
    backgroundColor: t.colors.border,
  },
}))
