import React, { useCallback, useEffect, useRef, useState } from "react"
import { View, Pressable, StyleSheet, Animated, Easing, Platform } from "react-native"
import { TextInput } from "../primitives/TextInput"
import { makeThemedStyles, useTheme, focusRingProps, MIN_TOUCH_TARGET } from "../theme"
import { useReducedMotion } from "../theme/useReducedMotion"
import { useT } from "../i18n"
import { Text, Icon, iconMap } from "../typography"
import { Avatar, Toggle } from "../primitives"
import { useAuthState, useMyProfile } from "../data"
import { FEED_CAPTION_MAX, FEED_CAPTION_COUNTER_AT } from "./feedShare"

const ENTRANCE_MS = 180

export interface FeedShareBlockProps {
  enabled: boolean
  onToggle: (next: boolean) => void
  caption: string
  onChangeCaption: (next: string) => void
  label: string
  helper: string
  captionPlaceholder: string
  captionA11yLabel: string
  nowLabel: string
  attachment: React.ReactNode | null
  attachmentPlaceholder?: string
  onRequestReveal?: (y: number) => void
  busy?: boolean
}

export function FeedShareBlock({
  enabled,
  onToggle,
  caption,
  onChangeCaption,
  label,
  helper,
  captionPlaceholder,
  captionA11yLabel,
  nowLabel,
  attachment,
  attachmentPlaceholder,
  onRequestReveal,
  busy = false,
}: FeedShareBlockProps) {
  const styles = useStyles()
  const { isAuthenticated } = useAuthState()
  const me = useMyProfile().data?.profile ?? null
  const yRef = useRef(0)

  const handleToggle = useCallback(
    (next: boolean) => {
      onToggle(next)
      if (next && onRequestReveal) {
        requestAnimationFrame(() => onRequestReveal(yRef.current))
      }
    },
    [onToggle, onRequestReveal],
  )

  if (!isAuthenticated) return null

  return (
    <View
      style={[styles.block, busy ? styles.busy : null]}
      pointerEvents={busy ? "none" : "auto"}
      onLayout={(e) => {
        yRef.current = e.nativeEvent.layout.y
      }}
    >
      <Toggle label={label} helper={helper} value={enabled} onValueChange={handleToggle} />
      {enabled ? (
        <FeedSharePreview
          authorName={me?.name ?? ""}
          authorId={me?.id}
          authorPhotoUrl={me?.avatarUrl ?? null}
          authorAvatar={me?.avatar ?? null}
          nowLabel={nowLabel}
          caption={caption}
          onChangeCaption={onChangeCaption}
          placeholder={captionPlaceholder}
          captionA11yLabel={captionA11yLabel}
          attachment={attachment}
          attachmentPlaceholder={attachmentPlaceholder}
        />
      ) : null}
    </View>
  )
}

export interface FeedSharePreviewProps {
  authorName: string
  authorId?: string
  authorPhotoUrl?: string | null
  authorAvatar?: readonly [string, string] | null
  nowLabel: string
  caption: string
  onChangeCaption?: (next: string) => void
  placeholder?: string
  captionA11yLabel?: string
  attachment: React.ReactNode | null
  attachmentPlaceholder?: string
  onPress?: () => void
  footnote?: string
}

