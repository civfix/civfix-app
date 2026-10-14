import React, { useCallback, useEffect, useRef, useState } from "react"
import { StyleSheet, View, useWindowDimensions } from "react-native"
import { haversineMeters, type ReportPinDTO } from "@civfix/shared"
import type { LatLng } from "@civfix/shared/geocode"
import { makeThemedStyles, useLayoutMode } from "../../theme"
import { ModalCardSheet } from "../../primitives"
import { useT } from "../../i18n"
import { ReportPickMap, type ReportPickMapHandle } from "../../map"
import { METERS_PER_MILE } from "../reportHitRowModel"
import { distanceLabel } from "../relativeTime"
import { LayerChipRow } from "./LayerChipRow"
import { PickerFooter } from "./PickerFooter"
import { PickerList } from "./PickerList"
import { PickerSearchField } from "./PickerSearchField"
import { useReportPickerFilters } from "./reportPickerFilterStore"
import { usePickerData } from "./usePickerData"
import { usePickerListScroll } from "./usePickerListScroll"
import { usePickerSelection } from "./usePickerSelection"
import {
  PICKER_RADIUS_M,
  PICKER_ZOOM,
  pinPresentation,
  pinState,
  pinStateKey,
  pinTapIntent,
  reportShortCode,
  type PickerMode,
  type PickerPinState,
} from "./reportPickerModel"

const PANE_WIDTH = 420
const COMPACT_MAP_RATIO = 0.4
const COMPACT_MAP_MIN = 200

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
  const { height: windowHeight } = useWindowDimensions()
  const expanded = useLayoutMode() === "expanded"
  const { t } = useT("report-picker")
  const { t: tEnums } = useT("enums")
  const mapRef = useRef<ReportPickMapHandle>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  const toggleLayer = useReportPickerFilters((s) => s.toggle)
  const setAllLayers = useReportPickerFilters((s) => s.setAll)
  const clearLayers = useReportPickerFilters((s) => s.clearAll)
  const setNearbyOnly = useReportPickerFilters((s) => s.setNearbyOnly)

  const { idSet, linkedSet, diff, action, atLimit, toggle, clear, commit } = usePickerSelection({
    value,
    mode,
    busy,
    onCommit,
    onClose,
  })
  const data = usePickerData({ center, linked, query, idSet, linkedSet })
  const { pinById } = data
  const { listRef, scrollToRow, onItemLayout } = usePickerListScroll(data.allItems, data.revealRow)

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

  useEffect(() => registerCommit(commit), [commit, registerCommit])

  const footer = (
    <PickerFooter
      mode={mode}
      expanded={expanded}
      error={error}
      diff={diff}
      atLimit={atLimit}
      action={action}
      busy={busy}
      onClear={clear}
      onCommit={commit}
    />
  )

  const mapHeight = Math.max(COMPACT_MAP_MIN, Math.round(windowHeight * COMPACT_MAP_RATIO))

  const searchField = <PickerSearchField query={query} onChangeQuery={setQuery} expanded={expanded} />

  const map = (
    <ReportPickMap
      ref={mapRef}
      center={center}
      radiusM={PICKER_RADIUS_M}
      zoom={PICKER_ZOOM}
      pins={data.mapPins}
      stateOf={stateOf}
      focusedId={focusedId}
      lookFor={pinPresentation}
      pinLabel={pinLabel}
      clusterLabel={clusterLabel}
      mapLabel={t("map_a11y")}
      meetingPointLabel={t("meeting_point_a11y")}
      onPressPin={onPressPin}
      onPressMap={() => setFocusedId(null)}
      onRegionChange={data.onRegionChange}
    />
  )

  const chips = (
    <LayerChipRow
      enabled={data.enabled}
      counts={data.counts}
      nearbyOnly={data.nearbyOnly}
      onToggle={toggleLayer}
      onAll={setAllLayers}
      onClear={clearLayers}
      onNearbyOnly={setNearbyOnly}
    />
  )

  const list = (
    <PickerList
      listRef={listRef}
      listState={data.listState}
      items={data.items}
      mode={mode}
      focusedId={focusedId}
      atLimit={atLimit}
      query={data.debounced}
      more={data.more}
      shown={data.shown}
      total={data.total}
      onPressRow={onPressRow}
      onItemLayout={onItemLayout}
      onLoadMore={data.onLoadMore}
      onRetry={data.retry}
    />
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
  listArea: {
    flex: 1,
    minHeight: 0,
  },
}))
