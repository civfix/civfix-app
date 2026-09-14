import React from "react"
import { StyleSheet, View } from "react-native"
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated"
import { REPORT_TYPE_TO_CATEGORY } from "@civfix/shared"
import { CategoryChip, Icon, TeardropPin, Text, iconMap } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { categoryColor, makeThemedStyles, motion, useTheme, wash } from "@/theme"
import { REPORT_STAGE_SELECTED_INDEX, REPORT_STAGE_TYPES } from "../demoWorld"
import { REPORT_PIN_SPOT } from "../onboardingMapScenes"
import { MapStill, spotStyle } from "./MapStill"
import {
  GRAVITY_EASE,
  STAGE_DROP_PX,
  STAGE_RISE_PX,
  STANDARD_EASE,
  segment,
  stageWindow,
  useStageTimeline,
} from "./stageMotion"
import { STAGE_ASPECT_RATIO, type StageProps } from "./stageTypes"

const TOTAL_MS = 5060

const ROW_START_MS = 1800
const ROW_DURATION_MS = 580
const ROW_STAGGER_MS = 108

const W_CARD = stageWindow(TOTAL_MS, 0, 760)
const W_SHUTTER = stageWindow(TOTAL_MS, 1000, 1620)
const W_SELECT = stageWindow(TOTAL_MS, 2700, 3100)
const W_CHECK = stageWindow(TOTAL_MS, 2740, 3420)
const W_COMPRESS = stageWindow(TOTAL_MS, 3420, 4250)
const W_PIN = stageWindow(TOTAL_MS, 3430, 4080)
const W_SQUASH = stageWindow(TOTAL_MS, 4080, 4410)
const W_GLOW = stageWindow(TOTAL_MS, 4080, 4920)
const W_SUCCESS = stageWindow(TOTAL_MS, 4210, 4960)

const ROW_WINDOWS = REPORT_STAGE_TYPES.map((_, i) =>
  stageWindow(
    TOTAL_MS,
    ROW_START_MS + i * ROW_STAGGER_MS,
    ROW_START_MS + i * ROW_STAGGER_MS + ROW_DURATION_MS,
  ),
)

const PIN_SIZE = 38
const PIN_HEIGHT = Math.round(PIN_SIZE * (76 / 64))
const PIN_DROP = STAGE_DROP_PX * 4
const CARD_RISE = STAGE_DROP_PX * 3
const ROW_RISE = 10
const GLOW_SIZE = 56
const CHIP_SIZE = 24
const CHECK_SIZE = 18
const FRAME_SIZE = 80
const SHUTTER_SIZE = 38

const SELECTED_TYPE = REPORT_STAGE_TYPES[REPORT_STAGE_SELECTED_INDEX]
const SELECTED_CATEGORY = REPORT_TYPE_TO_CATEGORY[SELECTED_TYPE]
const SELECTED_TINT_AMOUNT = 0.86

const POP = motion.pop

