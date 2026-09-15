import React, { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { MAX_LINKED_REPORTS } from "@civfix/shared"
import type { LatLng } from "@civfix/shared/geocode"
import { makeThemedStyles, useTheme } from "../theme"
import { Text } from "../typography"
import { IconTile, ListRow, MetaDot, SkeletonGroup, SkeletonList } from "../primitives"
import { useNearbyReports, NEARBY_RADIUS_KM } from "../data"
import { useHaptics } from "../capabilities"
import { announce } from "../announce"
import { useT } from "../i18n"
import { FeedNotice } from "./FeedNotice"
import { ReportLinkRow } from "./ReportLinkRow"
import { ReportPicker } from "./reportPicker/ReportPicker"
import { cardToPin } from "./reportPicker/reportPickerModel"
import { pinToCardData, useLinkedReportCards } from "./linkedReportCards"
import {
  NEARBY_PREVIEW,
  nearbyReportRows,
  toggleLinkedReportId,
  type LinkBlockState,
} from "./linkReportsModel"

export interface ReportLinkPickerProps {
  value: readonly string[]
  onChange: (ids: string[]) => void
  center: LatLng | null
  state: LinkBlockState
  readonly?: boolean
}

export function ReportLinkPicker({
  value,
  onChange,
  center,
  state,
  readonly = false,
}: ReportLinkPickerProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-form")
  const haptics = useHaptics()
  const [picking, setPicking] = useState(false)

  const live = state === "ready" && !readonly
  const nearby = useNearbyReports(live ? center : null)
  const pins = useMemo(() => nearby.data ?? [], [nearby.data])
  const pinCards = useMemo(() => pins.map(pinToCardData), [pins])
  const cardById = useMemo(() => new Map(pinCards.map((card) => [card.id, card])), [pinCards])
  const cards = useLinkedReportCards((s) => s.cards)

  useEffect(() => {
    if (pinCards.length > 0) useLinkedReportCards.getState().put(pinCards)
  }, [pinCards])

  const rows = useMemo(
    () =>
      center
        ? nearbyReportRows(pins, center, value, NEARBY_RADIUS_KM).slice(0, NEARBY_PREVIEW)
        : [],
    [pins, center, value],
  )

  const knownPins = useMemo(
    () =>
      value
        .map((id) => cards[id])
        .filter((card): card is NonNullable<typeof card> => card !== undefined)
        .map(cardToPin),
    [value, cards],
  )

  const atLimit = value.length >= MAX_LINKED_REPORTS

  const toggle = useCallback(
    (id: string, title: string) => {
      const next = toggleLinkedReportId(value, id)
      if (next.outcome === "at_limit") return
      haptics.selection()
      onChange(next.ids)
      announce(
        t(next.outcome === "added" ? "linkedReports.added_announce" : "linkedReports.removed_announce", {
          title,
        }),
      )
    },
    [haptics, onChange, t, value],
  )

  const onPickerCommit = useCallback(
    (ids: string[]) => {
      onChange(ids)
      setPicking(false)
    },
    [onChange],
  )

  if (state === "hidden") return null

  return (
    <View style={styles.block}>
      <View style={styles.labelRow}>
        <Text style={styles.fieldLabel}>{t("linkedReports.label")}</Text>
        {readonly ? null : (
          <>
            <MetaDot color={th.colors.textSubtle} style={styles.labelDot} />
            <Text style={styles.optional}>{t("field.optional")}</Text>
          </>
        )}
        <View style={styles.labelSpacer} />
        {value.length > 0 ? (
          <Text style={styles.count}>{t("linkedReports.linked_count", { count: value.length })}</Text>
        ) : null}
      </View>

      <Text style={styles.fieldHelp}>{t("linkedReports.help")}</Text>

      {state === "pin_first" ? (
        <Text style={styles.fieldHelp}>{t("linkedReports.pin_first")}</Text>
      ) : (
        <>
          {value.length > 0 ? (
            <View style={styles.rows}>
              {value.map((id) => (
                <ReportLinkRow
                  key={id}
                  id={id}
                  center={center}
                  selected
                  disabled={readonly}
                  onToggle={toggle}
                />
              ))}
            </View>
          ) : null}

          {atLimit && !readonly ? (
            <Text style={styles.limit}>
              {t("linkedReports.limit_reached", { max: MAX_LINKED_REPORTS })}
            </Text>
          ) : null}

          {live ? (
            <>
              {nearby.isError ? (
                <FeedNotice
                  icon="CloudOff"
                  title={t("linkedReports.loadError")}
                  actionLabel={t("linkedReports.retry")}
                  onAction={() => void nearby.refetch()}
                />
              ) : nearby.isPending ? (
                <SkeletonGroup>
                  <SkeletonList kind="report" rows={NEARBY_PREVIEW} />
                </SkeletonGroup>
              ) : rows.length === 0 ? (
                <Text style={styles.fieldHelp}>{t("linkedReports.nearby_empty")}</Text>
              ) : (
                <View style={[styles.rows, nearby.isPlaceholderData ? styles.rowsStale : null]}>
                  <Text style={styles.eyebrow}>{t("linkedReports.nearby_heading")}</Text>
                  {rows.map((row) => (
                    <ReportLinkRow
                      key={row.pin.id}
                      id={row.pin.id}
                      center={center}
                      selected={false}
                      {...(cardById.get(row.pin.id) ? { card: cardById.get(row.pin.id) } : {})}
                      disabled={atLimit}
                      onToggle={toggle}
                    />
                  ))}
                </View>
              )}

              <ListRow
                leading={<IconTile icon="Map" />}
                title={t("linkedReports.pick_on_map")}
                sub={t("linkedReports.pick_on_map_sub")}
                accessibilityLabel={t("linkedReports.pick_on_map_a11y")}
                onPress={() => setPicking(true)}
                chevron
              />

              {picking ? (
                <ReportPicker
                  visible
                  mode="draft"
                  center={center}
                  value={value}
                  linked={knownPins}
                  onCommit={onPickerCommit}
                  onClose={() => setPicking(false)}
                />
              ) : null}
            </>
          ) : null}
        </>
      )}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  block: {
    gap: t.space["2"],
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  labelDot: {
    marginHorizontal: 6,
  },
  labelSpacer: {
    flex: 1,
  },
  fieldLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  optional: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  count: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textMuted,
  },
  fieldHelp: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    lineHeight: 16,
    color: t.colors.textSubtle,
  },
  limit: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.accentText,
  },
  eyebrow: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["12"],
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: t.colors.textSubtle,
  },
  rows: {
    gap: t.space["2"],
  },
  rowsStale: {
    opacity: 0.55,
  },
}))
