import React from "react"
import { View } from "react-native"
import type { EventRegistrationDTO } from "@civfix/shared"
import { headingLevel, makeThemedStyles } from "../../../theme"
import { Text } from "../../../typography"
import { useT } from "../../../i18n"
import { FeedNotice } from "../../FeedNotice"
import { RosterSearchField } from "../RosterPagedList"

export interface CheckinRosterSectionProps {
  search: string
  onSearchChange: (value: string) => void
  searchFocused: boolean
  onSearchFocusChange: (focused: boolean) => void
  roster: { isLoading: boolean; isError: boolean }
  waiting: readonly EventRegistrationDTO[]
}

/** The roster's head. Its rows are the check-in screen's own list rows, so it renders none itself. */
export function CheckinRosterSection({
  search,
  onSearchChange,
  searchFocused,
  onSearchFocusChange,
  roster,
  waiting,
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
      ) : null}
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
