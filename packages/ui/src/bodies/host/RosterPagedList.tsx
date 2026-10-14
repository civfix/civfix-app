import React, { useCallback } from "react"
import { View } from "react-native"
import { TextInput } from "../../primitives/TextInput"
import { makeThemedStyles, useTheme, webInputReset, inputFocusedStyle } from "../../theme"
import { TextLink } from "../../typography"
import { useT } from "../../i18n"
import { INPUT_MIN_HEIGHT } from "./hostLayout"
import { RosterCheckinList, type RosterCheckinListProps } from "./RosterCheckinList"
import { requestNextRosterPage, type RosterPaging } from "./rosterListModel"

export interface RosterSearchFieldProps {
  value: string
  onChangeText: (next: string) => void
  placeholder: string
  accessibilityLabel: string
  focused: boolean
  onFocusChange: (focused: boolean) => void
}

export function RosterSearchField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  focused,
  onFocusChange,
}: RosterSearchFieldProps) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={th.colors.textSubtle}
      accessibilityLabel={accessibilityLabel}
      autoCapitalize="none"
      autoCorrect={false}
      onFocus={() => onFocusChange(true)}
      onBlur={() => onFocusChange(false)}
      style={[webInputReset, styles.search, focused ? inputFocusedStyle(th) : null]}
    />
  )
}

export interface RosterPagedListProps extends RosterCheckinListProps {
  paging: RosterPaging
}

export function RosterPagedList({ paging, ...list }: RosterPagedListProps) {
  return (
    <View>
      <RosterCheckinList {...list} />
      <RosterLoadMore paging={paging} />
    </View>
  )
}

export function RosterLoadMore({ paging }: { paging: RosterPaging }) {
  const styles = useStyles()
  const { t } = useT("host-common")
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = paging
  const loadMore = useCallback(
    () => requestNextRosterPage({ fetchNextPage, hasNextPage, isFetchingNextPage }),
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  )

  if (!hasNextPage) return null
  return (
    <View style={styles.more}>
      <TextLink
        variant="label"
        standalone
        disabled={isFetchingNextPage}
        onPress={loadMore}
        accessibilityLabel={t("roster.load_more_a11y")}
      >
        {isFetchingNextPage ? t("roster.loading_more") : t("roster.load_more")}
      </TextLink>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  search: {
    minHeight: INPUT_MIN_HEIGHT,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  more: {
    alignSelf: "flex-start",
    paddingVertical: t.space["2"],
  },
}))
