import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import { focusRingProps, makeThemedStyles, theme, useTheme, type Theme } from "../theme"
import { useReducedMotion } from "../theme/useReducedMotion"
import { Text, TextLink, Icon, iconMap } from "../typography"
import type { IconName } from "../typography"
import { useT } from "../i18n"
import { useTabBarStore } from "../shell/tabBarStore"
import { useKeyboardAnchor } from "../shell/useKeyboardAnchor"
import {
  ToastContext,
  useToast,
  type ToastAction,
  type ToastApi,
  type ToastOptions,
  type ToastVariant,
} from "./toastContext"
import { TOAST_MAX_WIDTH, toastBottomOffset, toastDurationMs } from "./toastModel"

export { useToast }
export type { ToastAction, ToastApi, ToastOptions, ToastVariant }

const ENTER = theme.motion.fadeUp
const EXIT = theme.motion.menuOut
const USE_NATIVE_DRIVER = Platform.OS !== "web"
const LIVE_REGION: "polite" | "none" = Platform.OS === "web" ? "polite" : "none"

const VARIANT_ICON: Record<ToastVariant, IconName> = {
  success: "CheckCircle2",
  error: "AlertCircle",
  info: "Info",
}

function variantColor(variant: ToastVariant, t: Theme): string {
  switch (variant) {
    case "error":
      return t.colors.bloom["600"]
    case "info":
      return t.colors.sky["700"]
    default:
      return t.colors.moss["700"]
  }
}

type ToastPhase = "in" | "out"

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
  action: ToastAction | null
}

interface ToastEntry {
  item: ToastItem
  phase: ToastPhase
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([])
  const nextId = useRef(0)
  const currentId = useRef<number | null>(null)
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const clearTimer = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (!timer) return
    clearTimeout(timer)
    timers.current.delete(id)
  }, [])

  const remove = useCallback(
    (id: number) => {
      clearTimer(id)
      setEntries((prev) => prev.filter((entry) => entry.item.id !== id))
    },
    [clearTimer],
  )

  const retire = useCallback(
    (id: number) => {
      clearTimer(id)
      if (currentId.current === id) currentId.current = null
      setEntries((prev) =>
        prev.map((entry) => (entry.item.id === id ? { item: entry.item, phase: "out" } : entry)),
      )
      timers.current.set(
        id,
        setTimeout(() => remove(id), EXIT.duration),
      )
    },
    [clearTimer, remove],
  )

  const show = useCallback(
    (message: string, opts?: ToastOptions) => {
      const id = nextId.current++
      const variant = opts?.variant ?? "info"
      const action = opts?.action ?? null
      const previous = currentId.current
      if (previous !== null) retire(previous)
      currentId.current = id
      setEntries((prev) => [...prev, { item: { id, message, variant, action }, phase: "in" }])
      timers.current.set(
        id,
        setTimeout(() => retire(id), toastDurationMs(variant, action !== null, opts?.durationMs)),
      )
      if (Platform.OS !== "web") AccessibilityInfo.announceForAccessibility(message)
    },
    [retire],
  )

  const timersRef = timers
  useEffect(
    () => () => {
      for (const timer of timersRef.current.values()) clearTimeout(timer)
      timersRef.current.clear()
    },
    [timersRef],
  )

  const api = useMemo<ToastApi>(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {entries.length > 0 ? <ToastHost entries={entries} onDismiss={retire} /> : null}
    </ToastContext.Provider>
  )
}

function useToastBottomOffset(): number {
  const dockFootprint = useTabBarStore((state) => state.tabBarHeight)
  const insets = useContext(SafeAreaInsetsContext)
  const keyboard = useKeyboardAnchor({ restOffset: 0, gap: 0 })
  return toastBottomOffset(
    dockFootprint,
    insets?.bottom ?? 0,
    theme.space["3"],
    keyboard.reserved,
  )
}

function ToastHost({
  entries,
  onDismiss,
}: {
  entries: ToastEntry[]
  onDismiss: (id: number) => void
}) {
  const styles = useStyles()
  const offset = useToastBottomOffset()
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {entries.map((entry) => (
        <ToastCard key={entry.item.id} entry={entry} offset={offset} onDismiss={onDismiss} />
      ))}
    </View>
  )
}

function ToastCard({
  entry,
  offset,
  onDismiss,
}: {
  entry: ToastEntry
  offset: number
  onDismiss: (id: number) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("common")
  const reducedMotion = useReducedMotion() === true
  const progress = useRef(new Animated.Value(0)).current
  const leaving = entry.phase === "out"
  const iconName = VARIANT_ICON[entry.item.variant]
  const iconColor = variantColor(entry.item.variant, th)
  const action = entry.item.action
  const id = entry.item.id

  useEffect(() => {
    const recipe = leaving ? EXIT : ENTER
    const animation = Animated.timing(progress, {
      toValue: leaving ? 0 : 1,
      duration: recipe.duration,
      easing: Easing.bezier(...recipe.easing),
      useNativeDriver: USE_NATIVE_DRIVER,
    })
    animation.start()
    return () => animation.stop()
  }, [leaving, progress])

  const motionStyle = reducedMotion
    ? { opacity: progress }
    : {
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [ENTER.distance, 0],
            }),
          },
        ],
      }

  const dismiss = useCallback(() => onDismiss(id), [id, onDismiss])
  const runAction = useCallback(() => {
    action?.onPress()
    onDismiss(id)
  }, [action, id, onDismiss])

  return (
    <Animated.View style={[styles.slot, { bottom: offset }, motionStyle]} pointerEvents="box-none">
      <View
        style={styles.card}
        accessibilityRole="alert"
        accessibilityLiveRegion={LIVE_REGION}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={entry.item.message}
          accessibilityHint={t("dismiss")}
          onPress={dismiss}
          {...focusRingProps}
          style={({ pressed }) => [styles.body, pressed ? styles.bodyPressed : null]}
        >
          <Icon icon={iconMap[iconName]} size={16} color={iconColor} />
          <Text
            variant="bodyStrong"
            color={th.colors.text}
            style={styles.message}
            numberOfLines={3}
          >
            {entry.item.message}
          </Text>
        </Pressable>
        {action ? (
          <TextLink
            variant="label"
            onPress={runAction}
            accessibilityLabel={action.label}
            numberOfLines={1}
            style={styles.action}
          >
            {action.label}
          </TextLink>
        ) : null}
      </View>
    </Animated.View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
    pointerEvents: "box-none",
  },
  slot: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: t.space["4"],
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    maxWidth: TOAST_MAX_WIDTH,
    paddingVertical: t.space["3"],
    paddingHorizontal: t.space["4"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s3,
  },
  body: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    flexShrink: 1,
  },
  bodyPressed: {
    opacity: 0.7,
  },
  message: {
    flexShrink: 1,
  },
  action: {
    color: t.colors.accentText,
  },
}))
