import React, { useMemo } from "react"
import { StyleSheet, View } from "react-native"
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from "react-native-reanimated"
import type { ChatItem } from "@civfix/shared"
import {
  Avatar,
  Bubble,
  EventCard,
  EventPin,
  Icon,
  RsvpPill,
  Text,
  TypingBubble,
  VerifiedBadge,
  formatHoursDisplay,
  iconMap,
} from "@civfix/ui"
import { useLocale, useT } from "@civfix/ui/i18n"
import { makeThemedStyles, useTheme } from "@/theme"
import {
  DEMO_ATTENDEES,
  DEMO_GOING_AFTER,
  DEMO_GOING_BEFORE,
  DEMO_HOURS_CREDITED,
  DEMO_NEIGHBOR,
  DEMO_ORGANIZER,
  TOGETHER_EVENT_PIN_X,
  TOGETHER_EVENT_PIN_Y,
  demoChatItems,
  demoCleanup,
} from "../demoWorld"
import { PaperMap, mapSpot } from "./PaperMap"
import {
  GRAVITY_EASE,
  STAGE_DROP_PX,
  STAGE_RISE_PX,
  STANDARD_EASE,
  segment,
  stageStops,
  stageWindow,
  useStageStep,
  useStageTimeline,
} from "./stageMotion"
import { STAGE_ASPECT_RATIO, type StageProps } from "./stageTypes"

const TOTAL_MS = 5200

const W_PIN = stageWindow(TOTAL_MS, 0, 420)
const W_SQUASH = stageWindow(TOTAL_MS, 420, 580)
const W_CARD = stageWindow(TOTAL_MS, 500, 920)
const W_GOING = stageWindow(TOTAL_MS, 1700, 2060)
const W_HOURS = stageWindow(TOTAL_MS, 2200, 2620)
const W_ASK = stageWindow(TOTAL_MS, 2900, 3200)
const TYPING_IN_MS = 3300
const TYPING_OUT_MS = 3980
const W_TYPING_IN = stageWindow(TOTAL_MS, TYPING_IN_MS, 3520)
const W_TYPING_OUT = stageWindow(TOTAL_MS, 3820, TYPING_OUT_MS)
const W_REPLY = stageWindow(TOTAL_MS, 3900, 4220)
const W_PROFILE = stageWindow(TOTAL_MS, 4400, 4760)

const STEP_STOPS = stageStops(TOTAL_MS, 1300, 1880, TYPING_IN_MS, TYPING_OUT_MS)
const TYPING_STEP = 3

const PIN_SIZE = 34
const PIN_HEIGHT = Math.round(PIN_SIZE * (76 / 64))
const PIN_DROP = STAGE_DROP_PX * 4
const AVATAR_SIZE = 22
const AVATAR_OVERLAP = -8
const PROFILE_AVATAR_SIZE = 28
const MAP_STRIP_MIN_HEIGHT = 54
const GUEST_PATH = "/"

function noop(): void {}

function StageBubble({ item, showName }: { item: ChatItem; showName: boolean }) {
  return (
    <Bubble
      item={item}
      showName={showName}
      groupStart
      groupEnd
      isGroup={false}
      canEdit={false}
      canDelete={false}
      canReact={false}
      canReply={false}
      canVote={false}
      onRetry={noop}
      onEdit={noop}
      onReply={noop}
      onDelete={noop}
      onReport={noop}
      onToggleReaction={noop}
      onOpenPerson={noop}
    />
  )
}

