import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import { MAX_LINKED_REPORTS, haversineMeters, type BBox, type ReportPinDTO } from "@civfix/shared"
import type { LatLng } from "@civfix/shared/geocode"
import {
  focusRingProps,
  makeThemedStyles,
  useLayoutMode,
  useTheme,
  webCursorPointer,
  webInputReset,
} from "../../theme"
import { Text, TextLink, Icon, iconMap } from "../../typography"
import {
  ModalCardSheet,
  PrimaryButton,
  SkeletonGroup,
  SkeletonList,
  TextInput,
} from "../../primitives"
import { useScrollHost, type ScrollHostListHandle } from "../../shell/ScrollHost"
import { useMapReports, useReport, useReportSearch } from "../../data"
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../../data/hooks/useDebouncedValue"
import { useHaptics } from "../../capabilities"
import { announce } from "../../announce"
import { useT } from "../../i18n"
import { ReportPickMap, type ReportPickMapHandle } from "../../map"
import { FeedNotice } from "../FeedNotice"
import { appErrorCode } from "../errorCode"
import { pinToCardData, reportToCardData, useLinkedReportCards } from "../linkedReportCards"
import { METERS_PER_MILE } from "../reportHitRowModel"
import { distanceLabel } from "../relativeTime"
import { LayerChipRow } from "./LayerChipRow"
import { PickerReportRow } from "./PickerReportRow"
import { useReportPickerFilters } from "./reportPickerFilterStore"
import {
  PICKER_PAGE_FIRST,
  PICKER_PAGE_STEP,
  PICKER_RADIUS_M,
  PICKER_SEARCH_MIN_CHARS,
  PICKER_ZOOM,
  cardToPin,
  categoryCounts,
  footerRemovedKey,
  isSearching,
  keptPinIds,
  loadMoreState,
  mapPinsFor,
  mergePins,
  nextPageSize,
  pickerAction,
  pickerFetchRegion,
  pickerListItems,
  pickerListState,
  pickerQueryFailures,
  pickerRows,
  pickerSections,
  pinPresentation,
  pinState,
  pinStateKey,
  pinTapIntent,
  reportLookupKey,
  reportShortCode,
  rowIndexOf,
  rowOrdinalOf,
  selectionDiff,
  shouldRefetch,
  togglePickerId,
  type PickerListItem,
  type PickerMode,
  type PickerPinState,
} from "./reportPickerModel"

const PANE_WIDTH = 420
const COMPACT_MAP_RATIO = 0.4
const COMPACT_MAP_MIN = 200
const ROW_GAP = 8
const ESTIMATED_ROW_HEIGHT = 84
const ESTIMATED_HEADER_HEIGHT = 30
const ROW_REVEAL_INSET = 72

export interface ReportPickerProps {
  visible: boolean
  mode: PickerMode
  center: LatLng | null
  value: readonly string[]
  linked: readonly ReportPinDTO[]
  onCommit: (ids: string[]) => void
  onClose: () => void
  busy?: boolean
  error?: string | null
}

export function ReportPicker(props: ReportPickerProps) {
  const { visible, center, onClose, onCommit, mode, busy = false, error = null } = props
  const { t } = useT("report-picker")
  const [openCount, setOpenCount] = useState(visible ? 1 : 0)
  const wasVisibleRef = useRef(visible)
  useEffect(() => {
    if (visible && !wasVisibleRef.current) setOpenCount((n) => n + 1)
    wasVisibleRef.current = visible
  }, [visible])

  const commitRef = useRef<() => void>(() => undefined)
  const registerCommit = useCallback((commit: () => void) => {
    commitRef.current = commit
  }, [])

  return (
    <ModalCardSheet
      visible={visible && center !== null}
      onClose={onClose}
      onCommit={() => commitRef.current()}
      headerIcon="Map"
      title={mode === "commit" ? t("title_commit") : t("title_draft")}
      dismissLabel={t("close_a11y")}
      backdropDismissDisabled={busy}
      bodyLayout="fill"
      fullBleed
      actions={null}
    >
      {center ? (
        <ReportPickerSurface
          key={openCount}
          mode={mode}
          center={center}
          value={props.value}
          linked={props.linked}
          onCommit={onCommit}
          onClose={onClose}
          busy={busy}
          error={error}
          registerCommit={registerCommit}
        />
      ) : null}
    </ModalCardSheet>
  )
}

interface SurfaceProps {
  mode: PickerMode
  center: LatLng
  value: readonly string[]
  linked: readonly ReportPinDTO[]
  onCommit: (ids: string[]) => void
  onClose: () => void
  busy: boolean
  error: string | null
  registerCommit: (commit: () => void) => void
}

