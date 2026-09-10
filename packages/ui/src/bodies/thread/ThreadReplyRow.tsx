import React from "react"
import { Pressable, StyleSheet, View } from "react-native"
import type { PostDTO } from "@civfix/shared"
import { focusRingProps, makeThemedStyles } from "../../theme"
import { Text } from "../../typography"
import { useT } from "../../i18n"
import { Avatar } from "../../primitives/Avatar"
import {
  PostActionBar,
  postActionGlyphInset,
  postActionLayout,
} from "../../primitives/PostActionBar"
import { useNavStore } from "../../nav/useNavStore"
import type { DetailEntry } from "../../nav/types"
import { LinkedEventCard } from "../LinkedEventCard"
import { LinkedReportCard } from "../LinkedReportCard"
import { localReportThumb } from "../localReportThumbs"
import { PostMediaGrid } from "../PostMediaGrid"
import { repostSubjectAuthorId, splitPostBodyMentions } from "../postCardModel"
import { useListTimeAgo } from "../useListTimeAgo"
import {
  THREAD_RAIL_COLUMN_W,
  THREAD_RAIL_GAP,
  THREAD_RAIL_STUB_H,
  THREAD_RAIL_W,
  type ThreadRailSegment,
  type ThreadRowExpansion,
} from "./threadModel"

export interface ThreadReplyRowProps {
  post: PostDTO
  rail: ThreadRailSegment
  hairline?: boolean
  isOptimistic?: boolean
  failed?: boolean
  onRetry?: () => void
  expansion?: ThreadRowExpansion
  onToggleExpand?: (postId: string, expansion: ThreadRowExpansion) => void
  onReply?: (post: PostDTO) => void
  onOpenEntry?: (entry: DetailEntry) => void
}

export const ThreadReplyRow = React.memo(function ThreadReplyRow({
  post,
  rail,
  hairline = true,
  isOptimistic = false,
  failed = false,
  onRetry,
  expansion,
  onToggleExpand,
  onReply,
  onOpenEntry,
}: ThreadReplyRowProps) {
  const styles = useStyles()
  const { t } = useT("home-feed")
  const push = useNavStore((state) => state.push)
  const openEntry = onOpenEntry ?? push
  const segments = React.useMemo(
    () => splitPostBodyMentions(post.body ?? "", post.mentions),
    [post.body, post.mentions],
  )
  const openPerson = React.useCallback(
    (personId: string) => openEntry({ kind: "person", id: personId }),
    [openEntry],
  )
  const onComment = React.useCallback(() => {
    if (onReply) onReply(post)
    else openEntry({ kind: "post-thread", id: post.id })
  }, [onReply, post, openEntry])
  const onQuote = React.useCallback(
    () => openEntry({ kind: "composer", composerMode: "quote", targetPostId: post.id }),
    [openEntry, post.id],
  )
  const timeAgo = useListTimeAgo()
  const handle = post.author.handle?.replace(/^@/, "") ?? null
  const metaTail = `${handle ? `@${handle} · ` : ""}${isOptimistic ? t("thread.sending") : timeAgo(post.createdAt)}`

  const control: ThreadRowExpansion =
    expansion ?? (!isOptimistic && post.counts.replies > 0 ? "navigate" : "none")

  return (
    <View
      style={[
        styles.outer,
        hairline ? styles.outerRule : null,
        failed ? styles.outerFailed : null,
        isOptimistic ? styles.outerOptimistic : null,
      ]}
    >
      <View style={styles.row}>
        <View style={styles.railColumn}>
          {rail.above ? <View style={styles.railAbove} /> : null}
          <Pressable
            onPress={() => openPerson(post.author.id)}
            accessibilityRole="button"
            accessibilityLabel={t("post_card.profile_a11y", { name: post.author.name })}
            hitSlop={5}
            {...focusRingProps}
          >
            <Avatar
              name={post.author.name}
              seed={post.author.id}
              photoUrl={post.author.avatarUrl}
              gradient={post.author.avatar ?? null}
              size={36}
              decorative
            />
          </Pressable>
          {rail.below ? <View style={styles.railBelow} /> : null}
        </View>

        <View style={styles.content}>
          <View style={styles.metaRow}>
            <Text numberOfLines={1} style={styles.metaName}>
              {post.author.name}
            </Text>
            <Text numberOfLines={1} style={styles.metaTail}>
              {metaTail}
            </Text>
          </View>

          {segments.length > 0 ? (
            <Text style={styles.body}>
              {segments.map((segment, index) =>
                segment.kind === "mention" ? (
                  <Text
                    key={`${segment.userId}-${index}`}
                    style={styles.bodyMention}
                    onPress={() => openPerson(segment.userId)}
                  >
                    {segment.text}
                  </Text>
                ) : (
                  segment.text
                ),
              )}
            </Text>
          ) : null}

          {(post.media ?? []).length > 0 ? (
            <View style={styles.block}>
              <PostMediaGrid media={post.media ?? []} t={t} radius={14} maxHeight={240} />
            </View>
          ) : null}

          {post.event ? (
            <View style={styles.block}>
              <LinkedEventCard
                event={post.event}
                layout="list"
                onPress={() => openEntry({ kind: "cleanup", id: post.event!.id })}
              />
            </View>
          ) : null}

          {post.report ? (
            <View style={styles.block}>
              <LinkedReportCard
                report={{
                  ...post.report,
                  thumbUrl: post.report.thumbUrl ?? localReportThumb(post.report.id),
                }}
                layout="list"
                headline="title"
                onPress={() => openEntry({ kind: "pin", id: post.report!.id })}
              />
            </View>
          ) : null}

          {failed ? (
            <Pressable
              accessibilityRole="button"
              onPress={onRetry}
              {...focusRingProps}
              style={({ pressed }) => [styles.retry, pressed ? styles.pressed : null]}
            >
              <Text style={styles.retryText}>{t("thread.tap_to_retry")}</Text>
            </Pressable>
          ) : (
            <View style={styles.actionsWrap} pointerEvents={isOptimistic ? "none" : "auto"}>
              <PostActionBar
                variant="reply"
                postId={post.id}
                counts={post.counts}
                viewer={post.viewer}
                authorId={repostSubjectAuthorId(post)}
                title={post.report?.title ?? t("post_card.share_title", { name: post.author.name })}
                onComment={onComment}
                onQuote={onQuote}
              />
            </View>
          )}

          {control !== "none" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: control === "collapse" }}
              onPress={() =>
                onToggleExpand
                  ? onToggleExpand(post.id, control)
                  : openEntry({ kind: "post-thread", id: post.id })
              }
              {...focusRingProps}
              style={({ pressed }) => [styles.showReplies, pressed ? styles.pressed : null]}
            >
              <Text style={styles.showRepliesText}>
                {control === "collapse"
                  ? t("thread.hide_replies")
                  : t("thread.show_replies", { count: post.counts.replies })}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  )
})

