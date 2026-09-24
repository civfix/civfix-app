import React from "react"
import { View } from "react-native"
import type { CleanupDTO, EventRegistrationDTO } from "@civfix/shared"
import { headingLevel, makeThemedStyles } from "../../../theme"
import { Text } from "../../../typography"
import { useT } from "../../../i18n"
import { FeedNotice } from "../../FeedNotice"
import { RosterPagedList, RosterSearchField, type RosterPaging } from "../RosterPagedList"

export interface CheckinRosterSectionProps {
  cleanup: CleanupDTO
  search: string
  onSearchChange: (value: string) => void
  searchFocused: boolean
  onSearchFocusChange: (focused: boolean) => void
  roster: RosterPaging & { isLoading: boolean; isError: boolean }
  waiting: readonly EventRegistrationDTO[]
  pending: boolean
  onCheckIn: (seatId: string) => void
  onUndo: (seatId: string) => void
}

export function CheckinRosterSection({
  cleanup,
  search,
  onSearchChange,
  searchFocused,
  onSearchFocusChange,
  roster,
  waiting,
  pending,
  onCheckIn,
  onUndo,
}: CheckinRosterSectionProps) {
  const styles = useStyles()
  const { t } = useT("host-checkin")
  const { t: tRoster } = useT("host-common")
  return (
    <View style={styles.roster}>
      <Text style={styles.rosterTitle} accessibilityRole="header" {...headingLevel(2)}>
        {t("roster.title")}
      </Text>
      <RosterSearchField
        value={search}
        onChangeText={onSearchChange}
        placeholder={t("roster.search")}
        accessibilityLabel={t("roster.search")}
        focused={searchFocused}
        onFocusChange={onSearchFocusChange}
      />
      {roster.isLoading ? (
        <Text style={styles.muted}>{tRoster("roster.loading")}</Text>
      ) : roster.isError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {tRoster("roster.error")}
        </Text>
      ) : waiting.length === 0 ? (
        <FeedNotice plain icon="UserCheck" title={t("roster.empty_title")} body={t("roster.empty_body")} />
      ) : (
        <RosterPagedList
          rows={waiting}
          slots={cleanup.slots}
          timeZone={cleanup.timezone ?? undefined}
          canCheckIn
          pending={pending}
          onCheckIn={onCheckIn}
          onUndo={onUndo}
          paging={roster}
        />
      )}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  roster: {
    gap: t.space["2"],
  },
  rosterTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["16"],
    color: t.colors.text,
  },
  muted: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
  },
  error: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.dangerInk,
  },
}))
