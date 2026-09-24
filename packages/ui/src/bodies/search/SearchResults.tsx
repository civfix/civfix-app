import React, { useEffect, useMemo, useRef } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import type {
  CleanupDTO,
  LatLng,
  ReportPinDTO,
  UserSearchResultDTO,
} from "@civfix/shared"
import { eventChip } from "@civfix/shared/datetime"
import { announce } from "../../announce"
import { focusRingProps, makeThemedStyles, useTheme, useLayoutMode, webHover, webTransition, headingLevel } from "../../theme"
import {
  Avatar,
  EmptyState,
  RsvpPill,
  SkeletonGroup,
  SkeletonList,
  SkeletonText,
} from "../../primitives"
import { Icon, iconMap, Text } from "../../typography"
import {
  useAuthState,
  useJoinCleanup,
  useNearbyCleanups,
  useReportSearch,
  useUserLocation,
  useUserSearch,
  normalizeUserSearchTerm,
} from "../../data"
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../../data/hooks/useDebouncedValue"
import { useNavStore } from "../../nav"
import { useScrollHost } from "../../shell/ScrollHost"
import { useEventWhen, useLocale, useT } from "../../i18n"
import { useRowHover } from "../rowHover"
import { pushCleanup } from "../../nav/verbs"
import { ReportRowView } from "../ReportRow"
import { hasEventEnded } from "../eventLifecycle"
import { reportHitRowModel } from "../reportHitRowModel"
import {
  SEARCH_EVENT_POOL_LIMIT,
  SEARCH_RESULT_CARD_LAYOUT,
  filterEventHits,
  groupSearchResults,
  searchAnnouncement,
  searchResultsView,
  searchSourcesSettled,
  selectSearchHits,
  type SearchSourceState,
} from "./searchResultsModel"
export { SEARCH_RESULT_CARD_LAYOUT, groupSearchResults } from "./searchResultsModel"

function SectionHeader({ title }: { title: string }) {
  const styles = useStyles()
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle} accessibilityRole="header" {...headingLevel(2)}>{title}</Text>
    </View>
  )
}

