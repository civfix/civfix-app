import React from "react"
import { StyleSheet, View } from "react-native"
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated"
import {
  BlurSurface,
  ClusterBubble,
  Icon,
  ReportRowView,
  TeardropPin,
  iconMap,
  type LucideIcon,
} from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { makeThemedStyles, space, motion, useTheme } from "@/theme"
import {
  DEMO_REPORT_ID,
  DEMO_REPORT_LAT,
  DEMO_REPORT_LNG,
  TRACK_CLUSTER_COUNT,
  TRACK_CLUSTER_MEMBERS,
  TRACK_CLUSTER_SPOT,
  TRACK_PINS,
  TRACK_ROW_PIN_INDEX,
  TRACK_STATUS_CYCLE,
} from "../demoWorld"
import type { BoxPoint } from "../onboardingMapScenes"
import { MapStill, spotStyle } from "./MapStill"
import {
  GRAVITY_EASE,
  STAGE_DROP_PX,
  STAGE_STAGGER_MS,
  STANDARD_EASE,
  segment,
  stageStops,
  stageWindow,
  useStageStep,
  useStageTimeline,
} from "./stageMotion"
import { STAGE_ASPECT_RATIO, type StageProps } from "./stageTypes"

const TOTAL_MS = 4800

const DROP_MS = motion.gravity.duration
const SQUASH_MS = 160

const PIN_DROP_WINDOWS = TRACK_PINS.map((_, i) =>
  stageWindow(TOTAL_MS, i * STAGE_STAGGER_MS, i * STAGE_STAGGER_MS + DROP_MS),
)
const PIN_SQUASH_WINDOWS = TRACK_PINS.map((_, i) =>
  stageWindow(TOTAL_MS, i * STAGE_STAGGER_MS + DROP_MS, i * STAGE_STAGGER_MS + DROP_MS + SQUASH_MS),
)

const W_MERGE = stageWindow(TOTAL_MS, 1200, 1600)
const W_CLUSTER = stageWindow(TOTAL_MS, 1400, 1780)
const W_DOCK = stageWindow(TOTAL_MS, 1780, 2140)
const W_LOZENGE = stageWindow(TOTAL_MS, 2140, 2380)
const W_ROW = stageWindow(TOTAL_MS, 2700, 3160)

const STEP_STOPS = stageStops(TOTAL_MS, 2700, 2700 + 1000, 2700 + 2000)

const PIN_SIZE = 30
const PIN_HEIGHT = Math.round(PIN_SIZE * (76 / 64))
const CLUSTER_SIZE = 34
const ROW_SLIDE = 120

const DOCK_CELL = 54
const DOCK_PADDING = 6
const DOCK_WIDTH = DOCK_CELL * 4 + DOCK_PADDING * 2
const DOCK_HEIGHT = 46
const LOZENGE_WIDTH = 46
const LOZENGE_HEIGHT = 34
const LOZENGE_LEFT = DOCK_PADDING + (DOCK_CELL - LOZENGE_WIDTH) / 2
const LOZENGE_TRAVEL = DOCK_CELL
const DOCK_RISE = DOCK_HEIGHT + space["4"]

const DOCK_ICONS: readonly LucideIcon[] = [
  iconMap.Newspaper,
  iconMap.Map,
  iconMap.MessageCircle,
  iconMap.Plus,
]
const DOCK_SELECTED_INDEX = 1

const POP = motion.pop

function noop(): void {}

function TrackPin({
  index,
  progress,
  at,
  merges,
  mergeX,
  mergeY,
  active,
}: {
  index: number
  progress: SharedValue<number>
  at: BoxPoint
  merges: boolean
  mergeX: number
  mergeY: number
  active: boolean
}) {
  const pin = TRACK_PINS[index]
  const drop = PIN_DROP_WINDOWS[index]
  const squash = PIN_SQUASH_WINDOWS[index]
  const distance = STAGE_DROP_PX * 4 * pin.rise

  const style = useAnimatedStyle(() => {
    const d = GRAVITY_EASE(segment(progress.value, drop[0], drop[1]))
    const merge = merges ? STANDARD_EASE(segment(progress.value, W_MERGE[0], W_MERGE[1])) : 0
    const bounce = Math.sin(Math.PI * segment(progress.value, squash[0], squash[1]))
    const scaleY = 1 - bounce * 0.1
    return {
      opacity: interpolate(d, [0, 0.15], [0, 1], Extrapolation.CLAMP) * (1 - merge),
      transform: [
        { translateX: merge * mergeX },
        {
          translateY:
            (d - 1) * distance + merge * mergeY + (PIN_HEIGHT * (1 - scaleY)) / 2,
        },
        { scaleX: (1 + bounce * 0.08) * (1 - merge * 0.4) },
        { scaleY: scaleY * (1 - merge * 0.4) },
      ],
    }
  })

  return (
    <Animated.View style={[spotStyle(at, -PIN_SIZE / 2, -PIN_HEIGHT), style]}>
      <TeardropPin category={pin.category} size={PIN_SIZE} active={active} />
    </Animated.View>
  )
}

