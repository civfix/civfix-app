import React from "react"
import { View, Pressable, StyleSheet } from "react-native"
import type { ChatMessageDTO } from "@civfix/shared"
import {
  makeThemedStyles,
  useTheme,
  webCursorPointer,
  webTransition,
  webHover,
  focusRingProps,
} from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"

const BAR_HEIGHT = 40
const SEGMENT_CAP = 4

export interface PinnedBarProps {
  pins: ChatMessageDTO[]
  activeIndex: number
  onTap: () => void
  onOpenList?: () => void
}

export function PinnedBar({ pins, activeIndex, onTap, onOpenList }: PinnedBarProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("conversation")
  if (pins.length === 0) return null
  const index = Math.min(Math.max(activeIndex, 0), pins.length - 1)
  const active = pins[index]!
  const excerptBody = (active.body ?? "").replace(/\s+/g, " ").trim()
  const excerpt = excerptBody || t("bubble.reply_media")
  const segments = Math.min(pins.length, SEGMENT_CAP)
  const highlighted = Math.min(index, segments - 1)
  return (
    <View style={styles.root}>
      <Pressable
        onPress={onTap}
        accessibilityRole="button"
        accessibilityLabel={t("pins.a11y_bar", { index: index + 1, count: pins.length, excerpt })}
        {...focusRingProps}
        style={(state) => [
          styles.bar,
          webCursorPointer,
          webTransition,
          webHover(state) ? styles.barHovered : null,
          state.pressed ? styles.pressed : null,
        ]}
      >
        <View style={styles.segments} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: segments }, (_, i) => (
            <View key={i} style={[styles.segment, i === highlighted ? styles.segmentActive : null]} />
          ))}
        </View>
        <View style={styles.textCol}>
          <Text style={styles.kicker} numberOfLines={1}>
            {t("pins.bar_label")}
          </Text>
          <Text style={styles.excerpt} numberOfLines={1}>
            {excerpt}
          </Text>
        </View>
      </Pressable>
      {onOpenList ? (
        <Pressable
          onPress={onOpenList}
          accessibilityRole="button"
          accessibilityLabel={t("pins.a11y_open_list")}
          hitSlop={6}
          {...focusRingProps}
          style={(state) => [
            styles.listBtn,
            webCursorPointer,
            webTransition,
            webHover(state) ? styles.barHovered : null,
            state.pressed ? styles.pressed : null,
          ]}
        >
          <Icon icon={iconMap.List} size={18} color={th.colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    height: BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
    paddingHorizontal: t.space["3"],
    gap: t.space["2"],
  },
  bar: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  barHovered: {
    opacity: 0.85,
  },
  segments: {
    width: 3,
    alignSelf: "stretch",
    marginVertical: 7,
    justifyContent: "center",
    gap: 2,
  },
  segment: {
    flex: 1,
    width: 3,
    borderRadius: 1.5,
    backgroundColor: t.colors.moss["100"],
  },
  segmentActive: {
    backgroundColor: t.colors.brand.moss,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  kicker: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 11.5,
    color: t.colors.brand.moss,
  },
  excerpt: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    color: t.colors.textMuted,
    marginTop: 1,
  },
  listBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
}))