function PersonHitRow({ person }: { person: UserSearchResultDTO }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("home-sidebar")
  return (
    <Pressable
      onPress={() => useNavStore.getState().push({ kind: "person", id: person.handle ?? person.id })}
      accessibilityRole="button"
      accessibilityLabel={t("person.view_profile_a11y", { name: person.displayName })}
      {...focusRingProps}
      style={(state) => [
        styles.row,
        webTransition,
        webHover(state) ? styles.rowHovered : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      <Avatar name={person.displayName} seed={person.id} photoUrl={person.avatarUrl ?? null} gradient={person.avatar ?? null} size={40} />
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>{person.displayName}</Text>
        {person.handle ? <Text style={styles.rowDetail} numberOfLines={1}>@{person.handle}</Text> : null}
      </View>
      <Icon icon={iconMap.ChevronRight} size={16} color={th.colors.textSubtle} />
    </Pressable>
  )
}

export function EventHitRow({ cleanup }: { cleanup: CleanupDTO }) {
  const styles = useStyles()
  const join = useJoinCleanup(cleanup.id)
  const expanded = useLayoutMode() === "expanded"
  const { hovered, hoverProps } = useRowHover()
  const { locale } = useLocale()
  const when = useEventWhen(cleanup)
  const { day, month } = eventChip(cleanup.scheduledAt, locale, when.timeZone)
  const eventMeta = [when.dow, when.timeWithZone, cleanup.address?.trim()]
    .filter(Boolean)
    .join(" · ")
  return (
    <View {...hoverProps} style={[styles.row, webTransition, hovered ? styles.rowHovered : null]}>
      <Pressable
        onPress={() => pushCleanup(cleanup)}
        accessibilityRole="button"
        accessibilityLabel={cleanup.title}
        {...focusRingProps}
        style={(state) => [styles.eventTap, webTransition, state.pressed ? styles.pressed : null]}
      >
        <View style={styles.eventDate}>
          <Text style={styles.eventMonth}>{month}</Text>
          <Text style={styles.eventDay}>{day}</Text>
        </View>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle} numberOfLines={1}>{cleanup.title}</Text>
          <Text style={styles.rowDetail} numberOfLines={expanded ? 1 : 2}>{eventMeta}</Text>
        </View>
      </Pressable>
      <RsvpPill
        going={cleanup.joined}
        onToggle={(currentlyGoing) => join.mutate(currentlyGoing)}
        busy={join.isPending}
        ended={hasEventEnded(cleanup, Date.now())}
        nextPath={`/cleanups/${cleanup.id}`}
        size="sm"
      />
    </View>
  )
}

export function ReportHitRow({ report, viewer }: { report: ReportPinDTO; viewer: LatLng | null }) {
  const { t } = useT("home-sidebar")
  const { title, subtitle, thumbUrl } = reportHitRowModel({
    report,
    categoryLabel: t(`enums:category.${report.category}`),
    viewer,
  })
  return (
    <ReportRowView
      id={report.id}
      category={report.category}
      status={report.status}
      title={title}
      lat={report.lat}
      lng={report.lng}
      thumbUrl={thumbUrl}
      subtitle={subtitle}
      divider={false}
      card
    />
  )
}

interface SearchHits {
  events: readonly CleanupDTO[]
  reports: readonly ReportPinDTO[]
  people: readonly UserSearchResultDTO[]
}

const NO_HITS: SearchHits = { events: [], reports: [], people: [] }

export function SearchResults({ query: rawQuery }: { query: string }) {
  const styles = useStyles()
  const th = useTheme()
  const { ScrollView } = useScrollHost()
  const { t } = useT("home-sidebar")
  const { data: location } = useUserLocation()
  const { isAuthenticated } = useAuthState()
  const cleanupsQuery = useNearbyCleanups(SEARCH_EVENT_POOL_LIMIT, location ?? null)
  const debouncedQuery = useDebouncedValue(rawQuery, SEARCH_DEBOUNCE_MS)
  const peopleSearch = useUserSearch(rawQuery)
  const reportSearch = useReportSearch({ q: debouncedQuery })
  const peopleTerm = normalizeUserSearchTerm(rawQuery)
  const queryFresh = debouncedQuery === rawQuery

  const sources: SearchSourceState[] = [
    {
      enabled: true,
      matchesQuery: true,
      fetching: cleanupsQuery.isPending,
      errored: cleanupsQuery.isError,
    },
    {
      enabled: true,
      matchesQuery: queryFresh,
      fetching: reportSearch.isLoading,
      errored: reportSearch.isError,
    },
    {
      enabled: isAuthenticated && peopleTerm.length > 0,
      matchesQuery: peopleSearch.term === peopleTerm,
      fetching: peopleSearch.isPending,
      errored: peopleSearch.isError,
    },
  ]
  const settled = searchSourcesSettled(sources)

  const eventHits = useMemo(
    () => filterEventHits(cleanupsQuery.data ?? [], rawQuery),
    [cleanupsQuery.data, rawQuery],
  )
  const live: SearchHits = {
    events: eventHits,
    reports: reportSearch.items,
    people: peopleSearch.data?.results ?? [],
  }
  const liveCount = live.events.length + live.reports.length + live.people.length
  const heldRef = useRef<SearchHits>(NO_HITS)
  const selection = selectSearchHits(live, heldRef.current, liveCount, settled)
  if (selection.record) heldRef.current = live
  const hits = selection.hits
  const showMoreReports = hits === live && reportSearch.hasNextPage

  const groups = groupSearchResults(hits)
  const hitCount = groups.reduce((total, group) => total + group.count, 0)
  const view = searchResultsView(sources, hitCount)
  const emptyBody = t("search.no_matches", { query: rawQuery })

  const announcement = searchAnnouncement(view, rawQuery, hitCount)
  const announceKey = announcement?.key ?? null
  const announceMessage = announcement
    ? announcement.kind === "results"
      ? t("search.announce.results", { count: hitCount })
      : emptyBody
    : null
  const announcedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!announceKey || !announceMessage || announcedRef.current === announceKey) return
    announcedRef.current = announceKey
    announce(announceMessage)
  }, [announceKey, announceMessage])

  const onRetry = () => {
    if (peopleSearch.isError) void peopleSearch.refetch()
    if (reportSearch.isError) reportSearch.refetch()
    if (cleanupsQuery.isError) void cleanupsQuery.refetch()
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {view.showErrorNotice ? (
        <View style={styles.notice}>
          <Icon icon={iconMap.CloudOff} size={18} color={th.colors.textSubtle} />
          <Text style={styles.noticeText}>{t("search.error")}</Text>
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={t("search.retry")}
            {...focusRingProps}
            style={(state) => [styles.retryPill, state.pressed ? styles.pressed : null]}
          >
            <Text style={styles.retryText}>{t("search.retry")}</Text>
          </Pressable>
        </View>
      ) : null}
      {view.phase === "loading" ? (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={t("search.loading_a11y")}
          accessibilityLiveRegion="polite"
        >
          <SkeletonGroup>
            <View style={styles.sectionHeader}>
              <SkeletonText width="22%" height={11} />
            </View>
            <SkeletonList rows={2} kind="report" style={styles.group} />
            <View style={styles.sectionHeader}>
              <SkeletonText width="26%" height={11} />
            </View>
            <SkeletonList rows={3} kind="report" style={styles.group} />
            <View style={styles.sectionHeader}>
              <SkeletonText width="20%" height={11} />
            </View>
            <SkeletonList rows={2} kind="person" style={styles.group} />
          </SkeletonGroup>
        </View>
      ) : null}
      {view.phase === "error" ? (
        <EmptyState
          tone="neutral"
          icon={iconMap.CloudOff}
          iconColor={th.colors.textSubtle}
          iconSize={30}
          title={t("search.error_title")}
          body={t("search.error")}
          cta={{ label: t("search.retry"), onPress: onRetry, variant: "outline" }}
        />
      ) : null}
      {view.phase === "empty" ? (
        <EmptyState
          tone="neutral"
          icon={iconMap.Search}
          iconColor={th.colors.textSubtle}
          title={t("search.no_results_title")}
          body={emptyBody}
        />
      ) : null}
      {view.phase === "results" ? (
        <View accessibilityState={{ busy: !view.settled }}>
          {hits.events.length > 0 ? (
            <>
              <SectionHeader title={t("results.events")} />
              <View style={styles.group}>{hits.events.map((cleanup) => <EventHitRow key={cleanup.id} cleanup={cleanup} />)}</View>
            </>
          ) : null}
          {hits.reports.length > 0 ? (
            <>
              <SectionHeader title={t("results.reports")} />
              <View style={styles.group}>{hits.reports.map((report) => <ReportHitRow key={report.id} report={report} viewer={location ?? null} />)}</View>
              {showMoreReports ? (
                <Pressable
                  onPress={() => {
                    if (!reportSearch.isFetchingNextPage) void reportSearch.fetchNextPage()
                  }}
                  disabled={reportSearch.isFetchingNextPage}
                  accessibilityRole="button"
                  accessibilityLabel={t("results.load_more_reports")}
                  accessibilityState={{
                    disabled: reportSearch.isFetchingNextPage,
                    busy: reportSearch.isFetchingNextPage,
                  }}
                  {...focusRingProps}
                  style={(state) => [styles.morePill, state.pressed ? styles.pressed : null]}
                >
                  <Text style={styles.retryText}>
                    {reportSearch.isFetchingNextPage
                      ? t("results.loading_more")
                      : t("results.load_more_reports")}
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : null}
          {hits.people.length > 0 ? (
            <>
              <SectionHeader title={t("results.people")} />
              <View style={styles.group}>{hits.people.map((person) => <PersonHitRow key={person.id} person={person} />)}</View>
            </>
          ) : null}
        </View>
      ) : null}
      <View style={styles.bottomPad} />
    </ScrollView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  scroll: { flex: 1 },
  content: { paddingHorizontal: t.space["4"], paddingBottom: t.space["10"] },
  sectionHeader: { paddingTop: t.space["3"], paddingBottom: t.space["2"] },
  sectionTitle: { fontFamily: t.fontFamily.bodyExtraBold, fontSize: 11.5, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase", color: t.colors.textMuted },
  group: { gap: SEARCH_RESULT_CARD_LAYOUT.gap },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    minHeight: 64,
    paddingVertical: t.space["2"] + 2,
    paddingHorizontal: t.space["3"],
    borderRadius: SEARCH_RESULT_CARD_LAYOUT.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    ...t.shadows.s1,
  },
  rowHovered: { backgroundColor: t.colors.surfaceTint, borderColor: t.colors.borderStrong },
  eventTap: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    borderRadius: t.radius.md,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: t.fontFamily.bodyBold, fontSize: 14.5, lineHeight: 20, color: t.colors.text },
  rowDetail: { marginTop: 2, fontFamily: t.fontFamily.bodyRegular, fontSize: 12.5, lineHeight: 17, color: t.colors.textMuted },
  eventDate: { width: 46, height: 46, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: t.radius.md, backgroundColor: t.colors.sun["50"] },
  eventMonth: { fontFamily: t.fontFamily.bodyExtraBold, fontSize: 9, lineHeight: 11, letterSpacing: 0.7, color: t.colors.sun["700"] },
  eventDay: { fontFamily: t.fontFamily.displayBold, fontSize: 19, lineHeight: 21, color: t.colors.text },
  pressed: { opacity: 0.65 },
  notice: { flexDirection: "row", alignItems: "center", gap: t.space["3"], borderRadius: t.radius.md, backgroundColor: t.colors.bgAlt, padding: t.space["4"], marginBottom: t.space["2"] },
  noticeText: { flex: 1, fontFamily: t.fontFamily.bodyRegular, fontSize: 12.5, lineHeight: 17, color: t.colors.textMuted },
  retryPill: {
    flexShrink: 0,
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
  },
  morePill: {
    alignSelf: "center",
    minHeight: 44,
    justifyContent: "center",
    marginTop: t.space["2"],
    paddingHorizontal: t.space["4"],
    borderRadius: t.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  retryText: { color: t.colors.textMuted, fontFamily: t.fontFamily.bodyBold, fontSize: t.fontSize["13"], lineHeight: 18 },
  bottomPad: { height: t.space["8"] },
}))