export function FeedSharePreview({
  authorName,
  authorId,
  authorPhotoUrl,
  authorAvatar,
  nowLabel,
  caption,
  onChangeCaption,
  placeholder,
  captionA11yLabel,
  attachment,
  attachmentPlaceholder,
  onPress,
  footnote,
}: FeedSharePreviewProps) {
  const styles = useStyles()
  const t = useTheme()
  const { t: tc } = useT("common")
  const reducedMotion = useReducedMotion()
  const [enter] = useState(() => new Animated.Value(0))
  useEffect(() => {
    if (reducedMotion == null) return
    if (reducedMotion) {
      enter.stopAnimation()
      enter.setValue(1)
      return
    }
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: ENTRANCE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== "web",
    })
    animation.start()
    return () => animation.stop()
  }, [enter, reducedMotion])

  const readOnly = onChangeCaption === undefined
  const overCap = caption.length >= FEED_CAPTION_MAX

  const inner = (
    <>
      <View style={styles.head}>
        <Avatar
          name={authorName}
          seed={authorId}
          photoUrl={authorPhotoUrl}
          gradient={authorAvatar ?? null}
          size={32}
          decorative
        />
        <View style={styles.headText}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {authorName}
          </Text>
          <Text variant="caption" color={t.colors.textSubtle}>
            {nowLabel}
          </Text>
        </View>
      </View>

      {readOnly ? (
        caption.trim().length > 0 ? (
          <Text style={styles.captionRead}>{caption.trim()}</Text>
        ) : null
      ) : (
        <TextInput
          style={styles.caption}
          value={caption}
          onChangeText={onChangeCaption}
          placeholder={placeholder}
          placeholderTextColor={t.colors.textSubtle}
          selectionColor={t.colors.brand.bloom}
          multiline
          maxLength={FEED_CAPTION_MAX}
          textAlignVertical="top"
          accessibilityLabel={captionA11yLabel}
        />
      )}

      {!readOnly && caption.length >= FEED_CAPTION_COUNTER_AT ? (
        <Text
          style={[styles.counter, overCap ? styles.counterMax : null]}
          accessibilityLabel={tc("caption_remaining_a11y", { count: FEED_CAPTION_MAX - caption.length })}
        >
          {FEED_CAPTION_MAX - caption.length}
        </Text>
      ) : null}

      <View style={styles.attach}>
        {attachment ?? (
          <View style={styles.dashed}>
            <Text variant="caption" color={t.colors.textSubtle}>
              {attachmentPlaceholder ?? ""}
            </Text>
          </View>
        )}
      </View>
    </>
  )

  return (
    <Animated.View
      style={[
        styles.preview,
        { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }] },
      ]}
    >
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          {...focusRingProps}
          style={({ pressed }) => (pressed ? styles.pressed : null)}
        >
          {inner}
        </Pressable>
      ) : (
        inner
      )}
      {footnote ? (
        <Text variant="caption" color={t.colors.textSubtle} style={styles.footnote}>
          {footnote}
        </Text>
      ) : null}
    </Animated.View>
  )
}

export function FeedShareEventCard({ title, whenLabel }: { title: string; whenLabel: string }) {
  const styles = useStyles()
  const t = useTheme()
  return (
    <View style={styles.eventCard}>
      <View style={styles.eventGlyph}>
        <Icon icon={iconMap.Calendar} size={22} color={t.colors.moss["700"]} />
      </View>
      <View style={styles.eventBody}>
        <Text variant="bodyStrong" numberOfLines={1} style={styles.eventTitle}>
          {title}
        </Text>
        <Text variant="caption" color={t.colors.textSubtle} numberOfLines={2}>
          {whenLabel}
        </Text>
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  block: { gap: t.space["3"] },
  busy: { opacity: 0.5 },

  preview: {
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  pressed: { opacity: 0.92 },

  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headText: { flex: 1, minWidth: 0 },

  caption: {
    marginTop: t.space["2"],
    paddingHorizontal: 0,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["15"],
    lineHeight: 21,
    color: t.colors.text,
    minHeight: MIN_TOUCH_TARGET,
  },
  captionRead: {
    marginTop: t.space["2"],
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["15"],
    lineHeight: 21,
    color: t.colors.text,
  },
  counter: {
    alignSelf: "flex-end",
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 11,
    color: t.colors.textSubtle,
  },
  counterMax: { color: t.colors.accentText },

  attach: { marginTop: t.space["2"] },
  dashed: {
    height: 72,
    borderRadius: t.radius.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: t.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  footnote: { marginTop: t.space["2"] },

  eventCard: {
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
    minHeight: t.space["16"],
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    overflow: "hidden",
  },
  eventGlyph: {
    width: t.space["16"],
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.moss["50"],
  },
  eventBody: {
    flex: 1,
    minWidth: 0,
    gap: t.space["1"],
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["2"] + 2,
    justifyContent: "center",
  },
  eventTitle: {
    fontSize: 13.5,
    lineHeight: 17,
    color: t.colors.text,
  },
}))
