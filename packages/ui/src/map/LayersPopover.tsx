import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { View, Pressable, StyleSheet, Animated, Easing } from "react-native"
import { motion, categoryColor, focusRingProps, makeThemedStyles, useTheme } from "../theme"
import { useReducedMotion } from "../theme/useReducedMotion"
import {
  KNOB_OFF_X,
  KNOB_ON_X,
  SETTINGS_TOGGLE_TRACK,
  settingsToggleKnob,
  trackOffColor,
} from "../primitives/SettingsToggle.styles"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { BlurSurface } from "../surface"
import { TeardropPin, inkOnFill } from "./pins"
import { useReportFilterStore, FILTER_CATEGORIES } from "./filterStore"

const LAYERS_POPOVER_ANIM_MS = motion.fadeUp.duration
/** Unmounts the card anyway if its exit never reports finished, a little after the animation would. */
const POPOVER_UNMOUNT_SLACK_MS = 40
const POPOVER_WIDTH = 224
const KNOB_TOP = 2

export interface LayersPopoverPresence {
  mounted: boolean
  isClosing: boolean
  onClosed: () => void
}

/** Keeps the card mounted after `open` turns false, for exactly its exit animation. */
export function useLayersPopoverPresence(open: boolean): LayersPopoverPresence {
  const [isClosing, setIsClosing] = useState(false)
  const prevOpenRef = useRef(open)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const wasOpen = prevOpenRef.current
    prevOpenRef.current = open
    if (wasOpen && !open) {
      setIsClosing(true)
      if (closeTimer.current) clearTimeout(closeTimer.current)
      closeTimer.current = setTimeout(() => {
        setIsClosing(false)
      }, LAYERS_POPOVER_ANIM_MS + POPOVER_UNMOUNT_SLACK_MS)
    } else if (!wasOpen && open) {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current)
        closeTimer.current = null
      }
      setIsClosing(false)
    }
  }, [open])

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    },
    [],
  )

  const onClosed = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setIsClosing(false)
  }, [])

  return { mounted: open || isClosing, isClosing, onClosed }
}

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
  /** The parent keeps the card mounted while this is true, until `onClosed` fires. */
  isClosing?: boolean
  onClosed?: () => void
}

export function LayersPopover({ isClosing = false, onClosed }: LayersPopoverProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("map-ui")
  const enabled = useReportFilterStore((s) => s.enabled)
  const eventsEnabled = useReportFilterStore((s) => s.eventsEnabled)
  const toggle = useReportFilterStore((s) => s.toggle)
  const toggleEvents = useReportFilterStore((s) => s.toggleEvents)
  const toggleAll = useReportFilterStore((s) => s.toggleAll)

  const [reportsOpen, setReportsOpen] = useState(false)

  // Core RN `Animated`, not reanimated, so the same animation runs on react-native-web, where the native
  // driver is a no-op. The card never unmounts during the exit, so a re-open mid-exit reuses the value.
  const progress = useRef(new Animated.Value(0)).current
  const onClosedRef = useRef(onClosed)
  useLayoutEffect(() => {
    onClosedRef.current = onClosed
  })
  // A rapid toggle must stop the previous timing, or two race on the same Animated.Value and the card jumps.
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
      easing: Easing.bezier(...motion.fadeUp.easing),
      useNativeDriver: false,
    })
    animRef.current = anim
    anim.start(({ finished }) => {
      if (finished && isClosing) onClosedRef.current?.()
    })
    return () => anim.stop()
  }, [isClosing, reducedMotion, progress])

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
        {/* The popover opens from a keyboard stop, so every row carries `focusRingProps`; without it
            Tab lands on Chrome's UA focus rectangle instead of the house ring. */}
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
            <Text style={styles.rowSub}>{eventsEnabled ? t("layers.shown") : t("layers.hidden")}</Text>
          </View>
          <MiniToggle on={eventsEnabled} />
        </Pressable>

        <View style={styles.divider} />

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
  animWrap: {
    width: POPOVER_WIDTH,
  },
  card: {
    width: POPOVER_WIDTH,
    borderRadius: t.radius.md,
    padding: t.space["1"],
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
    fontSize: t.fontSize["14"],
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
  toggle: SETTINGS_TOGGLE_TRACK,
  toggleKnob: {
    ...settingsToggleKnob(t),
    top: KNOB_TOP,
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
