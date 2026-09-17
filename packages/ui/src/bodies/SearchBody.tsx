import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Platform,
  Pressable,
  ScrollView as RNScrollView,
  StyleSheet,
  View,
  type NativeSyntheticEvent,
  type TextInput as RNTextInput,
  type TextInputKeyPressEventData,
  type ViewStyle,
} from "react-native"
import { TextInput } from "../primitives/TextInput"
import type { CleanupDTO, LeaderboardEntryDTO, PersonDTO, ReportPinDTO } from "@civfix/shared"
import { tokens } from "@civfix/shared/tokens"
import { focusRingProps, makeThemedStyles, motion, useTheme, wash, useLayoutMode, webHover, webInputReset, webTransition, headingLevel } from "../theme"
import { Icon, iconMap, Text } from "../typography"
import { Avatar, EmptyState, FollowButton } from "../primitives"
import {
  useAuthState,
  useFollowSuggestions,
  useJurisdictionLeaderboard,
  useMyHours,
  useNearbyCleanups,
  useNearbyReportPins,
  useResolveJurisdiction,
  useUserLocation,
} from "../data"
import { searchModeFor, useNavStore } from "../nav"
import { useScrollHost } from "../shell/ScrollHost"
import { useSearchBarStore } from "../shell/searchBarStore"
import { searchFieldEscape } from "../shell/shellKeyModel"
import { useT } from "../i18n"
import { HEADER_CONTROL_SIZE } from "./headerControls"
import { HeaderProfileButton } from "./HeaderProfileButton"
import { EventHitRow, ReportHitRow, SearchResults } from "./SearchResults"
import { LeaderboardRow } from "./LeaderboardRow"
import { SEARCH_RESULT_CARD_LAYOUT } from "./searchResultsModel"
import { resolveDiscoveryGeoid } from "./leaderboardGeoid"
import {
  LEADERBOARD_PREVIEW_LIMIT,
  LEADERBOARD_REQUEST_LIMIT,
  assembleSearchSuggestions,
} from "./searchSuggestModel"
import { useRowHover } from "./rowHover"
import {
  discardSearchInput,
  pendingSearchInput,
  searchRecentCommit,
  trackSearchInput,
  useSearchRecentStore,
} from "./searchRecentStore"
import {
  isSearchBodyFrozen,
  resolveSearchSurfaceState,
  searchSurfaceState,
} from "./searchSurfaceModel"

const FOCUS_REQUEST_HOLD_MS = motion.bodyPush.duration + motion.bodyExit.duration

function commitSearchRecent(query: string): void {
  const value = searchRecentCommit(query)
  if (value) useSearchRecentStore.getState().record(value)
}

function useRecordSearchOnCommit(query: string, pinned: boolean): void {
  useEffect(() => {
    trackSearchInput(query)
  }, [query])

  const lastCommittedRef = useRef<string | null>(null)

  const commitRef = useRef<(value: string) => void>(() => {})
  commitRef.current = (value: string) => {
    const normalized = searchRecentCommit(value)
    if (!normalized || normalized === lastCommittedRef.current) return
    lastCommittedRef.current = normalized
    commitSearchRecent(normalized)
  }

  const wasPinnedRef = useRef(pinned)
  useEffect(() => {
    const unpinned = wasPinnedRef.current && !pinned
    wasPinnedRef.current = pinned
    if (unpinned) commitRef.current(pendingSearchInput())
  }, [pinned])

  useEffect(
    () =>
      useNavStore.subscribe((state, prev) => {
        if (state.stack.length > prev.stack.length) commitRef.current(prev.query)
      }),
    [],
  )

  useEffect(() => () => discardSearchInput(), [])
}

