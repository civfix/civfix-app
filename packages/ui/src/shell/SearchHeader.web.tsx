import React, { useEffect, useState } from "react"
import { View, Pressable, TextInput } from "react-native"
import { focusRingProps, space, useTheme, webCursor, webHover, webTransition } from "../theme"
import { Icon, iconMap } from "../typography"
import { Avatar } from "../primitives"
import { useT } from "../i18n"
import type { SearchHeaderProps } from "./SearchHeader.types"
import { useSearchHeaderStyles } from "./SearchHeader.styles"
import { useSearchBarStore } from "./searchBarStore"
import { useKeyboardAnchor } from "./useKeyboardAnchor.web"

const WEB_DOCK_REST_OFFSET = space["3"] + 10

function SearchPill({
  value,
  placeholder,
  mode,
  onChangeText,
  onFocus,
  onBlur,
}: Pick<SearchHeaderProps, "value" | "placeholder" | "mode" | "onChangeText" | "onFocus"> & {
  onBlur?: () => void
}) {
  const styles = useSearchHeaderStyles()
  const th = useTheme()
  return (
    <View style={styles.search}>
      <Icon icon={iconMap.Search} size={17} color={th.colors.textSubtle} />
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor={th.colors.textSubtle}
        style={styles.input}
        returnKeyType="search"
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {mode === "people" ? <Icon icon={iconMap.Users} size={17} color={th.colors.textSubtle} /> : null}
    </View>
  )
}

function DockedSearchBar(props: SearchHeaderProps) {
  const styles = useSearchHeaderStyles()
  const th = useTheme()
  const { t } = useT("common-search")
  const [focused, setFocused] = useState(false)
  const setPinned = useSearchBarStore((s) => s.setPinned)
  const pinned = focused || props.value.trim().length > 0
  useEffect(() => {
    setPinned(pinned)
  }, [pinned, setPinned])
  useEffect(() => () => setPinned(false), [setPinned])
  const anchor = useKeyboardAnchor({ enabled: focused, restOffset: WEB_DOCK_REST_OFFSET })
  return (
    <View style={[styles.dockedRow, anchor.liftStyle]}>
      {props.onHome ? (
        <Pressable
          onPress={props.onHome}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.home")}
          hitSlop={8}
          {...focusRingProps}
          style={(state) => [
            styles.homeCircle,
            webCursor(),
            webTransition,
            webHover(state) ? styles.buttonHovered : null,
            state.pressed ? styles.buttonPressed : null,
          ]}
        >
          <Icon icon={iconMap.Home} size={18} color={th.colors.onAccent} />
        </Pressable>
      ) : null}
      <SearchPill
        value={props.value}
        placeholder={props.placeholder}
        mode={props.mode}
        onChangeText={props.onChangeText}
        onFocus={() => {
          setFocused(true)
          props.onFocus()
        }}
        onBlur={() => setFocused(false)}
      />
      {props.onClear ? (
        <Pressable
          onPress={props.onClear}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.clear")}
          hitSlop={8}
          {...focusRingProps}
          style={(state) => [
            styles.clear,
            webCursor(),
            webTransition,
            webHover(state) ? styles.buttonHovered : null,
            state.pressed ? styles.buttonPressed : null,
          ]}
        >
          <Icon icon={iconMap.Close} size={18} color={th.colors.text} />
        </Pressable>
      ) : null}
    </View>
  )
}

export function SearchHeader(props: SearchHeaderProps) {
  const styles = useSearchHeaderStyles()
  const th = useTheme()
  const { t } = useT("common-search")
  if (props.docked) return <DockedSearchBar {...props} />

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
          {...focusRingProps}
          style={(state) => [
            styles.signIn,
            webCursor(),
            webTransition,
            webHover(state) ? styles.buttonHovered : null,
            state.pressed ? styles.buttonPressed : null,
          ]}
        >
          <Icon icon={iconMap.LogIn} size={18} color={th.colors.text} />
        </Pressable>
      ) : userName ? (
        <Pressable
          onPress={onOpenProfile}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.open_profile")}
          hitSlop={8}
          {...focusRingProps}
          style={(state) => [
            webCursor(),
            webTransition,
            webHover(state) ? styles.buttonHovered : null,
            state.pressed ? styles.buttonPressed : null,
          ]}
        >
          <Avatar name={userName} photoUrl={userPhotoUrl ?? null} size={32} />
        </Pressable>
      ) : null}
    </View>
  )
}
