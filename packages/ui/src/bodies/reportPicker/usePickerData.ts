import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react"
import type { BBox, ReportPinDTO } from "@civfix/shared"
import type { LatLng } from "@civfix/shared/geocode"
import { useMapReports, useReport, useReportSearch } from "../../data"
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../../data/hooks/useDebouncedValue"
import { appErrorCode } from "../../data/errorCode"
import { announce } from "../../announce"
import { useT } from "../../i18n"
import { pinToCardData, reportToCardData, useLinkedReportCards } from "../linkedReportCards"
import { useReportPickerFilters } from "./reportPickerFilterStore"
import {
  PICKER_PAGE_FIRST,
  PICKER_RADIUS_M,
  PICKER_SEARCH_MIN_CHARS,
  cardToPin,
  categoryCounts,
  isSearching,
  keptPinIds,
  loadMoreState,
  mapPinsFor,
  mergePins,
  nextPageSize,
  pickerFetchRegion,
  pickerListItems,
  pickerListState,
  pickerQueryFailures,
  pickerRows,
  pickerSections,
  reportLookupKey,
  rowOrdinalOf,
  shouldRefetch,
} from "./reportPickerModel"

interface PageState {
  key: string
  visible: number
}

export function usePickerData({
  center,
  linked,
  query,
  idSet,
  linkedSet,
}: {
  center: LatLng
  linked: readonly ReportPinDTO[]
  query: string
  idSet: ReadonlySet<string>
  linkedSet: ReadonlySet<string>
}) {
  const { t } = useT("report-picker")
  const [viewport, setViewport] = useState<BBox | null>(null)
  const [fetchRegion, setFetchRegion] = useState<BBox | null>(null)
  const [tooWide, setTooWide] = useState(false)
  const [page, setPage] = useState<PageState>({ key: "", visible: PICKER_PAGE_FIRST })

  useLayoutEffect(() => {
    useReportPickerFilters.getState().reset()
  }, [])

  const enabled = useReportPickerFilters((s) => s.enabled)
  const nearbyOnly = useReportPickerFilters((s) => s.nearbyOnly)

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

  const revealRow = useCallback(
    (id: string) => {
      const ordinal = rowOrdinalOf(allItems, id)
      if (ordinal >= visible) setPage({ key: pageKey, visible: ordinal + 1 })
    },
    [allItems, pageKey, visible],
  )

  const onRegionChange = useCallback((bbox: BBox) => {
    setViewport(bbox)
    const next = pickerFetchRegion(bbox)
    setTooWide(next === null)
    setFetchRegion((loaded) => (next !== null && shouldRefetch(bbox, loaded) ? next : loaded))
  }, [])

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

  const retry = () => {
    if (failed.region) void region.refetch()
    if (failed.search) search.refetch()
    if (failed.lookup) void lookup.refetch()
  }

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

  return {
    debounced,
    enabled,
    nearbyOnly,
    pins,
    counts,
    mapPins,
    pinById,
    allItems,
    items,
    shown,
    total,
    listState,
    more,
    revealRow,
    onRegionChange,
    onLoadMore,
    retry,
  }
}
