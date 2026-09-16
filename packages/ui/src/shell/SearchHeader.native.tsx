import React, { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { View, Pressable } from "react-native"
import { BottomSheetTextInput } from "@gorhom/bottom-sheet"
import { ReduceMotion, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated"
import { useTheme } from "../theme"
import { Icon, iconMap } from "../typography"
import { Avatar } from "../primitives"
import { useT } from "../i18n"
import type { SearchHeaderProps } from "./SearchHeader.types"
import { useSearchHeaderStyles } from "./SearchHeader.styles"
import { dockFocusConfig } from "./motionConfigs.native"
import { focusSettleCommand } from "./searchExitModel"
import { useSearchBarStore } from "./searchBarStore"
import { useKeyboardAnchor } from "./useKeyboardAnchor.native"

function SearchPill({
  value,
  placeholder,
  mode,
  onChangeText,
  onFocus,
}: Pick<SearchHeaderProps, "value" | "placeholder" | "mode" | "onChangeText" | "onFocus">) {
  const styles = useSearchHeaderStyles()
  const th = useTheme()
  return (
    <View style={styles.search}>
      <Icon icon={iconMap.Search} size={17} color={th.colors.textSubtle} />
      <BottomSheetTextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor={th.colors.textSubtle}
        style={styles.input}
        returnKeyType="search"
        onChangeText={onChangeText}
        onFocus={onFocus}
      />
      {mode === "people" ? <Icon icon={iconMap.Users} size={17} color={th.colors.textSubtle} /> : null}
    </View>
  )
}

type Measurable = {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void
}

export function useDockedSearchRise(
  riseRef: RefObject<Measurable | null>,
  value: string,
  restOffset: number,
  searchActive: boolean,
  p: SharedValue<number>,
) {
  const setPinned = useSearchBarStore((s) => s.setPinned)
  const setBarHeight = useSearchBarStore((s) => s.setBarHeight)
  const setKeyboardReserve = useSearchBarStore((s) => s.setKeyboardReserve)

  const [focused, setFocused] = useState(false)
  const pinned = focused || value.trim().length > 0
  const pinnedRef = useRef(pinned)
  pinnedRef.current = pinned

  useEffect(() => {
    setPinned(pinned)
  }, [pinned, setPinned])
  useEffect(() => () => setPinned(false), [setPinned])

  const measureBar = useCallback(() => {
    riseRef.current?.measureInWindow((_x, _y, _w, h) => {
      if (Number.isFinite(h) && h > 0) setBarHeight(h)
    })
  }, [riseRef, setBarHeight])

  const onLayout = useCallback(() => {
    if (pinnedRef.current) return
    measureBar()
  }, [measureBar])

  const pos = useSharedValue(0)
  useEffect(() => {
    const cmd = focusSettleCommand(pinned, searchActive, p.value)
    if (!cmd.animated) {
      pos.value = cmd.target
      return
    }
    pos.value = withTiming(cmd.target, { ...dockFocusConfig(), reduceMotion: ReduceMotion.System })
  }, [pinned, searchActive, pos, p])

  const anchor = useKeyboardAnchor({ enabled: focused, restOffset })
  const riseStyle = anchor.liftStyle

  useEffect(() => {
    setKeyboardReserve(anchor.reserved)
  }, [anchor.reserved, setKeyboardReserve])
  useEffect(() => () => setKeyboardReserve(0), [setKeyboardReserve])

  const onFieldFocus = useCallback(() => setFocused(true), [])
  const onFieldBlur = useCallback(() => setFocused(false), [])

  return {
    riseStyle,
    onLayout,
    onFieldFocus,
    onFieldBlur,
    pinned,
    focusProgress: pos,
    keyboardEngaged: anchor.engaged,
  }
}

export function SearchHeader(props: SearchHeaderProps) {
  const styles = useSearchHeaderStyles()
  const th = useTheme()
  const { t } = useT("common-search")
  const { value, placeholder, mode, onChangeText, onFocus, userName, userPhotoUrl, onOpenProfile, onSignIn } = props
  return (
    <View style={styles.row}>
      <SearchPill value={value} placeholder={placeholder} mode={mode} onChangeText={onChangeText} onFocus={onFocus} />
      {onSignIn ? (
        <Pressable
          onPress={onSignIn}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.sign_in")}
          hitSlop={8}
          style={({ pressed }) => [styles.signIn, pressed ? styles.buttonPressed : null]}
        >
          <Icon icon={iconMap.LogIn} size={18} color={th.colors.text} />
        </Pressable>
      ) : userName ? (
        <Pressable
          onPress={onOpenProfile}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.open_profile")}
          hitSlop={8}
          style={({ pressed }) => (pressed ? styles.buttonPressed : null)}
        >
          <Avatar name={userName} photoUrl={userPhotoUrl ?? null} size={32} />
        </Pressable>
      ) : null}
    </View>
  )
}
