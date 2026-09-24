import React, { useCallback, useEffect, useMemo, useRef } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import type {
  CleanupDTO,
  LatLng,
  ReportPinDTO,
  UserSearchResultDTO,
} from "@civfix/shared"
import { eventChip } from "@civfix/shared/datetime"
import { announce } from "../../announce"
import { focusRingProps, makeThemedStyles, useTheme, useLayoutMode, webHover, webTransition, headingLevel, MIN_TOUCH_TARGET } from "../../theme"
import {
  Avatar,
  EmptyState,
  RsvpPill,
  SkeletonGroup,
  SkeletonList,
  SkeletonText,
} from "../../primitives"
import { DateTile } from "../../primitives/DateBadge"
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
  searchResultRows,
  searchResultsView,
  searchSourcesSettled,
  selectSearchHits,
  type SearchResultRow,
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
        <DateTile variant="searchHit" day={day} month={month} />
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

type ResultRow = SearchResultRow<CleanupDTO, ReportPinDTO, UserSearchResultDTO>

const NO_ROWS: readonly ResultRow[] = []

const rowKey = (row: ResultRow) => row.key

interface SearchHits {
  events: readonly CleanupDTO[]
  reports: readonly ReportPinDTO[]
  people: readonly UserSearchResultDTO[]
}

const NO_HITS: SearchHits = { events: [], reports: [], people: [] }

export function SearchResults({ query: rawQuery }: { query: string }) {
  const styles = useStyles()
  const th = useTheme()
  const { FlatList } = useScrollHost()
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

  const loadMoreReports = reportSearch.fetchNextPage
  const rows = searchResultRows(hits, {
    show: showMoreReports,
    loading: reportSearch.isFetchingNextPage,
  })
  const viewer = location ?? null
  const renderItem = useCallback(
    ({ item }: { item: ResultRow }) => {
      switch (item.kind) {
        case "header":
          return (
            <SectionHeader
              title={
                item.group === "events"
                  ? t("results.events")
                  : item.group === "reports"
                    ? t("results.reports")
                    : t("results.people")
              }
            />
          )
        case "event":
          return (
            <View style={item.gapBefore ? styles.hitGap : null}>
              <EventHitRow cleanup={item.event} />
            </View>
          )
        case "report":
          return (
            <View style={item.gapBefore ? styles.hitGap : null}>
              <ReportHitRow report={item.report} viewer={viewer} />
            </View>
          )
        case "more-reports":
          return <MoreReportsPill loading={item.loading} onLoadMore={loadMoreReports} />
        case "person":
          return (
            <View style={item.gapBefore ? styles.hitGap : null}>
              <PersonHitRow person={item.person} />
            </View>
          )
      }
    },
    [loadMoreReports, styles, t, viewer],
  )

  const phaseState =
    view.phase === "loading" ? (
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
    ) : view.phase === "error" ? (
      <EmptyState
        tone="neutral"
        icon={iconMap.CloudOff}
        iconColor={th.colors.textSubtle}
        iconSize={30}
        title={t("search.error_title")}
        body={t("search.error")}
        cta={{ label: t("search.retry"), onPress: onRetry, variant: "outline" }}
      />
    ) : view.phase === "empty" ? (
      <EmptyState
        tone="neutral"
        icon={iconMap.Search}
        iconColor={th.colors.textSubtle}
        title={t("search.no_results_title")}
        body={emptyBody}
      />
    ) : null

  return (
    <FlatList
      data={view.phase === "results" ? rows : NO_ROWS}
      keyExtractor={rowKey}
      renderItem={renderItem}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      accessibilityState={view.phase === "results" ? { busy: !view.settled } : undefined}
      ListHeaderComponent={
        view.showErrorNotice ? (
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
        ) : null
      }
      ListEmptyComponent={phaseState}
      ListFooterComponent={<View style={styles.bottomPad} />}
    />
  )
}

function MoreReportsPill({ loading, onLoadMore }: { loading: boolean; onLoadMore: () => void }) {
  const styles = useStyles()
  const { t } = useT("home-sidebar")
  return (
    <Pressable
      onPress={() => {
        if (!loading) onLoadMore()
      }}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={t("results.load_more_reports")}
      accessibilityState={{
        disabled: loading,
        busy: loading,
      }}
      {...focusRingProps}
      style={(state) => [styles.morePill, state.pressed ? styles.pressed : null]}
    >
      <Text style={styles.retryText}>
        {loading ? t("results.loading_more") : t("results.load_more_reports")}
      </Text>
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  scroll: { flex: 1 },
  content: { paddingHorizontal: t.space["4"], paddingBottom: t.space["10"] },
  sectionHeader: { paddingTop: t.space["3"], paddingBottom: t.space["2"] },
  sectionTitle: { fontFamily: t.fontFamily.bodyExtraBold, fontSize: 11.5, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase", color: t.colors.textMuted },
  group: { gap: SEARCH_RESULT_CARD_LAYOUT.gap },
  hitGap: { marginTop: SEARCH_RESULT_CARD_LAYOUT.gap },
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
    minHeight: MIN_TOUCH_TARGET,
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