export function TogetherStage({ active, reduceMotion }: StageProps) {
  const { t } = useT("mobile-onboarding")
  const th = useTheme()
  const styles = useStyles()
  const { locale } = useLocale()
  const progress = useStageTimeline(active, reduceMotion, TOTAL_MS)
  const step = useStageStep(progress, STEP_STOPS)

  const going = step >= 1
  const goingCount = step >= 2 ? DEMO_GOING_AFTER : DEMO_GOING_BEFORE
  const typingVisible = active && step === TYPING_STEP

  const eventTitle = t("together.stage.event_title")
  const eventAddress = t("together.stage.event_address")
  const cleanup = useMemo(
    () => demoCleanup(eventTitle, eventAddress, goingCount),
    [eventTitle, eventAddress, goingCount],
  )

  const askBody = t("together.stage.chat_1")
  const replyBody = t("together.stage.chat_2")
  const chat = useMemo(() => demoChatItems(askBody, replyBody), [askBody, replyBody])

  const pinStyle = useAnimatedStyle(() => {
    const drop = GRAVITY_EASE(segment(progress.value, W_PIN[0], W_PIN[1]))
    const bounce = Math.sin(Math.PI * segment(progress.value, W_SQUASH[0], W_SQUASH[1]))
    const scaleY = 1 - bounce * 0.1
    return {
      opacity: interpolate(drop, [0, 0.15], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateY: (drop - 1) * PIN_DROP + (PIN_HEIGHT * (1 - scaleY)) / 2 },
        { scaleX: 1 + bounce * 0.08 },
        { scaleY },
      ],
    }
  })

  const cardStyle = useAnimatedStyle(() => {
    const s = GRAVITY_EASE(segment(progress.value, W_CARD[0], W_CARD[1]))
    return {
      opacity: interpolate(s, [0, 0.3], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: (s - 1) * STAGE_DROP_PX * 3 }],
    }
  })

  const goingStyle = useAnimatedStyle(() => {
    const s = STANDARD_EASE(segment(progress.value, W_GOING[0], W_GOING[1]))
    return { opacity: s, transform: [{ translateY: (1 - s) * STAGE_RISE_PX }] }
  })

  const hoursStyle = useAnimatedStyle(() => {
    const s = GRAVITY_EASE(segment(progress.value, W_HOURS[0], W_HOURS[1]))
    return {
      opacity: interpolate(s, [0, 0.3], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: (s - 1) * STAGE_DROP_PX * 2 }],
    }
  })

  const askStyle = useAnimatedStyle(() => {
    const s = STANDARD_EASE(segment(progress.value, W_ASK[0], W_ASK[1]))
    return { opacity: s, transform: [{ translateY: (1 - s) * STAGE_RISE_PX }] }
  })

  const typingStyle = useAnimatedStyle(() => {
    const enter = STANDARD_EASE(segment(progress.value, W_TYPING_IN[0], W_TYPING_IN[1]))
    const leave = segment(progress.value, W_TYPING_OUT[0], W_TYPING_OUT[1])
    return { opacity: enter * (1 - leave) }
  })

  const replyStyle = useAnimatedStyle(() => {
    const s = STANDARD_EASE(segment(progress.value, W_REPLY[0], W_REPLY[1]))
    return { opacity: s, transform: [{ translateY: (1 - s) * STAGE_RISE_PX }] }
  })

  const profileStyle = useAnimatedStyle(() => {
    const s = STANDARD_EASE(segment(progress.value, W_PROFILE[0], W_PROFILE[1]))
    return { opacity: s, transform: [{ translateY: (1 - s) * STAGE_RISE_PX }] }
  })

  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityLabel={t("a11y.stage_together")}
      style={styles.root}
    >
      <View
        style={styles.inner}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.mapStrip}>
          <PaperMap style={StyleSheet.absoluteFill} />
          <Animated.View
            style={[
              mapSpot(TOGETHER_EVENT_PIN_X, TOGETHER_EVENT_PIN_Y, -PIN_SIZE / 2, -PIN_HEIGHT),
              pinStyle,
            ]}
          >
            <EventPin size={PIN_SIZE} />
          </Animated.View>
        </View>

        <Animated.View style={[styles.card, cardStyle]}>
          <EventCard cleanup={cleanup} onPress={noop} />
        </Animated.View>

        <Animated.View style={[styles.goingRow, goingStyle]}>
          <View style={styles.avatarStack}>
            {DEMO_ATTENDEES.slice(0, goingCount).map((person, i) => (
              <Avatar
                key={person.id}
                name={person.name}
                seed={person.id}
                size={AVATAR_SIZE}
                decorative
                style={i === 0 ? undefined : styles.avatarOverlap}
              />
            ))}
          </View>
          <Text variant="caption" style={styles.goingLabel}>
            {t("together.stage.going", { count: goingCount })}
          </Text>
          <RsvpPill
            going={going}
            onToggle={noop}
            onSignedOutPress={noop}
            nextPath={GUEST_PATH}
            size="sm"
          />
        </Animated.View>

        <View style={styles.chat}>
          <Animated.View style={askStyle}>
            <StageBubble item={chat[0]} showName={false} />
          </Animated.View>
          <View style={styles.replySlot}>
            <Animated.View style={replyStyle}>
              <StageBubble item={chat[1]} showName />
            </Animated.View>
            {typingVisible ? (
              <Animated.View style={[StyleSheet.absoluteFill, typingStyle]}>
                <TypingBubble name={DEMO_NEIGHBOR.name} color={th.colors.textMuted} />
              </Animated.View>
            ) : null}
          </View>
        </View>

        <Animated.View style={[styles.profileRow, profileStyle]}>
          <Avatar
            name={DEMO_ORGANIZER.name}
            seed={DEMO_ORGANIZER.id}
            size={PROFILE_AVATAR_SIZE}
            decorative
          />
          <Text variant="bodyStrong" numberOfLines={1} style={styles.handle}>
            {`@${DEMO_ORGANIZER.handle}`}
          </Text>
          <VerifiedBadge size="sm" />
          <Text variant="caption" numberOfLines={1} style={styles.organizer}>
            {t("together.stage.organizer")}
          </Text>
          <Animated.View style={[styles.hoursChip, hoursStyle]}>
            <Icon icon={iconMap.Clock} size={11} color={th.colors.moss["700"]} />
            <Text variant="caption" color={th.colors.moss["700"]}>
              {t("together.stage.hours", {
                hours: formatHoursDisplay(DEMO_HOURS_CREDITED, locale),
              })}
            </Text>
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    width: "100%",
    aspectRatio: STAGE_ASPECT_RATIO,
    overflow: "hidden",
  },
  inner: {
    flex: 1,
  },
  mapStrip: {
    flex: 1,
    minHeight: MAP_STRIP_MIN_HEIGHT,
  },
  card: {
    marginTop: -t.space["4"],
  },
  goingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    marginTop: t.space["2"],
  },
  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarOverlap: {
    marginLeft: AVATAR_OVERLAP,
  },
  goingLabel: {
    flex: 1,
    minWidth: 0,
  },
  chat: {
    marginTop: t.space["2"],
  },
  replySlot: {
    marginTop: t.space["1"],
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: t.space["2"],
  },
  handle: {
    flexShrink: 0,
  },
  organizer: {
    flex: 1,
    minWidth: 0,
  },
  hoursChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: t.space["2"],
    paddingVertical: 3,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.moss["50"],
  },
}))
