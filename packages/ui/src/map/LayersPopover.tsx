/**
 * LayersPopover - the map layers card (UI-unification Stage 4 slice 5B-1). Ported from the mobile
 * LayersPopover (design `.pi-layers-popover` / layers-pop.png): a 224px glass card anchored under the
 * Layers control. Two sections, both driving the SHARED report-filter store:
 *
 *   - "Events": a sun-50 calendar tile, "Events" + a shown/hidden sub, and an always-visible on/off
 *     pill toggle wired to `toggleEvents` (the event/cleanup pins show/hide on the map).
 *   - "Reports": a bloom-50 map-pin tile, "Reports" + a summary ("None shown" / "All categories" /
 *     "{n} of 5 categories"), and a caret that expands the category list. Expanded shows a
 *     "Select all / Clear all" row (`toggleAll`) plus the FIVE report categories (trash, recycling,
 *     graffiti, hazard, water - no "other"), each a teardrop pin + label + a check, wired to `toggle`.
 *
 * Re-points vs the mobile original:
 *   - reads/writes the shared `useReportFilterStore` directly (the mobile version took the state +
 *     callbacks as props from app/index.tsx; the state is now lifted into the store).
 *   - the local Ionicons glyphs -> lucide via `Icon` + `iconMap` (Ionicons banned in @civfix/ui).
 *   - the blur is rebuilt on `<BlurSurface kind="popover">`; `@/theme` -> `../theme`; the local Text ->
 *     the shared `Text`. The category pin is the shared `TeardropPin` (already 5A-shared).
 *
 * Presentational props are limited to `eventsNearby` (an optional live count the host may pass for the
 * Events sub-label); everything else comes from the store.
 */
import React, { useEffect, useRef, useState } from "react"
import { View, Pressable, StyleSheet, Animated, Easing } from "react-native"
import { motion, categoryColor, focusRingProps, makeThemedStyles, useTheme } from "../theme"
import { useReducedMotion } from "../theme/useReducedMotion"
import { KNOB_OFF_X, KNOB_ON_X, trackOffColor } from "../primitives/SettingsToggle.types"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { BlurSurface } from "../surface"
import { TeardropPin, inkOnFill } from "./pins"
import { useReportFilterStore, FILTER_CATEGORIES } from "./filterStore"

/**
 * Duration (ms) of the popover enter/exit animation. Exported so the parent (MapControls) can keep the
 * card mounted for exactly this long while it animates out before unmounting it. Sourced from the shared
 * `cfFadeUp` motion token (250ms) so the map glass popover shares one timing with the rest of the redesign.
 */
export const LAYERS_POPOVER_ANIM_MS = motion.fadeUp.duration

/** The design's 38x24 pill switch (knob 20x20, on=moss). Drives the Events layer toggle. */
function MiniToggle({ on }: { on: boolean }) {
  const styles = useStyles()
  const t = useTheme()
  return (
    <View
      style={[
        styles.toggle,
        { backgroundColor: on ? t.colors.brand.moss : trackOffColor(t) },
      ]}
    >
      <View style={[styles.toggleKnob, { left: on ? KNOB_ON_X : KNOB_OFF_X }]} />
    </View>
  )
}

export interface LayersPopoverProps {
  /** Optional live "{N} nearby" count for the Events sub-label; falls back to "Shown" when omitted. */
  eventsNearby?: number
  /**
   * When flipped true the card animates OUT (a cfFadeUp reverse: fade + 14px settle + subtle scale)
   * instead of unmounting instantly, then fires `onClosed`. The parent keeps it mounted while this is true.
   */
  isClosing?: boolean
  /** Called once the exit animation finishes, so the parent can unmount the popover. */
  onClosed?: () => void
}

