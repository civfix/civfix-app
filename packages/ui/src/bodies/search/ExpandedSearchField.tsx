import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  Platform,
  Pressable,
  View,
  type NativeSyntheticEvent,
  type TextInput as RNTextInput,
  type TextInputKeyPressEventData,
} from "react-native"
import { TextInput } from "../../primitives/TextInput"
import { focusRingProps, motion, useTheme, webInputReset } from "../../theme"
import { Icon, iconMap } from "../../typography"
import { searchModeFor, useNavStore } from "../../nav"
import { useSearchBarStore } from "../../shell/searchBarStore"
import { searchFieldEscape } from "../../shell/shellKeyModel"
import { useT } from "../../i18n"
import { discardSearchInput } from "../searchRecentStore"
import { commitSearchRecent } from "./useRecordSearchOnCommit"
import { FIELD_CLEAR_HIT_SLOP, useSearchStyles } from "./searchStyles"

const FOCUS_REQUEST_HOLD_MS = motion.bodyPush.duration + motion.bodyExit.duration

export function ExpandedSearchField() {
  const styles = useSearchStyles()
  const th = useTheme()
  const { t } = useT("nav")
  const { t: tSearch } = useT("common-search")
  const query = useNavStore((s) => s.query)
  const setQuery = useNavStore((s) => s.setQuery)
  const setPinned = useSearchBarStore((s) => s.setPinned)
  const focusNonce = useSearchBarStore((s) => s.focusNonce)
  const consumeSearchFocus = useSearchBarStore((s) => s.consumeSearchFocus)
  const inputRef = useRef<RNTextInput>(null)
  const [focused, setFocused] = useState(false)

  const pinned = focused || query.trim().length > 0
  useEffect(() => {
    setPinned(pinned)
  }, [pinned, setPinned])
  useEffect(() => () => setPinned(false), [setPinned])

  useEffect(() => {
    if (focusNonce === 0) return
    inputRef.current?.focus()
    const timer = setTimeout(consumeSearchFocus, FOCUS_REQUEST_HOLD_MS)
    return () => clearTimeout(timer)
  }, [focusNonce, consumeSearchFocus])

  const clearQuery = useCallback(() => {
    discardSearchInput()
    setQuery("")
  }, [setQuery])

  const onKeyPress = useCallback(
    (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      const web = event as unknown as { key?: string; preventDefault?: () => void }
      if (web.key !== "Escape") return
      web.preventDefault?.()
      if (searchFieldEscape(query) === "clear") clearQuery()
      else inputRef.current?.blur()
    },
    [query, clearQuery],
  )

  return (
    <View style={[styles.field, focused ? styles.fieldFocused : null]}>
      <Icon icon={iconMap.Search} size={18} color={th.colors.textSubtle} />
      <TextInput
        ref={inputRef}
        value={query}
        onChangeText={setQuery}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...(Platform.OS === "web" ? { onKeyPress } : null)}
        placeholder={t(searchModeFor("search", null).placeholder)}
        placeholderTextColor={th.colors.textSubtle}
        selectionColor={th.colors.brand.bloom}
        accessibilityLabel={t("tab.search")}
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={() => commitSearchRecent(query)}
        style={[styles.fieldInput, webInputReset]}
      />
      {query.length > 0 ? (
        <Pressable
          onPress={clearQuery}
          accessibilityRole="button"
          accessibilityLabel={tSearch("a11y.clear")}
          hitSlop={FIELD_CLEAR_HIT_SLOP}
          {...focusRingProps}
          style={({ pressed }) => [styles.fieldClear, pressed ? styles.fieldClearPressed : null]}
        >
          <Icon icon={iconMap.Close} size={12} color={th.colors.textSubtle} />
        </Pressable>
      ) : null}
    </View>
  )
}
