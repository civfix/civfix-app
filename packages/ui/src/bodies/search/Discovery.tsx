import React, { useMemo } from "react"
import { Pressable, ScrollView as RNScrollView, View } from "react-native"
import type { CleanupDTO, LeaderboardEntryDTO, PersonDTO, ReportPinDTO } from "@civfix/shared"
import { focusRingProps, headingLevel, webTransition } from "../../theme"
import { Text } from "../../typography"
import { Avatar, FollowButton } from "../../primitives"
import {
  useAuthState,
  useFollowSuggestions,
  useJurisdictionLeaderboard,
  useMyHours,
  useNearbyCleanups,
  useNearbyReportPins,
  useResolveJurisdiction,
  useUserLocation,
} from "../../data"
import { useNavStore } from "../../nav"
import { useT } from "../../i18n"
import { HeaderProfileButton } from "../HeaderProfileButton"
import { EventHitRow, ReportHitRow } from "../SearchResults"
import { SEARCH_EVENT_POOL_LIMIT } from "../searchResultsModel"
import { resolveDiscoveryGeoid } from "../leaderboardGeoid"
import { LEADERBOARD_REQUEST_LIMIT, assembleSearchSuggestions } from "../searchSuggestModel"
import { useRowHover } from "../rowHover"
import { useListTimeTick } from "../useListTimeAgo"
import { DiscoveryLeaderboard } from "./DiscoveryLeaderboard"
import { LinkAction } from "./LinkAction"
import { useSearchStyles } from "./searchStyles"

function SuggestedPersonCard({ person, expanded }: { person: PersonDTO; expanded: boolean }) {
  const styles = useSearchStyles()
  const { t } = useT("home-sidebar")
  const { hovered, hoverProps } = useRowHover()
  return (
    <View
      {...hoverProps}
      style={[
        styles.personCard,
        expanded ? styles.personCardExpanded : null,
        webTransition,
        hovered ? styles.personCardHovered : null,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("person.view_profile_a11y", { name: person.name })}
        onPress={() => useNavStore.getState().push({ kind: "person", id: person.handle ?? person.id })}
        {...focusRingProps}
        style={(state) => [styles.personTap, webTransition, state.pressed ? styles.pressed : null]}
      >
        <Avatar
          name={person.name}
          seed={person.id}
          photoUrl={person.avatarUrl ?? null}
          gradient={person.avatar ?? null}
          size={56}
        />
        <Text style={styles.personName} numberOfLines={1}>
          {person.name}
        </Text>
        <Text style={styles.personHandle} numberOfLines={1}>
          {person.handle ? `@${person.handle}` : " "}
        </Text>
      </Pressable>
      <FollowButton
        personId={person.id}
        isFollowing={person.isFollowing}
        nextPath={`/people/${person.handle ?? person.id}`}
        size="sm"
      />
    </View>
  )
}

export function Discovery({ expanded }: { expanded: boolean }) {
  const styles = useSearchStyles()
  const { t } = useT("home-sidebar")
  const selectView = useNavStore((state) => state.selectView)

  const { isAuthenticated } = useAuthState()
  const location = useUserLocation().data ?? null
  const cleanupsQuery = useNearbyCleanups(SEARCH_EVENT_POOL_LIMIT, location)
  const pinsQuery = useNearbyReportPins(location)
  const suggestionsQuery = useFollowSuggestions()
  const jurisdictionQuery = useResolveJurisdiction(location)
  const myHours = useMyHours()
  const geo = useMemo(
    () =>
      resolveDiscoveryGeoid({
        resolved: jurisdictionQuery.data ?? null,
        myHours: myHours.data?.hours ?? null,
      }),
    [jurisdictionQuery.data, myHours.data],
  )
  const leaderboardQuery = useJurisdictionLeaderboard(geo?.geoid, { limit: LEADERBOARD_REQUEST_LIMIT })
  const leaderboardPage = leaderboardQuery.data?.pages[0]
  const showLeaderboard = !!geo && leaderboardQuery.isSuccess
  const tick = useListTimeTick()
  const now = useMemo(() => new Date(tick), [tick])
  const sections = useMemo(
    () =>
      assembleSearchSuggestions<CleanupDTO, PersonDTO, ReportPinDTO, LeaderboardEntryDTO>({
        cleanups: cleanupsQuery.data ?? [],
        pins: pinsQuery.data ?? [],
        people: suggestionsQuery.data ?? [],
        leaderboard: leaderboardPage?.entries ?? [],
        leaderboardGeoid: geo?.geoid ?? null,
        location,
        signedIn: isAuthenticated,
        now,
      }),
    [
      cleanupsQuery.data,
      pinsQuery.data,
      suggestionsQuery.data,
      leaderboardPage,
      geo,
      location,
      isAuthenticated,
      now,
    ],
  )

  return (
    <>
      {expanded ? null : (
        <View style={styles.titleRow}>
          <Text accessibilityRole="header" style={styles.title}>
            {t("search_page.title")}
          </Text>
          <HeaderProfileButton />
        </View>
      )}

      {sections.people.length > 0 ? (
        <>
          <Text accessibilityRole="header" {...headingLevel(2)} style={[styles.sectionTitle, styles.railTitle]}>
            {t("search_page.suggested_people")}
          </Text>
          <RNScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.personRail}
            contentContainerStyle={styles.personRailContent}
          >
            {sections.people.map((person) => (
              <SuggestedPersonCard key={person.id} person={person} expanded={expanded} />
            ))}
          </RNScrollView>
        </>
      ) : null}

      {sections.events.length > 0 ? (
        <>
          <View style={[styles.sectionHeader, sections.people.length > 0 ? styles.laterTitle : null]}>
            <Text accessibilityRole="header" {...headingLevel(2)} style={styles.sectionTitle}>
              {t("search_page.events_near")}
            </Text>
            <LinkAction
              label={t("search_page.see_all")}
              a11yLabel={t("search_page.see_all_events_a11y")}
              onPress={() => selectView("events")}
            />
          </View>
          <View style={styles.suggestGroup}>
            {sections.events.map((cleanup) => (
              <EventHitRow key={cleanup.id} cleanup={cleanup} />
            ))}
          </View>
        </>
      ) : null}

      {showLeaderboard && geo ? (
        <DiscoveryLeaderboard
          geoid={geo.geoid}
          name={geo.name ?? leaderboardPage?.jurisdictionName ?? null}
          entries={sections.leaderboard}
          precededBySection={sections.people.length > 0 || sections.events.length > 0}
          participantCount={leaderboardPage?.participantCount ?? null}
          viewerRank={leaderboardPage?.viewerRank ?? null}
          viewerHours={leaderboardPage?.viewerHours ?? null}
        />
      ) : null}

      {sections.reports.length > 0 ? (
        <>
          <Text
            accessibilityRole="header"
            {...headingLevel(2)}
            style={[
              styles.sectionTitle,
              sections.people.length > 0 || sections.events.length > 0 || showLeaderboard
                ? styles.laterTitle
                : null,
            ]}
          >
            {t("search_page.reports_near")}
          </Text>
          <View style={styles.suggestGroup}>
            {sections.reports.map((report) => (
              <ReportHitRow key={report.id} report={report} viewer={location} />
            ))}
          </View>
        </>
      ) : null}
    </>
  )
}
