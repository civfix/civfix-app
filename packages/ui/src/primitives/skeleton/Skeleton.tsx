import React, { useEffect } from "react"
import {
  Animated,
  Easing,
  Platform,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { makeThemedStyles, theme, useReducedMotion } from "../../theme"

export const SKELETON_PULSE_MS = 820
export const SKELETON_PULSE_MIN = 0.45

const pulseValue = new Animated.Value(1)
let pulseSubscribers = 0
let pulseLoop: Animated.CompositeAnimation | null = null

function acquirePulse(): void {
  pulseSubscribers += 1
  if (pulseLoop) return
  pulseLoop = Animated.loop(
    Animated.sequence([
      Animated.timing(pulseValue, {
        toValue: SKELETON_PULSE_MIN,
        duration: SKELETON_PULSE_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(pulseValue, {
        toValue: 1,
        duration: SKELETON_PULSE_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: Platform.OS !== "web",
      }),
    ]),
  )
  pulseLoop.start()
}

function releasePulse(): void {
  pulseSubscribers -= 1
  if (pulseSubscribers > 0) return
  pulseSubscribers = 0
  pulseLoop?.stop()
  pulseLoop = null
  pulseValue.setValue(1)
}

export function useSkeletonPulse(): Animated.Value | 1 {
  const reducedMotion = useReducedMotion()
  const animate = reducedMotion !== true
  useEffect(() => {
    if (!animate) return
    acquirePulse()
    return releasePulse
  }, [animate])
  return animate ? pulseValue : 1
}

const A11Y_HIDDEN = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
} as const

export interface SkeletonGroupProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

export function SkeletonGroup({ children, style }: SkeletonGroupProps) {
  return (
    <View style={style} {...A11Y_HIDDEN}>
      {children}
    </View>
  )
}

export interface SkeletonBlockProps {
  width?: DimensionValue
  height?: DimensionValue
  radius?: number
  style?: StyleProp<ViewStyle>
}

export function SkeletonBlock({
  width = "100%",
  height = 12,
  radius = theme.radius.sm,
  style,
}: SkeletonBlockProps) {
  const styles = useStyles()
  const opacity = useSkeletonPulse()
  return (
    <Animated.View
      {...A11Y_HIDDEN}
      style={[styles.fill, { width, height, borderRadius: radius, opacity }, style]}
    />
  )
}

export interface SkeletonTextProps {
  width?: DimensionValue
  height?: number
  style?: StyleProp<ViewStyle>
}

export function SkeletonText({ width = "100%", height = 10, style }: SkeletonTextProps) {
  return <SkeletonBlock width={width} height={height} radius={height / 2} style={style} />
}

export type SkeletonRowKind = "person" | "report" | "notification" | "settings" | "text"

export interface SkeletonRowKindSpec {
  readonly avatar: number | null
  readonly avatarRadius: number | null
  readonly lines: readonly DimensionValue[]
  readonly trailing: number | null
  readonly trailingHeight: number
  readonly trailingRadius: number
  readonly paddingVertical: number
  readonly gap: number
  readonly align: "center" | "flex-start"
}

export const SKELETON_ROW_KINDS: Record<SkeletonRowKind, SkeletonRowKindSpec> = {
  person: {
    avatar: 46,
    avatarRadius: 23,
    lines: ["45%", "62%"],
    trailing: 74,
    trailingHeight: 30,
    trailingRadius: theme.radius.pill,
    paddingVertical: 14,
    gap: theme.space["3"],
    align: "center",
  },
  report: {
    avatar: 36,
    avatarRadius: 10,
    lines: ["70%", "88%", "44%"],
    trailing: null,
    trailingHeight: 0,
    trailingRadius: 0,
    paddingVertical: theme.space["3"] + 1,
    gap: theme.space["3"],
    align: "flex-start",
  },
  notification: {
    avatar: 38,
    avatarRadius: 19,
    lines: ["78%", "50%"],
    trailing: 34,
    trailingHeight: 10,
    trailingRadius: 5,
    paddingVertical: theme.space["3"],
    gap: theme.space["3"],
    align: "flex-start",
  },
  settings: {
    avatar: null,
    avatarRadius: null,
    lines: ["52%", "34%"],
    trailing: 44,
    trailingHeight: 26,
    trailingRadius: theme.radius.pill,
    paddingVertical: theme.space["4"],
    gap: theme.space["3"],
    align: "center",
  },
  text: {
    avatar: null,
    avatarRadius: null,
    lines: ["100%", "72%"],
    trailing: null,
    trailingHeight: 0,
    trailingRadius: 0,
    paddingVertical: theme.space["2"],
    gap: theme.space["3"],
    align: "flex-start",
  },
}

export interface SkeletonRowProps {
  kind?: SkeletonRowKind
  style?: StyleProp<ViewStyle>
}

export function SkeletonRow({ kind = "person", style }: SkeletonRowProps) {
  const styles = useStyles()
  const spec = SKELETON_ROW_KINDS[kind]
  return (
    <View
      {...A11Y_HIDDEN}
      style={[
        styles.row,
        { paddingVertical: spec.paddingVertical, gap: spec.gap, alignItems: spec.align },
        style,
      ]}
    >
      {spec.avatar === null ? null : (
        <SkeletonBlock
          width={spec.avatar}
          height={spec.avatar}
          radius={spec.avatarRadius ?? spec.avatar / 2}
        />
      )}
      <View style={styles.copy}>
        {spec.lines.map((width, index) => (
          <SkeletonText key={index} width={width} height={index === 0 ? 12 : 10} />
        ))}
      </View>
      {spec.trailing === null ? null : (
        <SkeletonBlock
          width={spec.trailing}
          height={spec.trailingHeight}
          radius={spec.trailingRadius}
        />
      )}
    </View>
  )
}

export interface SkeletonListProps {
  rows?: number
  kind?: SkeletonRowKind
  style?: StyleProp<ViewStyle>
  rowStyle?: StyleProp<ViewStyle>
}

export function SkeletonList({ rows = 6, kind = "person", style, rowStyle }: SkeletonListProps) {
  return (
    <View {...A11Y_HIDDEN} style={style}>
      {Array.from({ length: rows }, (_unused, index) => (
        <SkeletonRow key={index} kind={kind} style={rowStyle} />
      ))}
    </View>
  )
}

export interface SkeletonDetailProps {
  hero?: number | false
  heroRadius?: number
  lines?: number
  rows?: number
  rowKind?: SkeletonRowKind
  style?: StyleProp<ViewStyle>
}

export function SkeletonDetail({
  hero = 200,
  heroRadius = theme.radius.lg,
  lines = 3,
  rows = 0,
  rowKind = "text",
  style,
}: SkeletonDetailProps) {
  const styles = useStyles()
  return (
    <View {...A11Y_HIDDEN} style={[styles.detail, style]}>
      {hero === false ? null : (
        <SkeletonBlock width="100%" height={hero} radius={heroRadius} />
      )}
      <View style={styles.detailCopy}>
        <SkeletonText width="72%" height={18} />
        {Array.from({ length: lines }, (_unused, index) => (
          <SkeletonText key={index} width={index === lines - 1 ? "54%" : "94%"} height={11} />
        ))}
      </View>
      {rows > 0 ? <SkeletonList rows={rows} kind={rowKind} /> : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  fill: { backgroundColor: t.colors.bgAlt },
  row: { flexDirection: "row", alignItems: "center" },
  copy: { flex: 1, gap: t.space["2"] },
  detail: { gap: t.space["5"], padding: t.space["4"] },
  detailCopy: { gap: t.space["3"] },
}))