interface PageState {
  key: string
  visible: number
}

function ReportPickerSurface({
  mode,
  center,
  value,
  linked,
  onCommit,
  onClose,
  busy,
  error,
  registerCommit,
}: SurfaceProps) {
  const styles = useStyles()
  const th = useTheme()
  const insets = useContext(SafeAreaInsetsContext)
  const { height: windowHeight } = useWindowDimensions()
  const layout = useLayoutMode()
  const expanded = layout === "expanded"
  const { t } = useT("report-picker")
  const { t: tEnums } = useT("enums")
  const { t: tForm } = useT("event-form")
  const haptics = useHaptics()
  const { FlatList } = useScrollHost()
  const mapRef = useRef<ReportPickMapHandle>(null)
  const listRef = useRef<ScrollHostListHandle>(null)
  const heightsRef = useRef<Map<string, number>>(new Map())

  const baselineRef = useRef<readonly string[]>(value)
  const linkedSet = useMemo(() => new Set(baselineRef.current), [])
  const [ids, setIds] = useState<string[]>(() => [...baselineRef.current])
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)
  const [viewport, setViewport] = useState<BBox | null>(null)
  const [fetchRegion, setFetchRegion] = useState<BBox | null>(null)
  const [tooWide, setTooWide] = useState(false)
  const [page, setPage] = useState<PageState>({ key: "", visible: PICKER_PAGE_FIRST })

  useLayoutEffect(() => {
    useReportPickerFilters.getState().reset()
  }, [])

  const enabled = useReportPickerFilters((s) => s.enabled)
  const nearbyOnly = useReportPickerFilters((s) => s.nearbyOnly)
  const toggleLayer = useReportPickerFilters((s) => s.toggle)
  const setAllLayers = useReportPickerFilters((s) => s.setAll)
  const clearLayers = useReportPickerFilters((s) => s.clearAll)
  const setNearbyOnly = useReportPickerFilters((s) => s.setNearbyOnly)

  const idSet = useMemo(() => new Set(ids), [ids])

  const region = useMapReports({ bbox: fetchRegion, enabled: fetchRegion !== null })
  const debounced = useDebouncedValue(query, SEARCH_DEBOUNCE_MS)
  const typed = isSearching(debounced)
  const searching = debounced.trim().length >= PICKER_SEARCH_MIN_CHARS
  const search = useReportSearch({ q: debounced }, { enabled: searching })
  const lookupKey = reportLookupKey(debounced)
  const lookup = useReport(lookupKey ?? undefined)

  const fetchedPins = useMemo(
    () => (Array.isArray(region.data?.pins) ? region.data.pins.filter((p) => p != null) : []),
    [region.data],
  )
  const lookupPins = useMemo(
    () => (lookupKey && lookup.data ? [cardToPin(reportToCardData(lookup.data))] : []),
    [lookupKey, lookup.data],
  )
  const pins = useMemo(
    () => mergePins(linked, fetchedPins, searching ? search.items : [], lookupPins),
    [linked, fetchedPins, searching, search.items, lookupPins],
  )

  useEffect(() => {
    if (pins.length > 0) useLinkedReportCards.getState().put(pins.map(pinToCardData))
  }, [pins])

  const filter = useMemo(
    () => ({
      center,
      categories: enabled,
      nearbyOnly,
      radiusM: PICKER_RADIUS_M,
      query: debounced,
    }),
    [center, enabled, nearbyOnly, debounced],
  )

  const rows = useMemo(
    () => pickerRows({ ...filter, pins, viewport, ids: idSet, linked: linkedSet }),
    [filter, pins, viewport, idSet, linkedSet],
  )
  const sections = useMemo(() => pickerSections(rows), [rows])
  const pageKey = `${debounced.trim().toLowerCase()}|${[...enabled].sort().join(",")}|${nearbyOnly ? 1 : 0}`
  const visible = page.key === pageKey ? page.visible : PICKER_PAGE_FIRST
  const allItems = useMemo(() => pickerListItems(sections).items, [sections])
  const { items, shown, total } = useMemo(() => pickerListItems(sections, visible), [sections, visible])
  const counts = useMemo(() => categoryCounts(pins, viewport), [pins, viewport])
  const chosenSet = useMemo(() => new Set([...linkedSet, ...idSet]), [linkedSet, idSet])
  const keepKey = useMemo(
    () => keptPinIds(pins, chosenSet, filter).join(","),
    [pins, chosenSet, filter],
  )
  const keepSet = useMemo(() => new Set(keepKey ? keepKey.split(",") : []), [keepKey])
  const mapPins = useMemo(() => mapPinsFor(pins, keepSet, filter), [pins, keepSet, filter])
  const pinById = useMemo(() => new Map(pins.map((pin) => [pin.id, pin])), [pins])

  const stateOf = useCallback(
    (id: string): PickerPinState => pinState(id, idSet, linkedSet),
    [idSet, linkedSet],
  )

  const pinLabel = useCallback(
    (pin: ReportPinDTO, state: PickerPinState) => {
      const category = tEnums(`category.${pin.category}`)
      const title = pin.title?.trim() || category
      const code = reportShortCode(pin)
      const distance = distanceLabel(haversineMeters(center, pin) / METERS_PER_MILE)
      if (state === "idle") return t("pin_a11y", { title, category, code, distance })
      return t("pin_a11y_state", {
        title,
        category,
        code,
        distance,
        state: t(`pin_state_${pinStateKey(state, mode)}`),
      })
    },
    [center, mode, t, tEnums],
  )
  const clusterLabel = useCallback((count: number) => t("cluster_a11y", { count }), [t])

  const diff = useMemo(() => selectionDiff(ids, linkedSet), [ids, linkedSet])
  const action = pickerAction(mode, diff, busy)
  const atLimit = ids.length >= MAX_LINKED_REPORTS

  const revealRow = useCallback(
    (id: string) => {
      const ordinal = rowOrdinalOf(allItems, id)
      if (ordinal >= visible) setPage({ key: pageKey, visible: ordinal + 1 })
    },
    [allItems, pageKey, visible],
  )

  const scrollToRow = useCallback(
    (id: string) => {
      const index = rowIndexOf(allItems, id)
      if (index < 0) return
      revealRow(id)
      let offset = 0
      for (let i = 0; i < index; i++) {
        const item = allItems[i]!
        const measured = heightsRef.current.get(item.key)
        offset +=
          (measured ?? (item.kind === "header" ? ESTIMATED_HEADER_HEIGHT : ESTIMATED_ROW_HEIGHT)) +
          ROW_GAP
      }
      listRef.current?.scrollToOffset?.({ offset: Math.max(0, offset - ROW_REVEAL_INSET), animated: true })
    },
    [allItems, revealRow],
  )

  const toggle = useCallback(
    (id: string, title: string) => {
      const next = togglePickerId(ids, id)
      if (next.outcome === "at_limit") {
        announce(t("limit_reached", { max: MAX_LINKED_REPORTS }), { priority: "assertive" })
        return
      }
      haptics.selection()
      setIds(next.ids)
      announce(
        tForm(
          next.outcome === "added"
            ? "linkedReports.added_announce"
            : "linkedReports.removed_announce",
          { title },
        ),
      )
    },
    [haptics, ids, t, tForm],
  )

  const titleOf = useCallback(
    (pin: ReportPinDTO) => pin.title?.trim() || tEnums(`category.${pin.category}`),
    [tEnums],
  )

  const onPressPin = useCallback(
    (id: string) => {
      const pin = pinById.get(id)
      if (!pin) return
      if (pinTapIntent(id, focusedId) === "toggle") {
        toggle(id, titleOf(pin))
        return
      }
      setFocusedId(id)
      scrollToRow(id)
    },
    [focusedId, pinById, scrollToRow, titleOf, toggle],
  )

  const onPressRow = useCallback(
    (id: string, title: string) => {
      toggle(id, title)
      setFocusedId(id)
      const pin = pinById.get(id)
      if (pin) mapRef.current?.flyTo(pin.lat, pin.lng)
    },
    [pinById, toggle],
  )

  const onRegionChange = useCallback((bbox: BBox) => {
    setViewport(bbox)
    const next = pickerFetchRegion(bbox)
    setTooWide(next === null)
    setFetchRegion((loaded) => (next !== null && shouldRefetch(bbox, loaded) ? next : loaded))
  }, [])

  const commit = useCallback(() => {
    if (busy) return
    if (diff.dirty) onCommit(ids)
    else onClose()
  }, [busy, diff.dirty, ids, onClose, onCommit])

  const failed = pickerQueryFailures({
    regionError: region.isError,
    searching,
    searchError: search.isError,
    lookupActive: lookupKey !== null,
    lookupError: lookup.isError,
    lookupErrorCode: appErrorCode(lookup.error),
  })
  const listState = pickerListState({
    hasRegion: !tooWide,
    pending:
      region.isPending || (searching && search.isLoading) || (lookupKey !== null && lookup.isLoading),
    error: failed.region || failed.search || failed.lookup,
    searching: typed,
    pinCount: pins.length,
    layerCount: enabled.size,
    rowCount: items.length,
  })

  const more = loadMoreState({
    shown,
    total,
    searching,
    hasNextPage: search.hasNextPage,
    fetchingNextPage: search.isFetchingNextPage,
  })

  const onLoadMore = useCallback(() => {
    if (more === "more") {
      const next = nextPageSize(shown, total)
      setPage({ key: pageKey, visible: next })
      announce(t("load_more_announce", { count: next - shown }))
      return
    }
    if (more === "fetch") search.fetchNextPage()
  }, [more, pageKey, search, shown, t, total])

  const summary =
    diff.selected > 0 ? t("footer_selected", { count: diff.selected }) : t("footer_none")
  const removedText =
    diff.removed > 0 ? t(footerRemovedKey(mode), { count: diff.removed }) : null

  useEffect(() => registerCommit(commit), [commit, registerCommit])

  const footer = (
    <View style={[styles.footer, { paddingBottom: (expanded ? 0 : (insets?.bottom ?? 0)) + th.space["3"] }]}>
      {error ? (
        <Text variant="caption" color={th.colors.bloom["600"]} numberOfLines={2} style={styles.footerError}>
          {error}
        </Text>
      ) : null}
      <View style={styles.footerRow}>
        <View style={styles.footerMeta}>
          <Text style={styles.footerSummary} numberOfLines={1}>
            {summary}
            {removedText ? ` · ${removedText}` : ""}
          </Text>
          {atLimit ? (
            <Text style={styles.footerLimit} numberOfLines={2}>
              {t("limit_reached", { max: MAX_LINKED_REPORTS })}
            </Text>
          ) : diff.selected > 0 ? (
            <TextLink
              variant="label"
              standalone
              accessibilityLabel={t("footer_clear_a11y")}
              onPress={() => setIds([])}
            >
              {t("footer_clear")}
            </TextLink>
          ) : null}
        </View>
        <PrimaryButton
          label={t(action.key, { count: action.count })}
          onPress={commit}
          loading={busy}
          disabled={!action.enabled}
        />
      </View>
    </View>
  )

  const onItemLayout = useCallback((key: string, event: LayoutChangeEvent) => {
    heightsRef.current.set(key, event.nativeEvent.layout.height)
  }, [])

  const renderItem = useCallback(
    ({ item }: { item: PickerListItem }) => {
      if (item.kind === "header") {
        return (
          <Text style={styles.sectionHeader} onLayout={(e) => onItemLayout(item.key, e)}>
            {t(
              item.place === "linked" && mode === "draft" ? "section_added" : `section_${item.place}`,
              { count: item.count },
            )}
          </Text>
        )
      }
      return (
        <View onLayout={(e) => onItemLayout(item.key, e)}>
          <PickerReportRow
            row={item.row}
            mode={mode}
            focused={focusedId === item.row.pin.id}
            atLimit={atLimit}
            onPress={onPressRow}
          />
        </View>
      )
    },
    [atLimit, focusedId, mode, onItemLayout, onPressRow, styles.sectionHeader, t],
  )

  const listFooter =
    more === "hidden" ? null : (
      <View style={styles.loadMore}>
        <PrimaryButton
          variant="outline"
          label={t("load_more", { count: PICKER_PAGE_STEP })}
          accessibilityLabel={t("load_more_a11y", { count: PICKER_PAGE_STEP, shown, total })}
          onPress={onLoadMore}
          loading={more === "loading"}
          disabled={more === "loading"}
        />
      </View>
    )

  const mapHeight = Math.max(COMPACT_MAP_MIN, Math.round(windowHeight * COMPACT_MAP_RATIO))

  const searchField = (
    <View style={[styles.search, searchFocused ? styles.searchFocused : null, expanded ? styles.searchPane : styles.searchFloat]}>
      <Icon icon={iconMap.Search} size={16} color={th.colors.textSubtle} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t("search_placeholder")}
        placeholderTextColor={th.colors.textSubtle}
        accessibilityLabel={t("search_a11y")}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onFocus={() => setSearchFocused(true)}
        onBlur={() => setSearchFocused(false)}
        style={[webInputReset, styles.searchInput]}
      />
      {query.length > 0 ? (
        <Pressable
          onPress={() => setQuery("")}
          accessibilityRole="button"
          accessibilityLabel={t("search_clear_a11y")}
          hitSlop={8}
          {...focusRingProps}
          style={webCursorPointer}
        >
          <Icon icon={iconMap.Close} size={16} color={th.colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  )

  const map = (
    <ReportPickMap
      ref={mapRef}
      center={center}
      radiusM={PICKER_RADIUS_M}
      zoom={PICKER_ZOOM}
      pins={mapPins}
      stateOf={stateOf}
      focusedId={focusedId}
      lookFor={pinPresentation}
      pinLabel={pinLabel}
      clusterLabel={clusterLabel}
      mapLabel={t("map_a11y")}
      meetingPointLabel={t("meeting_point_a11y")}
      onPressPin={onPressPin}
      onPressMap={() => setFocusedId(null)}
      onRegionChange={onRegionChange}
    />
  )

  const chips = (
    <LayerChipRow
      enabled={enabled}
      counts={counts}
      nearbyOnly={nearbyOnly}
      onToggle={toggleLayer}
      onAll={setAllLayers}
      onClear={clearLayers}
      onNearbyOnly={setNearbyOnly}
    />
  )

  const list =
    listState === "rows" ? (
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item: PickerListItem) => item.key}
        renderItem={renderItem}
        extraData={focusedId}
        ListFooterComponent={listFooter}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      />
    ) : (
      <View style={styles.stateBox}>
        {listState === "loading" ? (
          <SkeletonGroup>
            <SkeletonList kind="report" rows={3} />
          </SkeletonGroup>
        ) : listState === "error" ? (
          <FeedNotice
            icon="CloudOff"
            title={t("load_error")}
            actionLabel={t("retry")}
            onAction={() => {
              if (failed.region) void region.refetch()
              if (failed.search) search.refetch()
              if (failed.lookup) void lookup.refetch()
            }}
          />
        ) : (
          <Text style={styles.stateText}>
            {listState === "no_match"
              ? t("no_match", { query: debounced.trim() })
              : listState === "too_wide"
                ? t("zoom_in")
                : listState === "no_layers"
                  ? t("empty_layers")
                  : t("empty_view")}
          </Text>
        )}
      </View>
    )

  if (expanded) {
    return (
      <View style={styles.rowLayout}>
        <View style={styles.mapPaneWide}>{map}</View>
        <View style={styles.sidePane}>
          {searchField}
          {chips}
          <View style={styles.listArea}>{list}</View>
          {footer}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.column}>
      <View style={[styles.mapPane, { height: mapHeight }]}>
        {map}
        {searchField}
      </View>
      {chips}
      <View style={styles.listArea}>{list}</View>
      {footer}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  column: {
    flex: 1,
    minHeight: 0,
    backgroundColor: t.colors.bg,
  },
  rowLayout: {
    flex: 1,
    minHeight: 0,
    flexDirection: "row",
  },
  mapPane: {
    width: "100%",
    backgroundColor: t.colors.bgAlt,
  },
  mapPaneWide: {
    flex: 1,
    minWidth: 0,
    backgroundColor: t.colors.bgAlt,
  },
  sidePane: {
    width: PANE_WIDTH,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: t.colors.border,
    backgroundColor: t.colors.bg,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    minHeight: 42,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  searchFloat: {
    position: "absolute",
    top: t.space["3"],
    left: t.space["3"],
    right: t.space["3"],
    ...t.shadows.s2,
  },
  searchPane: {
    marginHorizontal: t.space["3"],
    marginTop: t.space["3"],
    backgroundColor: t.colors.surfaceTint,
  },
  searchFocused: {
    borderColor: t.colors.accent,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: t.space["2"],
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  listArea: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    paddingHorizontal: t.space["3"],
    paddingBottom: t.space["3"],
    gap: ROW_GAP,
  },
  loadMore: {
    alignItems: "center",
    paddingTop: t.space["1"],
  },
  sectionHeader: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["12"],
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: t.colors.textSubtle,
    paddingTop: t.space["2"],
  },
  stateBox: {
    flex: 1,
    padding: t.space["4"],
    gap: t.space["3"],
  },
  stateText: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    lineHeight: 18,
    color: t.colors.textSubtle,
    textAlign: "center",
    paddingTop: t.space["4"],
  },
  footer: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["3"],
    gap: t.space["2"],
    backgroundColor: t.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  footerError: {
    fontFamily: t.fontFamily.bodySemiBold,
  },
  footerMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  footerSummary: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.text,
  },
  footerLimit: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.accentText,
  },
}))
