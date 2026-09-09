import React from "react"
import { View, Pressable } from "react-native"
import { avatarGradient, type ReplyToDTO } from "@civfix/shared"
import { alpha } from "../theme/alpha"
import { makeThemedStyles, useTheme, webCursorPointer, focusRingProps } from "../theme"
import { Text } from "../typography"
import { useT } from "../i18n"

export interface ReplyQuoteProps {
  replyTo: ReplyToDTO
  mine: boolean
  onPress?: () => void
  loading?: boolean
}

export function ReplyQuote({ replyTo, mine, onPress, loading = false }: ReplyQuoteProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("conversation")
  const author = replyTo.from?.displayName ?? t("bubble.reply_unknown_author")
  const deleted = replyTo.deleted === true
  const excerptBody = replyTo.excerpt.replace(/\s+/g, " ").trim()
  const excerpt = deleted ? t("bubble.reply_deleted") : excerptBody || t("bubble.reply_media")
  const accent = mine
    ? th.colors.onAccent
    : replyTo.from
      ? avatarGradient(replyTo.from.id)[0]
      : th.colors.textMuted
  const inner = (
    <>
      <View style={[styles.accentLine, { backgroundColor: accent }]} />
      <View style={styles.textCol}>
        <Text style={[styles.author, { color: accent }]} numberOfLines={1}>
          {author}
        </Text>
        <Text
          style={[
            styles.excerpt,
            mine ? styles.excerptMine : styles.excerptTheirs,
            deleted ? styles.excerptDeleted : null,
          ]}
          numberOfLines={1}
        >
          {excerpt}
        </Text>
      </View>
    </>
  )
  const a11yLabel = t("bubble.reply_quote_a11y", { name: author, excerpt })
  if (!onPress) {
    return (
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={a11yLabel}
        style={[styles.root, mine ? styles.rootMine : styles.rootTheirs, loading ? styles.loading : null]}
      >
        {inner}
      </View>
    )
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      {...focusRingProps}
      style={({ pressed }) => [
        styles.root,
        mine ? styles.rootMine : styles.rootTheirs,
        webCursorPointer,
        pressed ? styles.pressed : null,
        loading ? styles.loading : null,
      ]}
    >
      {inner}
    </Pressable>
  )
}

const ON_BLOOM_QUOTE_BG_ALPHA = 0.18
const ON_BLOOM_EXCERPT_ALPHA = 0.85

const useStyles = makeThemedStyles((t) => ({
  root: {
    flexDirection: "row",
    alignSelf: "stretch",
    gap: t.space["2"],
    paddingVertical: 3,
    paddingLeft: t.space["2"],
    paddingRight: t.space["2"] + 2,
    borderRadius: t.radius.sm,
    marginBottom: 5,
    overflow: "hidden",
  },
  rootTheirs: {
    backgroundColor: t.colors.surfaceTint,
  },
  rootMine: {
    backgroundColor: alpha(t.colors.onAccent, ON_BLOOM_QUOTE_BG_ALPHA),
  },
  accentLine: {
    width: 3,
    alignSelf: "stretch",
    borderRadius: 1.5,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  author: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 12,
  },
  excerpt: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    marginTop: 1,
  },
  excerptTheirs: {
    color: t.colors.textMuted,
  },
  excerptMine: {
    color: alpha(t.colors.onAccent, ON_BLOOM_EXCERPT_ALPHA),
  },
  excerptDeleted: {
    fontStyle: "italic",
  },
  pressed: {
    opacity: 0.7,
  },
  loading: {
    opacity: 0.5,
  },
}))