export function TrackStage({ active, reduceMotion }: StageProps) {
  const { t } = useT("mobile-onboarding")
  const th = useTheme()
  const styles = useStyles()
  const progress = useStageTimeline(active, reduceMotion, TOTAL_MS)
  const step = useStageStep(progress, STEP_STOPS)

  const clusterStyle = useAnimatedStyle(() => {
    const s = segment(progress.value, W_CLUSTER[0], W_CLUSTER[1])
    return {
      opacity: interpolate(s, [0, 0.15], [0, 1], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(s, [0, 0.55, 1], [POP.from, POP.overshoot, POP.to], Extrapolation.CLAMP) },
      ],
    }
  })

  const dockStyle = useAnimatedStyle(() => {
    const s = GRAVITY_EASE(segment(progress.value, W_DOCK[0], W_DOCK[1]))
    return {
      opacity: interpolate(s, [0, 0.25], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: (1 - s) * DOCK_RISE }],
    }
  })

  const lozengeStyle = useAnimatedStyle(() => {
    const s = STANDARD_EASE(segment(progress.value, W_LOZENGE[0], W_LOZENGE[1]))
    return { opacity: s, transform: [{ translateX: s * LOZENGE_TRAVEL }] }
  })

  const rowStyle = useAnimatedStyle(() => {
    const s = STANDARD_EASE(segment(progress.value, W_ROW[0], W_ROW[1]))
    return { opacity: s, transform: [{ translateX: (1 - s) * ROW_SLIDE }] }
  })

  const rowPin = TRACK_PINS[TRACK_ROW_PIN_INDEX]
  const status = TRACK_STATUS_CYCLE[Math.min(Math.max(step - 1, 0), TRACK_STATUS_CYCLE.length - 1)]

  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityLabel={t("a11y.stage_track")}
      style={styles.root}
    >
      <View
        style={styles.inner}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <MapStill stage="track" style={styles.mapArea}>
          {(frame) => {
            const cluster = frame.at(TRACK_CLUSTER_SPOT)
            return (
              <>
                {TRACK_PINS.map((pin, i) => {
                  const at = frame.at(pin.spot)
                  return (
                    <TrackPin
                      key={`${pin.category}-${i}`}
                      index={i}
                      progress={progress}
                      at={at}
                      merges={TRACK_CLUSTER_MEMBERS.includes(i)}
                      mergeX={cluster.left - at.left}
                      mergeY={cluster.top - at.top}
                      active={i === TRACK_ROW_PIN_INDEX && step >= 1}
                    />
                  )
                })}
                <Animated.View
                  style={[spotStyle(cluster, -CLUSTER_SIZE / 2, -CLUSTER_SIZE / 2), clusterStyle]}
                >
                  <ClusterBubble count={TRACK_CLUSTER_COUNT} size={CLUSTER_SIZE} />
                </Animated.View>
              </>
            )
          }}
        </MapStill>

        <Animated.View style={[styles.row, rowStyle]}>
          <ReportRowView
            id={DEMO_REPORT_ID}
            category={rowPin.category}
            status={status}
            title={t("track.stage.row_title")}
            subtitle={t("track.stage.row_subtitle")}
            when={t("track.stage.row_when")}
            lat={DEMO_REPORT_LAT}
            lng={DEMO_REPORT_LNG}
            card
            onPress={noop}
          />
        </Animated.View>

        <Animated.View style={[styles.dockWrap, dockStyle]}>
          <BlurSurface kind="dock" style={styles.dock}>
            <Animated.View style={[styles.lozenge, lozengeStyle]} />
            {DOCK_ICONS.map((icon, i) => (
              <View key={i} style={styles.dockCell}>
                <Icon
                  icon={icon}
                  size={20}
                  color={i === DOCK_SELECTED_INDEX ? th.colors.text : th.colors.textSubtle}
                />
              </View>
            ))}
          </BlurSurface>
        </Animated.View>
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    width: "100%",
    aspectRatio: STAGE_ASPECT_RATIO,
  },
  inner: {
    flex: 1,
  },
  mapArea: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: "64%",
  },
  row: {
    position: "absolute",
    left: t.space["2"],
    right: t.space["2"],
    top: "36%",
  },
  dockWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
  },
  dock: {
    width: DOCK_WIDTH,
    height: DOCK_HEIGHT,
    paddingHorizontal: DOCK_PADDING,
    borderRadius: t.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.glass.dock.border,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  dockCell: {
    width: DOCK_CELL,
    alignItems: "center",
    justifyContent: "center",
  },
  lozenge: {
    position: "absolute",
    left: LOZENGE_LEFT,
    top: (DOCK_HEIGHT - LOZENGE_HEIGHT) / 2,
    width: LOZENGE_WIDTH,
    height: LOZENGE_HEIGHT,
    borderRadius: t.radius.pill,
    backgroundColor: t.glass.dock.selected,
  },
}))
