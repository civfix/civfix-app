import { useState } from "react"
import { Image, Pressable, ScrollView as RNScrollView, StyleSheet, View } from "react-native"
import type { LatLng, ReportPinDTO } from "@civfix/contract"
import { categoryColor, focusRingProps, makeThemedStyles, useTheme, wash, webHover, webTransition } from "../../theme"
import { Icon, Text, iconMap } from "../../typography"
import { CATEGORY_ICONS, MetaDot } from "../../primitives"
import { useNavStore } from "../../nav"
import { useT } from "../../i18n"
import { reportHitRowModel } from "../reportHitRowModel"
import { reportCountsLine } from "../reportCountsLine"
import { SEARCH_RESULT_CARD_LAYOUT } from "./searchResultsModel"
import { useSearchStyles } from "./searchStyles"

// Cards aim for this width and the rail fits as many as it can, plus a peek of the next one so it reads as scrollable.
const CARD_TARGET_WIDTH = 248
const PEEK = 0.35
const CARD_MEDIA_ASPECT = 1.9

function railCardWidth(railWidth: number, gap: number, inset: number, count: number): number {
  const usable = railWidth - inset
  const whole = Math.max(1, Math.floor(usable / CARD_TARGET_WIDTH))
  // A lone card on a phone takes the row rather than peeking at nothing.
  if (count === 1 && whole === 1) return usable
  return (usable - gap * whole) / (whole + PEEK)
}

function PressingCard({ report, viewer, width }: { report: ReportPinDTO; viewer: LatLng | null; width: number }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("home-sidebar")
  const category = t(`enums:category.${report.category}`)
  const { title, distance, thumbUrl } = reportHitRowModel({ report, categoryLabel: category, viewer })
  const cat = categoryColor(report.category, th.scheme)
  const counts = reportCountsLine(t, report)
  return (
    <Pressable
      onPress={() => useNavStore.getState().push({ kind: "pin", id: report.id, lat: report.lat, lng: report.lng })}
      accessibilityRole="button"
      accessibilityLabel={counts ? `${title}, ${counts}` : title}
      {...focusRingProps}
      style={(state) => [
        styles.card,
        { width },
        th.shadows.s1,
        webTransition,
        webHover(state) ? styles.cardHovered : null,
        state.pressed ? styles.cardPressed : null,
      ]}
    >
      <View style={[styles.media, { backgroundColor: wash(cat, 0.84, th) }]}>
        {thumbUrl ? (
          <Image source={{ uri: thumbUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Icon icon={CATEGORY_ICONS[report.category]} size={36} color={cat} />
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta} numberOfLines={1}>
            {category}
          </Text>
          {distance ? (
            <>
              <MetaDot color={th.colors.textSubtle} />
              <Text style={styles.meta} numberOfLines={1}>
                {distance}
              </Text>
            </>
          ) : null}
        </View>
        {counts ? (
          <View style={styles.countRow}>
            <Icon icon={iconMap.Users} size={14} color={th.colors.textMuted} />
            <Text style={styles.count} numberOfLines={2}>
              {counts}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

/** "Most pressing nearby" as a horizontal rail of cards, so ten reports cost one card's height. */
export function PressingRail({ reports, viewer }: { reports: readonly ReportPinDTO[]; viewer: LatLng | null }) {
  const search = useSearchStyles()
  const styles = useStyles()
  const th = useTheme()
  const [railWidth, setRailWidth] = useState(0)
  const width = railCardWidth(railWidth, th.space["3"], th.space["4"] * 2, reports.length)
  return (
    <RNScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(e) => setRailWidth(e.nativeEvent.layout.width)}
      style={[search.personRail, styles.rail]}
      contentContainerStyle={styles.railContent}
    >
      {railWidth > 0
        ? reports.map((report) => <PressingCard key={report.id} report={report} viewer={viewer} width={width} />)
        : null}
    </RNScrollView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  // The scroller clips on every side, so the cards keep at least a focus ring's footprint inside it; the
  // negative margin cancels the top padding so the rail sits where it would without it.
  rail: { marginTop: -t.space["1"] },
  // The gap and the inset are the ones railCardWidth sizes the cards with.
  railContent: {
    alignItems: "stretch",
    gap: t.space["3"],
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["1"],
  },
  card: {
    borderRadius: SEARCH_RESULT_CARD_LAYOUT.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    overflow: "hidden",
  },
  cardHovered: { backgroundColor: t.colors.surfaceTint, borderColor: t.colors.borderStrong },
  cardPressed: { opacity: 0.85 },
  media: { aspectRatio: CARD_MEDIA_ASPECT, alignItems: "center", justifyContent: "center" },
  body: { padding: t.space["3"], gap: t.space["1"], flex: 1 },
  title: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: t.space["1"] },
  meta: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  countRow: { flexDirection: "row", alignItems: "center", gap: t.space["1"], marginTop: "auto" },
  count: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
}))
