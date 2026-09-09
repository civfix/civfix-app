/**
 * ReportLinkPanel - the small inline card that opens next to a badged report marker while a cleanup is
 * being hosted/edited (the event-link map mode). Tapping a "+" / "check" pin no longer jumps straight to
 * the full report detail; instead this compact panel is anchored beside that marker so the host can peek
 * at the report (a small horizontal photo gallery + the description) and decide, then either:
 *   - "View report details" -> the shell's existing pin-detail navigation (onViewDetails), or
 *   - Add this report / Remove -> the SAME link mutation the pin badge already drives, flowing only
 *     through useEventReportLink.toggle so the pin badge flips plus <-> check via the selection mirror.
 *
 * Pure RN primitives so it renders on web via react-native-web AND on native unchanged. The two seam maps
 * (Map.web.tsx / Map.native.tsx) own the POSITIONING (anchoring it to the marker's screen point); this
 * component owns only the content + actions. Data comes from useReport(reportId) (GET /reports/:id) for the
 * ready media + description; while loading it shows a spinner. The styling cues mirror LinkedReportCard
 * (surface card, hairline border, s2 shadow) and the LocationPicker.web overlay (stacked actions).
 *
 * Restricted to event-link mode by the seam maps (they only render it while useEventReportLink.active), so
 * this component does not re-check `active`; it trusts its host.
 */
import React from "react"
import { View, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native"
import { webCursorPointer, webTransition, focusRingProps, makeThemedStyles, useTheme } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { FramedImage } from "../primitives"
import { useReport } from "../data"
import { useEventReportLink } from "./eventReportLinkStore"

/** The panel is a fixed, comfortable reading width regardless of the marker's screen position. */
export const REPORT_LINK_PANEL_WIDTH = 264

export function ReportLinkPanel({
  reportId,
  onViewDetails,
  onClose,
}: {
  /** The report whose preview + actions this panel shows. */
  reportId: string
  /** Open the full report detail (the shell's existing pin-detail navigation). */
  onViewDetails: () => void
  /** Dismiss the panel (the close affordance). Map taps / re-taps are handled by the seam map. */
  onClose: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("map-ui")
  const query = useReport(reportId)
  const report = query.data

  // Read the live selection so the toggle button label/icon mirrors the pin badge. Subscribing here keeps
  // the button in sync when the badge flips (the toggle flows through the form-registered onToggle, which
  // mirrors selectedIds back into the store).
  const selected = useEventReportLink((s) => s.selectedIds.includes(reportId))

  // Only ready photos make a sensible peek gallery (validating/rejected/held are owner-only status tiles).
  const photos = (report?.media ?? []).filter((m) => m.status === "ready")
  const description = report?.description?.trim() || null

  const onToggle = React.useCallback(() => {
    useEventReportLink.getState().toggle(reportId)
  }, [reportId])

  return (
    <View style={styles.card} accessibilityLabel={t("linkPanel.preview")}>
      {/* Header: a tiny title row + a close affordance (sibling Pressable, never nested). */}
      <View style={styles.header}>
        <Text variant="label" color={th.colors.textSubtle} numberOfLines={1} style={styles.headerLabel}>
          {report?.title?.trim() || t("linkPanel.title")}
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("linkPanel.close")}
          hitSlop={8}
          {...focusRingProps}
          style={({ pressed }) => [styles.closeBtn, webCursorPointer, pressed ? styles.pressed : null]}
        >
          <Icon icon={iconMap.Close} size={14} color={th.colors.textSubtle} />
        </Pressable>
      </View>

      {/* Gallery / loading. While the fetch is in flight show a spinner; once loaded show a small
          horizontal photo strip, or nothing when the report has no ready photos. */}
      {query.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={th.colors.brand.bloom} />
        </View>
      ) : photos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.galleryContent}
          style={styles.gallery}
        >
          {photos.map((m) => (
            <FramedImage
              key={m.id}
              source={{ uri: m.kind === "video" ? (m.thumbUrl ?? m.url) : m.url }}
              style={styles.photo}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      ) : null}

      {/* Description (clamped). Falls back to a muted placeholder when the report carries none. */}
      <Text
        variant="body"
        color={description ? th.colors.text : th.colors.textSubtle}
        numberOfLines={3}
        ellipsizeMode="tail"
        style={styles.description}
      >
        {description ?? t("linkPanel.noDescription")}
      </Text>

      {/* Actions: "View report details" then the Add/Remove toggle (stacked, mirroring the LocationPicker
          overlay). The toggle is the ONLY link mutation path (useEventReportLink.toggle). */}
      <View style={styles.actions}>
        <Pressable
          onPress={onViewDetails}
          accessibilityRole="button"
          accessibilityLabel={t("linkPanel.viewDetails")}
          {...focusRingProps}
          style={({ pressed }) => [
            styles.btn,
            styles.btnSecondary,
            webCursorPointer,
            webTransition,
            pressed ? styles.pressed : null,
          ]}
        >
          <Icon icon={iconMap.ArrowRight} size={15} color={th.colors.text} />
          <Text variant="bodyStrong" style={styles.btnSecondaryLabel}>
            {t("linkPanel.viewDetails")}
          </Text>
        </Pressable>

        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityLabel={selected ? t("linkPanel.removeA11y") : t("linkPanel.addA11y")}
          {...focusRingProps}
          style={({ pressed }) => [
            styles.btn,
            selected ? styles.btnRemove : styles.btnPrimary,
            webCursorPointer,
            webTransition,
            pressed ? styles.pressed : null,
          ]}
        >
          <Icon
            icon={selected ? iconMap.Check : iconMap.Plus}
            size={15}
            color={selected ? th.colors.text : th.colors.onAccent}
          />
          <Text
            variant="bodyStrong"
            color={selected ? th.colors.text : th.colors.onAccent}
            style={styles.btnLabel}
          >
            {selected ? t("linkPanel.remove") : t("linkPanel.add")}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  // The card itself: surface fill, hairline border + s2 shadow (a touch heavier than LinkedReportCard's s1
  // since it floats over the map). Width is fixed so the seam map only has to position it.
  card: {
    width: REPORT_LINK_PANEL_WIDTH,
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    padding: t.space["3"],
    gap: t.space["2"],
    ...t.shadows.s2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  headerLabel: {
    flex: 1,
    minWidth: 0,
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
  },
  loading: {
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  gallery: {
    marginHorizontal: -2,
  },
  galleryContent: {
    gap: t.space["2"],
    paddingHorizontal: 2,
  },
  photo: {
    width: 96,
    height: 72,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.bgAlt,
  },
  description: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  actions: {
    gap: t.space["2"],
    marginTop: 2,
  },
  // Stacked full-width pill buttons (mirrors the LocationPicker overlay's Confirm/Cancel rhythm).
  btn: {
    height: 38,
    borderRadius: t.radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: t.space["3"],
  },
  btnPrimary: {
    backgroundColor: t.colors.brand.bloom,
  },
  btnRemove: {
    backgroundColor: t.colors.surface,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
  },
  btnSecondary: {
    backgroundColor: t.colors.surface,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
  },
  btnLabel: {
    fontSize: 13.5,
  },
  btnSecondaryLabel: {
    fontSize: 13.5,
    color: t.colors.text,
  },
  pressed: {
    opacity: 0.92,
  },
}))
