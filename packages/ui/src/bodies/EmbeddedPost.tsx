import React from "react"
import { Pressable, StyleSheet, View } from "react-native"
import type { TFunction } from "i18next"
import type { PostRefDTO } from "@civfix/shared"
import {
  focusRingProps,
  makeThemedStyles,
  stopPress,
  useTheme,
  webCursor,
  webHover,
  webTransition,
} from "../theme"
import { Text } from "../typography"
import { Avatar } from "../primitives/Avatar"
import { OrgAffiliationBadge } from "../primitives/OrgAffiliationBadge"
import { VerifiedBadge } from "../primitives/VerifiedBadge"
import { PostMediaGrid } from "./PostMediaGrid"
import { buildPostIdentity } from "./postCardModel"

export const EMBEDDED_POST_BODY_CLAMP_LINES = 4

export interface EmbeddedPostProps {
  post: PostRefDTO
  t: TFunction
  timeAgo: (iso: string) => string
  prominent?: boolean
  onPress?: () => void
}

export function EmbeddedPost({ post, t, timeAgo, prominent = false, onPress }: EmbeddedPostProps) {
  const styles = useStyles()
  const th = useTheme()
  const identity = React.useMemo(
    () => buildPostIdentity(post.author, post.organization, t, t("post_card.deleted_account")),
    [post.author, post.organization, t],
  )

  const content = (
    <>
      <View style={styles.header}>
        {post.author || identity.organization ? (
          <Avatar
            name={identity.avatarName}
            seed={identity.avatarSeed}
            photoUrl={identity.avatarUrl}
            gradient={identity.avatarGradient}
            size={prominent ? 40 : 20}
            {...(identity.organization ? { style: styles.orgAvatar } : {})}
            decorative
          />
        ) : null}
        <Text variant="bodyStrong" numberOfLines={1} style={styles.author}>
          {identity.name}
        </Text>
        {identity.official ? <VerifiedBadge size="sm" /> : null}
        {identity.affiliation ? (
          <OrgAffiliationBadge organization={identity.affiliation} size="sm" interactive={false} />
        ) : null}
        {identity.handleLabel ? (
          <Text numberOfLines={1} style={styles.handle}>
            {identity.handleLabel}
          </Text>
        ) : null}
        {identity.viaLabel ? (
          <Text numberOfLines={1} style={styles.handle}>
            {identity.viaLabel}
          </Text>
        ) : null}
        <Text style={styles.time}>{`· ${timeAgo(post.createdAt)}`}</Text>
      </View>
      <Text
        variant="body"
        {...(prominent ? {} : { numberOfLines: EMBEDDED_POST_BODY_CLAMP_LINES })}
        color={post.deleted ? th.colors.textMuted : th.colors.text}
        style={prominent ? styles.bodyProminent : styles.body}
      >
        {post.deleted ? t("post_card.unavailable") : post.excerpt}
      </Text>
      {post.media.length > 0 && !post.deleted ? (
        <PostMediaGrid media={post.media} t={t} radius={12} maxHeight={220} />
      ) : null}
    </>
  )

  if (!onPress) {
    return <View style={[styles.card, prominent ? styles.prominent : null]}>{content}</View>
  }

  return (
    <Pressable
      onPress={(event) => {
        stopPress(event)
        onPress()
      }}
      accessibilityRole="button"
      accessibilityLabel={prominent ? t("post_card.open_repost_a11y") : t("post_card.open_quote_a11y")}
      {...focusRingProps}
      style={(state) => [
        styles.card,
        prominent ? styles.prominent : null,
        webTransition,
        webCursor(false),
        webHover(state) ? styles.cardHovered : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      {content}
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  card: {
    gap: t.space["1"],
    padding: t.space["3"],
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  cardHovered: {
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.surfaceTint,
  },
  prominent: {
    gap: t.space["2"],
    paddingHorizontal: 2,
    paddingVertical: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  pressed: {
    opacity: 0.62,
  },
  orgAvatar: {
    borderRadius: t.radius.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["1"],
  },
  author: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 19,
  },
  handle: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    color: t.colors.textMuted,
  },
  time: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    color: t.colors.textMuted,
  },
  body: {
    fontSize: 14,
    lineHeight: 19,
  },
  bodyProminent: {
    fontSize: 14.5,
    lineHeight: 21,
  },
}))