const useStyles = makeThemedStyles((t) => ({
  outer: {},
  outerRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  outerOptimistic: {
    opacity: 0.55,
  },
  outerFailed: {
    borderLeftWidth: 3,
    borderLeftColor: t.colors.bloom["600"],
  },
  row: {
    flexDirection: "row",
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["3"],
    paddingBottom: t.space["2"],
  },
  railColumn: {
    width: THREAD_RAIL_COLUMN_W,
    alignItems: "center",
  },
  railAbove: {
    width: THREAD_RAIL_W,
    marginTop: -t.space["3"],
    height: t.space["3"] + THREAD_RAIL_STUB_H,
    marginBottom: 2,
    borderRadius: THREAD_RAIL_W / 2,
    backgroundColor: t.colors.border,
  },
  railBelow: {
    width: THREAD_RAIL_W,
    flex: 1,
    marginTop: 6,
    marginBottom: -t.space["2"],
    borderRadius: THREAD_RAIL_W / 2,
    backgroundColor: t.colors.border,
  },
  content: {
    flex: 1,
    minWidth: 0,
    marginLeft: THREAD_RAIL_GAP,
    gap: t.space["1"],
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["1"],
  },
  metaName: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 14.5,
    lineHeight: 19,
    color: t.colors.text,
  },
  metaTail: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: t.colors.textSubtle,
  },
  body: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 15,
    lineHeight: 21,
    color: t.colors.text,
  },
  bodyMention: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 15,
    lineHeight: 21,
    color: t.colors.accentText,
  },
  block: {
    marginTop: 6,
  },
  actionsWrap: {
    marginTop: t.space["1"],
    marginLeft: -postActionGlyphInset(postActionLayout("reply")),
  },
  showReplies: {
    minHeight: 32,
    justifyContent: "center",
    marginLeft: -6,
    paddingHorizontal: 6,
    alignSelf: "flex-start",
  },
  showRepliesText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13.5,
    lineHeight: 18,
    color: t.colors.accentText,
  },
  retry: {
    minHeight: 32,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  retryText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13.5,
    lineHeight: 18,
    color: t.colors.bloom["600"],
  },
  pressed: {
    opacity: 0.6,
  },
}))
