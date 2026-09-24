import React, { useCallback } from "react"
import { View } from "react-native"
import type { EventRegistrationDTO, EventSlotDTO } from "@civfix/shared"
import { TextInput } from "../../primitives/TextInput"
import { fieldFocusedStyle } from "../../primitives"
import { makeThemedStyles, useTheme, webInputReset } from "../../theme"
import { TextLink } from "../../typography"
import { useT } from "../../i18n"
import { INPUT_MIN_HEIGHT } from "./hostLayout"
import { RosterCheckinList } from "./RosterCheckinList"

export const ROSTER_SEARCH_DEBOUNCE_MS = 250

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
      style={[webInputReset, styles.search, focused ? fieldFocusedStyle(th) : null]}
    />
  )
}

export interface RosterPaging {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => Promise<unknown>
}

export interface RosterPagedListProps {
  rows: readonly EventRegistrationDTO[]
  slots: readonly EventSlotDTO[]
  timeZone: string | undefined
  canCheckIn: boolean
  pending: boolean
  onCheckIn: (seatId: string) => void
  onUndo: (seatId: string) => void
  paging: RosterPaging
}

export function RosterPagedList({ paging, ...list }: RosterPagedListProps) {
  const styles = useStyles()
  const { t } = useT("host-common")
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = paging
  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return
    void fetchNextPage()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  return (
    <View>
      <RosterCheckinList {...list} />
      {hasNextPage ? (
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
      ) : null}
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