function TypeRow({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const { t } = useT("enums")
  const th = useTheme()
  const styles = useStyles()
  const type = REPORT_STAGE_TYPES[index]
  const category = REPORT_TYPE_TO_CATEGORY[type]
  const selected = index === REPORT_STAGE_SELECTED_INDEX
  const enter = ROW_WINDOWS[index]

  const rowStyle = useAnimatedStyle(() => {
    const s = STANDARD_EASE(segment(progress.value, enter[0], enter[1]))
    return { opacity: s, transform: [{ translateY: (1 - s) * ROW_RISE }] }
  })

  const tintStyle = useAnimatedStyle(() => ({
    opacity: selected ? segment(progress.value, W_SELECT[0], W_SELECT[1]) : 0,
  }))

  const checkStyle = useAnimatedStyle(() => {
    const s = selected ? segment(progress.value, W_CHECK[0], W_CHECK[1]) : 0
    return {
      opacity: interpolate(s, [0, 0.1], [0, 1], Extrapolation.CLAMP),
      transform: [
        {
          scale: interpolate(s, [0, 0.55, 1], [POP.from, POP.overshoot, POP.to], Extrapolation.CLAMP),
        },
      ],
    }
  })

  return (
    <Animated.View style={[styles.typeRow, rowStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.typeRowTint, tintStyle]} />
      <CategoryChip category={category} size={CHIP_SIZE} />
      <Text variant="label" color={th.colors.text} numberOfLines={1} style={styles.typeLabel}>
        {t(`reportType.${type}`)}
      </Text>
      <Animated.View style={[styles.check, checkStyle]}>
        <Icon icon={iconMap.Check} size={11} color={th.colors.neutral.card} strokeWidth={3} />
      </Animated.View>
    </Animated.View>
  )
}

export function ReportStage({ active, reduceMotion }: StageProps) {
  const { t } = useT("mobile-onboarding")
  const { t: tWizard } = useT("report-wizard")
  const th = useTheme()
  const styles = useStyles()
  const progress = useStageTimeline(active, reduceMotion, TOTAL_MS)

  const cardStyle = useAnimatedStyle(() => {
    const enter = GRAVITY_EASE(segment(progress.value, W_CARD[0], W_CARD[1]))
    const leave = STANDARD_EASE(segment(progress.value, W_COMPRESS[0], W_COMPRESS[1]))
    return {
      opacity: interpolate(enter, [0, 0.3, 1], [0, 1, 1], Extrapolation.CLAMP) * (1 - leave),
      transform: [{ translateY: (enter - 1) * CARD_RISE + leave * 12 }, { scale: 1 - leave * 0.18 }],
    }
  })

  const shutterStyle = useAnimatedStyle(() => {
    const pulse = Math.sin(Math.PI * segment(progress.value, W_SHUTTER[0], W_SHUTTER[1]))
    return { transform: [{ scale: 1 + pulse * 0.18 }], opacity: 1 - pulse * 0.3 }
  })

  const pinStyle = useAnimatedStyle(() => {
    const drop = GRAVITY_EASE(segment(progress.value, W_PIN[0], W_PIN[1]))
    const squash = Math.sin(Math.PI * segment(progress.value, W_SQUASH[0], W_SQUASH[1]))
    const scaleY = 1 - squash * 0.1
    const scaleX = 1 + squash * 0.08
    return {
      opacity: interpolate(drop, [0, 0.15], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateY: (drop - 1) * PIN_DROP + (PIN_HEIGHT * (1 - scaleY)) / 2 },
        { scaleX },
        { scaleY },
      ],
    }
  })

  const glowStyle = useAnimatedStyle(() => {
    const s = segment(progress.value, W_GLOW[0], W_GLOW[1])
    return {
      opacity: interpolate(s, [0, 0.25, 1], [0, 0.3, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(s, [0, 1], [0.35, 1.9], Extrapolation.CLAMP) }],
    }
  })

  const successStyle = useAnimatedStyle(() => {
    const s = GRAVITY_EASE(segment(progress.value, W_SUCCESS[0], W_SUCCESS[1]))
    return {
      opacity: interpolate(s, [0, 0.35], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: (1 - s) * STAGE_RISE_PX }],
    }
  })

  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityLabel={t("a11y.stage_report")}
      style={styles.root}
    >
      <View
        style={styles.inner}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <MapStill stage="report" style={styles.map}>
          {(frame) => (
            <View
              style={[
                spotStyle(frame.at(REPORT_PIN_SPOT), -PIN_SIZE / 2, -PIN_HEIGHT),
                styles.pinWrap,
              ]}
            >
              <Animated.View style={[styles.glow, glowStyle]} />
              <Animated.View style={pinStyle}>
                <TeardropPin category={SELECTED_CATEGORY} size={PIN_SIZE} />
              </Animated.View>
            </View>
          )}
        </MapStill>

        <Animated.View style={[styles.successRow, successStyle]}>
          <Text variant="heading" style={styles.successTitle} numberOfLines={2}>
            {tWizard("submit.success_title")}
          </Text>
        </Animated.View>

        <Animated.View style={[styles.card, cardStyle]}>
          <Text variant="caption">{t("report.stage.capture")}</Text>
          <View style={styles.cardBody}>
            <View style={styles.frame}>
              <Animated.View style={[styles.shutter, shutterStyle]}>
                <Icon icon={iconMap.Camera} size={17} color={th.colors.accent} />
              </Animated.View>
            </View>
            <View style={styles.types}>
              <Text variant="caption">{t("report.stage.what")}</Text>
              {REPORT_STAGE_TYPES.map((type, i) => (
                <TypeRow key={type} index={i} progress={progress} />
              ))}
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => {
  const selectedColor = categoryColor(SELECTED_CATEGORY, t.scheme)
  return {
    root: {
      width: "100%",
      aspectRatio: STAGE_ASPECT_RATIO,
    },
    inner: {
      flex: 1,
    },
    map: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: "80%",
    },
    pinWrap: {
      width: PIN_SIZE,
      alignItems: "center",
    },
    glow: {
      position: "absolute",
      left: (PIN_SIZE - GLOW_SIZE) / 2,
      top: PIN_HEIGHT - GLOW_SIZE / 2 - 6,
      width: GLOW_SIZE,
      height: GLOW_SIZE,
      borderRadius: GLOW_SIZE / 2,
      backgroundColor: selectedColor,
    },
    successRow: {
      position: "absolute",
      left: 0,
      right: 0,
      top: "82%",
      paddingHorizontal: t.space["4"],
    },
    successTitle: {
      textAlign: "center"
    },
    card: {
      position: "absolute",
      left: 0,
      right: 0,
      top: "4%",
      gap: t.space["2"],
      padding: t.space["3"],
      borderRadius: t.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      ...t.shadows.s2,
    },
    cardBody: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.space["3"],
    },
    frame: {
      width: FRAME_SIZE,
      height: FRAME_SIZE,
      borderRadius: t.radius.md,
      backgroundColor: t.colors.bgAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    shutter: {
      width: SHUTTER_SIZE,
      height: SHUTTER_SIZE,
      borderRadius: SHUTTER_SIZE / 2,
      borderWidth: 3,
      borderColor: t.colors.accent,
      backgroundColor: t.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    types: {
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    typeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.space["2"],
      paddingHorizontal: 6,
      paddingVertical: 4,
      borderRadius: t.radius.sm,
      overflow: "hidden",
    },
    typeRowTint: {
      backgroundColor: wash(selectedColor, SELECTED_TINT_AMOUNT, t),
      borderRadius: t.radius.sm,
    },
    typeLabel: {
      flex: 1,
      minWidth: 0,
    },
    check: {
      width: CHECK_SIZE,
      height: CHECK_SIZE,
      borderRadius: CHECK_SIZE / 2,
      backgroundColor: selectedColor,
      alignItems: "center",
      justifyContent: "center",
    },
  }
})