export function SearchBody() {
  const styles = useStyles()
  const rawQuery = useNavStore((state) => state.query)
  const query = rawQuery.trim()

  const view = useNavStore((state) => state.view)
  const pinned = useSearchBarStore((state) => state.pinned)
  useRecordSearchOnCommit(query, pinned)
  const exitSettled = useSearchBarStore((state) => state.searchExitSettled)
  const frozen = isSearchBodyFrozen(view, exitSettled)
  const live = searchSurfaceState(query, pinned)
  const heldRef = useRef(live)
  if (!frozen) heldRef.current = live
  const held = resolveSearchSurfaceState(live, heldRef.current, frozen)

  const expanded = useLayoutMode() === "expanded"
  const surface =
    held.surface === "results" ? (
      <SearchResults query={held.query} />
    ) : (
      <SearchResting surface={held.surface} expanded={expanded} />
    )

  if (!expanded) return surface
  return (
    <View style={styles.expandedRoot}>
      <ExpandedSearchHeader />
      {surface}
    </View>
  )
}

function ExpandedSearchHeader() {
  const styles = useStyles()
  const { t } = useT("home-sidebar")
  return (
    <View style={styles.expandedHead}>
      <View style={styles.tabRootRow}>
        <Text accessibilityRole="header" style={[styles.title, styles.titleTabRoot]}>
          {t("search_page.title")}
        </Text>
      </View>
      <ExpandedSearchField />
    </View>
  )
}