export function LayersPopover({ eventsNearby, isClosing = false, onClosed }: LayersPopoverProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("map-ui")
  const enabled = useReportFilterStore((s) => s.enabled)
  const eventsEnabled = useReportFilterStore((s) => s.eventsEnabled)
  const toggle = useReportFilterStore((s) => s.toggle)
  const toggleEvents = useReportFilterStore((s) => s.toggleEvents)
  const toggleAll = useReportFilterStore((s) => s.toggleAll)

  const [reportsOpen, setReportsOpen] = useState(false)

  // Enter/exit animation. Core RN `Animated` (NOT reanimated) so the SAME animation runs on
  // react-native-web; `useNativeDriver: false` keeps opacity + transform animating on web (the native
  // driver is a no-op there). Matches the BrandAboutCard entrance pattern (fade + translateY + scale).
  // ONE effect keyed on `isClosing` drives `progress` toward its target: 1 when open/entering, 0 when
  // closing. On mount (`isClosing` false) it animates IN; when the parent flips `isClosing` true it
  // animates OUT and calls `onClosed` on finish; a re-open mid-exit flips it back to false and re-enters
  // cleanly (the card never unmounts during the exit, so the same Animated.Value is reused).
  const progress = useRef(new Animated.Value(0)).current
  // Keep the latest onClosed in a ref so the effect can fire it without re-running on identity churn.
  const onClosedRef = useRef(onClosed)
  onClosedRef.current = onClosed
  // Track the in-flight animation so a rapid open/close toggle STOPS the previous one before starting a
  // new one - otherwise two timings race on the same Animated.Value and the card jumps/stutters.
  const animRef = useRef<Animated.CompositeAnimation | null>(null)
  const reducedMotion = useReducedMotion() === true

  useEffect(() => {
    animRef.current?.stop()
    if (reducedMotion) {
      animRef.current = null
      progress.setValue(isClosing ? 0 : 1)
      if (isClosing) onClosedRef.current?.()
      return
    }
    const anim = Animated.timing(progress, {
      toValue: isClosing ? 0 : 1,
      duration: LAYERS_POPOVER_ANIM_MS,
      // Standard iOS-feel easing from the shared motion tokens (matches cfFadeUp / the body transitions).
      easing: Easing.bezier(...motion.fadeUp.easing),
      useNativeDriver: false,
    })
    animRef.current = anim
    anim.start(({ finished }) => {
      // Only the EXIT animation reaching its end means the popover is done closing.
      if (finished && isClosing) onClosedRef.current?.()
    })
    return () => anim.stop()
  }, [isClosing, reducedMotion, progress])

  // cfFadeUp entrance: a 14px rise + fade (+ a subtle scale settle). The distance/scale come from the
  // shared `motion.fadeUp` token so every popover/toast in the redesign shares one recipe.
  const cardTransform = [
    {
      translateY: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [motion.fadeUp.distance, 0],
      }),
    },
    { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [motion.fadeUp.scaleFrom, 1] }) },
  ]
  const shownCount = FILTER_CATEGORIES.filter((c) => enabled.has(c)).length
  const allOn = shownCount === FILTER_CATEGORIES.length
  const summary =
    shownCount === 0
      ? t("layers.summaryNone")
      : allOn
        ? t("layers.summaryAll")
        : t("layers.summarySome", { shown: shownCount, total: FILTER_CATEGORIES.length })

  return (
    <Animated.View style={[styles.animWrap, { opacity: progress, transform: cardTransform }]}>
      <BlurSurface kind="popover" style={[styles.card, th.shadows.s3]}>
        {/* Events row - a real on/off layer toggle.

            `focusRingProps` on this and the three rows below: the popover is opened from the map float's
            "Map layers" button, which IS a keyboard stop, so a keyboard user lands inside the card and
            Tabs through it - and every stop in here was falling through to Chrome's blue UA rectangle
            because none of the four rows was tagged for the house `[data-focus-ring]:focus-visible` rule.
            Each row already owns its own radius, so the outline traces the control as-drawn. */}
        <Pressable
          style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
          onPress={toggleEvents}
          accessibilityRole="switch"
          accessibilityState={{ checked: eventsEnabled }}
          accessibilityLabel={t("layers.eventsA11y")}
          {...focusRingProps}
        >
          <View style={[styles.iconTile, { backgroundColor: th.colors.sun["50"] }]}>
            <Icon icon={iconMap.Calendar} size={17} color={th.colors.sun["700"]} />
          </View>
          <View style={styles.meta}>
            <Text style={styles.rowTitle}>{t("layers.events")}</Text>
            <Text style={styles.rowSub}>
              {eventsEnabled
                ? eventsNearby != null
                  ? t("layers.nearby", { count: eventsNearby })
                  : t("layers.shown")
                : t("layers.hidden")}
            </Text>
          </View>
          <MiniToggle on={eventsEnabled} />
        </Pressable>

        <View style={styles.divider} />

        {/* Reports row (expands) */}
        <Pressable
          style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
          onPress={() => setReportsOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityLabel={t("layers.reportsA11y")}
          accessibilityState={{ expanded: reportsOpen }}
          {...focusRingProps}
        >
          <View style={[styles.iconTile, { backgroundColor: th.colors.bloom["50"] }]}>
            <Icon icon={iconMap.MapPin} size={17} color={th.colors.bloom["700"]} />
          </View>
          <View style={styles.meta}>
            <Text style={styles.rowTitle}>{t("layers.reports")}</Text>
            <Text style={styles.rowSub}>{summary}</Text>
          </View>
          <Icon
            icon={reportsOpen ? iconMap.ChevronUp : iconMap.ChevronDown}
            size={16}
            color={th.colors.textSubtle}
          />
        </Pressable>

        {reportsOpen ? (
          <View style={styles.catList}>
            <Pressable
              style={({ pressed }) => [styles.allRow, pressed ? styles.rowPressed : null]}
              onPress={toggleAll}
              accessibilityRole="button"
              accessibilityLabel={allOn ? t("layers.clearAllA11y") : t("layers.selectAllA11y")}
              hitSlop={6}
              {...focusRingProps}
            >
              <View style={[styles.check, allOn ? styles.checkOnNeutral : styles.checkOff]}>
                {allOn ? <Icon icon={iconMap.Check} size={12} color={th.colors.onAccent} /> : null}
              </View>
              <Text style={styles.allLabel}>{allOn ? t("layers.clearAll") : t("layers.selectAll")}</Text>
            </Pressable>

            {FILTER_CATEGORIES.map((cat) => {
              const on = enabled.has(cat)
              const color = categoryColor(cat, th.scheme)
              // The category display label lives in the shared `enums` namespace, so a category name
              // reads identically here and in the report lists (ClusterReportsBody uses the same key).
              const label = t(`enums:category.${cat}`)
              return (
                <Pressable
                  key={cat}
                  onPress={() => toggle(cat)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={t("layers.categoryPinsA11y", { category: label })}
                  hitSlop={6}
                  {...focusRingProps}
                  style={({ pressed }) => [styles.catRow, pressed ? styles.rowPressed : null]}
                >
                  <View style={styles.catPin}>
                    <TeardropPin category={cat} size={17} />
                  </View>
                  <Text style={styles.catLabel}>{label}</Text>
                  <View
                    style={[
                      styles.check,
                      on ? { backgroundColor: color, borderColor: color } : styles.checkOff,
                    ]}
                  >
                    {on ? (
                      <Icon icon={iconMap.Check} size={12} color={inkOnFill(color, th.scheme, th.colors.onAccent)} />
                    ) : null}
                  </View>
                </Pressable>
              )
            })}
          </View>
        ) : null}
      </BlurSurface>
    </Animated.View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  // The animated wrapper hosts the enter/exit opacity + transform; it sizes to the card (width 224) so the
  // upward-slide / scale animate around the card without affecting the surrounding control layout.
  animWrap: {
    width: 224,
  },
  card: {
    width: 224,
    borderRadius: t.radius.md,
    padding: 4,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.glass.popover.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingHorizontal: t.space["2"],
    paddingVertical: t.space["2"],
  },
  rowPressed: {
    opacity: 0.6,
  },
  iconTile: {
    width: 32,
    height: 32,
    borderRadius: t.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14,
    color: t.colors.text,
  },
  rowSub: {
    fontFamily: t.fontFamily.bodyMedium,
    fontSize: 11,
    color: t.colors.textSubtle,
    marginTop: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.colors.border,
    marginHorizontal: t.space["2"],
  },
  toggle: {
    width: 40,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
  },
  toggleKnob: {
    position: "absolute",
    top: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: t.colors.onAccent,
    ...t.shadows.s1,
  },
  catList: {
    paddingTop: 2,
    paddingBottom: 2,
  },
  allRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    paddingHorizontal: t.space["2"],
    paddingVertical: t.space["2"],
  },
  allLabel: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: t.colors.bloom["700"],
  },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingHorizontal: t.space["2"],
    paddingVertical: t.space["2"],
  },
  catPin: {
    width: 20,
    alignItems: "center",
  },
  catLabel: {
    flex: 1,
    fontFamily: t.fontFamily.bodyMedium,
    fontSize: 13.5,
    color: t.colors.text,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: t.radius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOff: {
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
  },
  checkOnNeutral: {
    backgroundColor: t.colors.bloom["700"],
    borderColor: t.colors.bloom["700"],
  },
}))