function ExpandedSearchField() {
  const styles = useStyles()
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

function LinkAction({
  label,
  a11yLabel,
  onPress,
}: {
  label: string
  a11yLabel: string
  onPress: () => void
}) {
  const styles = useStyles()
  const expanded = useLayoutMode() === "expanded"
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      onPress={onPress}
      {...focusRingProps}
      style={(state) => [styles.clear, webTransition, state.pressed ? styles.pressed : null]}
    >
      {(state) => (
        <Text
          style={[
            styles.clearLabel,
            expanded ? styles.clearLabelExpanded : null,
            webHover(state) ? styles.linkHovered : null,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  )
}

function SuggestedPersonCard({ person, expanded }: { person: PersonDTO; expanded: boolean }) {
  const styles = useStyles()
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
      <FollowButton personId={person.id} isFollowing={person.isFollowing} nextPath="/" size="sm" />
    </View>
  )
}

function RecentlySearched() {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("home-sidebar")
  const recent = useSearchRecentStore((state) => state.recent)
  const clear = useSearchRecentStore((state) => state.clear)
  const setQuery = useNavStore((state) => state.setQuery)
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text accessibilityRole="header" {...headingLevel(2)} style={styles.sectionTitle}>
          {t("search_page.recent")}
        </Text>
        {recent.length > 0 ? (
          <LinkAction
            label={t("search_page.clear")}
            a11yLabel={t("search_page.clear_a11y")}
            onPress={clear}
          />
        ) : null}
      </View>

      {recent.length > 0 ? (
        <View style={styles.recents}>
          {recent.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityLabel={t("search_page.recent_a11y", { query: item })}
              onPress={() => setQuery(item)}
              {...focusRingProps}
              style={(state) => [
                styles.recentRow,
                webTransition,
                state.pressed ? styles.pressed : webHover(state) ? styles.recentRowHovered : null,
              ]}
            >
              <View style={styles.recentIcon}>
                <Icon icon={iconMap.Clock} size={17} color={th.colors.textMuted} />
              </View>
              <Text style={styles.recentLabel} numberOfLines={1}>
                {item}
              </Text>
              <Icon icon={iconMap.ChevronRight} size={16} color={th.colors.textSubtle} />
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyRecents}>{t("search_page.recent_empty")}</Text>
      )}
    </>
  )
}

export function DiscoveryLeaderboard({
  geoid,
  name,
  entries,
  precededBySection = false,
  participantCount,
  viewerRank,
  viewerHours,
}: {
  geoid: string
  name: string | null
  entries: readonly LeaderboardEntryDTO[]
  precededBySection?: boolean
  participantCount?: number | null
  viewerRank?: number | null
  viewerHours?: number | null
}) {
  const styles = useStyles()
  const { t } = useT("home-sidebar")
  const { user } = useAuthState()
  const isEmpty = entries.length === 0
  const youEntry: LeaderboardEntryDTO | null =
    user && typeof viewerRank === "number" && typeof viewerHours === "number" && viewerRank > LEADERBOARD_PREVIEW_LIMIT
      ? {
          rank: viewerRank,
          userId: user.id,
          name: user.displayName,
          handle: user.handle ?? null,
          avatarUrl: user.avatarUrl ?? null,
          hours: viewerHours,
        }
      : null

  return (
    <>
      <View style={[styles.sectionHeader, precededBySection ? styles.laterTitle : null]}>
        <Text accessibilityRole="header" {...headingLevel(2)} style={styles.sectionTitle}>
          {t("search_page.leaderboard")}
        </Text>
        <LinkAction
          label={t("search_page.see_all")}
          a11yLabel={t("search_page.leaderboard_see_all_a11y")}
          onPress={() => useNavStore.getState().push({ kind: "leaderboard", geoid })}
        />
      </View>
      {name && !isEmpty ? (
        <Text style={styles.leaderboardSub}>{t("search_page.leaderboard_in", { name })}</Text>
      ) : null}
      {isEmpty ? (
        <View style={styles.leaderboardEmpty}>
          <EmptyState
            variant="inline"
            icon={iconMap.Award}
            title={t("leaderboard:empty.title")}
            body={participantCount === 0 ? t("leaderboard:empty.body") : undefined}
          />
        </View>
      ) : (
        <View style={styles.suggestGroup}>
          {entries.map((entry) => (
            <LeaderboardRow key={entry.userId} entry={entry} />
          ))}
          {youEntry ? <LeaderboardRow key={youEntry.userId} entry={youEntry} you /> : null}
        </View>
      )}
    </>
  )
}

function Discovery({ expanded }: { expanded: boolean }) {
  const styles = useStyles()
  const { t } = useT("home-sidebar")
  const selectView = useNavStore((state) => state.selectView)

  const { isAuthenticated } = useAuthState()
  const location = useUserLocation().data ?? null
  const cleanupsQuery = useNearbyCleanups(10, location)
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
  const now = useMemo(() => new Date(), [])
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

function SearchResting({
  surface,
  expanded,
}: {
  surface: "recents" | "discovery"
  expanded: boolean
}) {
  const styles = useStyles()
  const { ScrollView } = useScrollHost()


  const recentCount = useSearchRecentStore((state) => state.recent.length)
  const showRecents = surface === "recents" && (!expanded || recentCount > 0)
  const showDiscovery = surface === "discovery" || expanded

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {showRecents ? <RecentlySearched /> : null}
      {showRecents && showDiscovery ? <View style={styles.surfaceBreak} /> : null}
      {showDiscovery ? <Discovery expanded={expanded} /> : null}
      <View style={styles.bottomPad} />
    </ScrollView>
  )
}

const MIN_TOUCH_TARGET = 44
const FIELD_CLEAR_SIZE = 22
const FIELD_CLEAR_HIT_SLOP = {
  top: (MIN_TOUCH_TARGET - FIELD_CLEAR_SIZE) / 2,
  bottom: (MIN_TOUCH_TARGET - FIELD_CLEAR_SIZE) / 2,
  left: (MIN_TOUCH_TARGET - FIELD_CLEAR_SIZE) / 2,
  right: (MIN_TOUCH_TARGET - FIELD_CLEAR_SIZE) / 2,
}

const useStyles = makeThemedStyles((t) => ({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
  },
  expandedRoot: { flex: 1 },
  expandedHead: {
    paddingHorizontal: t.space["4"],
    paddingTop: 14,
    paddingBottom: t.space["3"],
    gap: t.space["3"],
    ...(Platform.OS === "web"
      ? { borderBottomWidth: 1, borderBottomColor: wash(t.colors.borderStrong, 0.45, t) }
      : { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border }),
  },
  tabRootRow: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 12,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surface,
    ...(Platform.OS === "web"
      ? { borderWidth: 1, borderColor: wash(t.colors.borderStrong, 0.45, t) }
      : { borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border }),
  },
  fieldFocused:
    Platform.OS === "web"
      ? ({ boxShadow: tokens.shadow.ring, borderColor: t.colors.accent } as ViewStyle)
      : { borderColor: t.colors.accent },
  fieldInput: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  fieldClear: {
    width: FIELD_CLEAR_SIZE,
    height: FIELD_CLEAR_SIZE,
    borderRadius: FIELD_CLEAR_SIZE / 2,
    backgroundColor: t.colors.bgAlt,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  fieldClearPressed: { backgroundColor: t.colors.border },

  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: t.space["5"],
    minHeight: HEADER_CONTROL_SIZE,
  },
  title: {
    color: t.colors.text,
    fontFamily: t.fontFamily.displayBold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -1.1,
  },
  titleTabRoot: {
    fontFamily: t.fontFamily.bodyExtraBold,
    lineHeight: 39,
    letterSpacing: -0.5,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: t.space["2"],
  },
  sectionTitle: {
    color: t.colors.text,
    fontFamily: t.fontFamily.displayBold,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.35,
  },
  clear: { minHeight: MIN_TOUCH_TARGET, justifyContent: "center", borderRadius: t.radius.xs },
  clearLabel: {
    color: t.colors.bloom["600"],
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14,
    lineHeight: 19,
  },
  clearLabelExpanded: { color: t.colors.accentText },
  linkHovered: { textDecorationLine: "underline" },
  recents: {
    borderTopColor: t.colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  recentRow: {
    alignItems: "center",
    borderBottomColor: t.colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: t.space["3"],
    minHeight: 44,
  },
  recentRowHovered: { backgroundColor: t.colors.bgAlt },
  recentIcon: {
    alignItems: "center",
    backgroundColor: t.colors.bgAlt,
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  recentLabel: {
    color: t.colors.text,
    flex: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 15,
    lineHeight: 20,
  },
  emptyRecents: {
    color: t.colors.textMuted,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: t.space["2"],
  },
  laterTitle: { marginTop: t.space["5"], marginBottom: t.space["3"] },
  surfaceBreak: { height: t.space["5"] },
  railTitle: { marginBottom: t.space["3"] },
  leaderboardSub: {
    color: t.colors.textMuted,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    marginTop: -t.space["1"],
    marginBottom: t.space["2"],
  },
  leaderboardEmpty: {
    backgroundColor: t.colors.surface,
    borderColor: t.colors.border,
    borderRadius: SEARCH_RESULT_CARD_LAYOUT.radius,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: t.space["4"],
  },
  personRail: { marginHorizontal: -t.space["4"] },
  personRailContent: {
    gap: t.space["3"],
    paddingHorizontal: t.space["4"],
  },
  personCard: {
    alignItems: "center",
    backgroundColor: t.colors.surface,
    borderColor: t.colors.border,
    borderRadius: SEARCH_RESULT_CARD_LAYOUT.radius,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["3"],
    width: 140,
    ...t.shadows.s1,
  },
  personCardExpanded: { width: 116 },
  personTap: {
    alignItems: "center",
    alignSelf: "stretch",
    marginBottom: t.space["2"],
    borderRadius: t.radius.md,
  },
  personCardHovered: {
    backgroundColor: t.colors.surfaceTint,
    borderColor: t.colors.borderStrong,
  },
  personName: {
    color: t.colors.text,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14,
    lineHeight: 19,
    marginTop: t.space["2"],
    maxWidth: "100%",
  },
  personHandle: {
    color: t.colors.textSubtle,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 1,
    maxWidth: "100%",
  },
  suggestGroup: { gap: SEARCH_RESULT_CARD_LAYOUT.gap },
  pressed: { opacity: 0.64 },
  bottomPad: { height: t.space["8"] },
}))
