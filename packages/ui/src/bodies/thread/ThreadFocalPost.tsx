import React from "react"
import { Pressable, StyleSheet, View } from "react-native"
import type { TFunction } from "i18next"
import type { PostDTO, PostRefDTO } from "@civfix/shared"
import { Repeat2 } from "lucide-react-native/icons"
import { makeThemedStyles, useTheme, categoryColor, focusRingProps, wash, webCursor, webHover, webTransition } from "../../theme"
import { Text, Icon } from "../../typography"
import { useT } from "../../i18n"
import { Avatar } from "../../primitives/Avatar"
import { VerifiedBadge } from "../../primitives/VerifiedBadge"
import {
  PostActionBar,
  formatPostActionCount,
  postActionGlyphInset,
  postActionLayout,
} from "../../primitives/PostActionBar"
import { useNavStore } from "../../nav/useNavStore"
import type { DetailEntry } from "../../nav/types"
import { LinkedEventCard } from "../LinkedEventCard"
import { LinkedReportCard } from "../LinkedReportCard"
import { localReportThumb } from "../localReportThumbs"
import { OrganizerBadge } from "../PostCard"
import { PostMediaGrid } from "../PostMediaGrid"
import { buildPostCardModel, repostSubjectAuthorId, splitPostBodyMentions } from "../postCardModel"
import { focalTimestamp } from "../relativeTime"
import { useListTimeAgo } from "../useListTimeAgo"
import { buildFocalPostStats } from "./threadModel"

export type ThreadFocalParent = PostDTO | PostRefDTO | null

export interface ThreadFocalPostProps {
  post: PostDTO
  parent: ThreadFocalParent
  onFocusComposer: () => void
  onOpenEntry?: (entry: DetailEntry) => void
}

function parentDeleted(parent: NonNullable<ThreadFocalParent>): boolean {
  return (parent as PostRefDTO).deleted === true
}

function ReplyToLine({
  parent,
  t,
  openEntry,
}: {
  parent: NonNullable<ThreadFocalParent>
  t: TFunction
  openEntry: (entry: DetailEntry) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  if (parentDeleted(parent)) {
    return (
      <Text variant="caption" color={th.colors.textSubtle} numberOfLines={1} style={styles.replyToLine}>
        {t("thread.parent_unavailable")}
      </Text>
    )
  }
  const author = parent.author
  const handle = author?.handle?.replace(/^@/, "") ?? null
  const label = handle
    ? t("thread.replying_to", { handle: `@${handle}` })
    : t("thread.replying_to_name", { name: author?.name ?? t("post_card.deleted_account") })
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      onPress={() => openEntry({ kind: "post-thread", id: parent.id })}
      {...focusRingProps}
      style={({ pressed }) => [styles.replyToPress, pressed ? styles.pressed : null]}
    >
      <Text variant="caption" color={th.colors.textSubtle} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

function EmbeddedPost({
  post,
  t,
  timeAgo,
  prominent,
  onPress,
}: {
  post: PostRefDTO
  t: TFunction
  timeAgo: (iso: string) => string
  prominent: boolean
  onPress: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={prominent ? t("post_card.open_repost_a11y") : t("post_card.open_quote_a11y")}
      {...focusRingProps}
      style={(state) => [
        styles.embedded,
        prominent ? styles.embeddedProminent : null,
        webTransition,
        webCursor(false),
        webHover(state) ? styles.embeddedHovered : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.embeddedHeader}>
        {post.author ? (
          <Avatar
            name={post.author.name}
            seed={post.author.id}
            photoUrl={post.author.avatarUrl}
            gradient={post.author.avatar ?? null}
            size={prominent ? 40 : 26}
            decorative
          />
        ) : null}
        <Text variant="bodyStrong" numberOfLines={1} style={styles.embeddedAuthor}>
          {post.author?.name ?? t("post_card.deleted_account")}
        </Text>
        {post.author?.verified ? <VerifiedBadge size="sm" /> : null}
        <Text variant="caption" color={th.colors.textSubtle}>
          {timeAgo(post.createdAt)}
        </Text>
      </View>
      <Text
        variant="body"
        color={post.deleted ? th.colors.textSubtle : th.colors.text}
        style={prominent ? styles.embeddedBodyProminent : null}
      >
        {post.deleted ? t("post_card.unavailable") : post.excerpt}
      </Text>
    </Pressable>
  )
}

export function ThreadFocalPost({ post, parent, onFocusComposer, onOpenEntry }: ThreadFocalPostProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("home-feed")
  const push = useNavStore((state) => state.push)
  const openEntry = onOpenEntry ?? push
  const timeAgo = useListTimeAgo()
  const model = React.useMemo(() => buildPostCardModel(post, t, { timeAgo }), [post, t, timeAgo])
  const stats = React.useMemo(() => buildFocalPostStats(post.counts, t), [post.counts, t])
  const bodySegments = React.useMemo(
    () => splitPostBodyMentions(post.body ?? "", post.mentions),
    [post.body, post.mentions],
  )
  const openPerson = React.useCallback(
    (personId: string) => openEntry({ kind: "person", id: personId }),
    [openEntry],
  )
  const onQuote = React.useCallback(
    () => openEntry({ kind: "composer", composerMode: "quote", targetPostId: post.id }),
    [openEntry, post.id],
  )
  const isFix = model.variant === "fix-confirmed"
  const isRepost = model.variant === "repost" && model.embeddedPost != null
  const handle = post.author.handle?.replace(/^@/, "") ?? null
  const timestamp = focalTimestamp(post.createdAt)
  const timestampLine = post.editedAt != null ? `${timestamp} · ${t("thread.edited")}` : timestamp

  return (
    <View style={styles.root}>
      {parent ? <ReplyToLine parent={parent} t={t} openEntry={openEntry} /> : null}

      {model.repostAttribution ? (
        <View style={styles.repostAttribution}>
          <Icon icon={Repeat2} size={15} color={th.colors.textMuted} />
          <Text variant="caption" color={th.colors.textMuted} style={styles.repostAttributionText}>
            {model.repostAttribution}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={() => openPerson(post.author.id)}
        accessibilityRole="button"
        accessibilityLabel={t("post_card.profile_a11y", { name: post.author.name })}
        hitSlop={5}
        {...focusRingProps}
        style={({ pressed }) => [styles.authorRow, pressed ? styles.pressed : null]}
      >
        <Avatar
          name={post.author.name}
          seed={post.author.id}
          photoUrl={post.author.avatarUrl}
          gradient={post.author.avatar ?? null}
          size={44}
          decorative
        />
        <View style={styles.authorCopy}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.authorName}>
              {post.author.name}
            </Text>
            {post.author.verified ? <VerifiedBadge size="sm" /> : null}
            {model.showOrganizerBadge ? <OrganizerBadge t={t} /> : null}
          </View>
          {handle ? (
            <Text variant="caption" color={th.colors.textSubtle} numberOfLines={1}>
              {`@${handle}`}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {!isFix && !isRepost && bodySegments.length > 0 ? (
        <Text style={styles.body}>
          {bodySegments.map((segment, index) =>
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

      {!isFix && !isRepost && (post.media ?? []).length > 0 ? (
        <View style={styles.block}>
          <PostMediaGrid media={post.media ?? []} t={t} radius={18} maxHeight={320} />
        </View>
      ) : null}

      {isFix && post.report ? (
        <View style={[styles.block, styles.fixBlock]}>
          <Text variant="title" style={styles.fixTitle}>
            {post.report.title}
          </Text>
          {model.resolutionLabel ? (
            <Text style={styles.resolutionText}>{model.resolutionLabel}</Text>
          ) : null}
          {model.categoryLabel ? (
            <View
              style={[
                styles.categoryPill,
                { backgroundColor: wash(categoryColor(post.report.category, th.scheme), 0.82, th) },
              ]}
            >
              <Text style={[styles.categoryPillText, { color: categoryColor(post.report.category, th.scheme) }]}>
                {model.categoryLabel}
              </Text>
            </View>
          ) : null}
          <PostMediaGrid media={post.media ?? []} t={t} radius={18} maxHeight={320} />
        </View>
      ) : null}

      {!isFix && !isRepost && post.event ? (
        <View style={styles.block}>
          <LinkedEventCard
            event={post.event}
            layout="list"
            showAttendees
            onPress={() => openEntry({ kind: "cleanup", id: post.event!.id })}
          />
        </View>
      ) : null}

      {!isFix && !isRepost && post.report ? (
        <View style={styles.block}>
          <LinkedReportCard
            report={{ ...post.report, thumbUrl: post.report.thumbUrl ?? localReportThumb(post.report.id) }}
            layout="list"
            headline="title"
            onPress={() => openEntry({ kind: "pin", id: post.report!.id })}
          />
        </View>
      ) : null}

      {model.embeddedPost ? (
        <View style={styles.block}>
          <EmbeddedPost
            post={model.embeddedPost}
            t={t}
            timeAgo={timeAgo}
            prominent={isRepost}
            onPress={() => openEntry({ kind: "post-thread", id: model.embeddedPost!.id })}
          />
        </View>
      ) : null}

      {timestampLine ? (
        <Text variant="caption" color={th.colors.textSubtle} style={styles.timestamp}>
          {timestampLine}
        </Text>
      ) : null}

      <View style={styles.divider} />

      {stats.length > 0 ? (
        <>
          <View style={styles.statsRow}>
            {stats.map((stat) => (
              <Text key={stat.key} variant="caption">
                <Text style={styles.statCount}>{formatPostActionCount(stat.count)}</Text>
                {" "}
                <Text style={styles.statLabel}>{stat.label}</Text>
              </Text>
            ))}
          </View>
          <View style={styles.divider} />
        </>
      ) : null}

      <PostActionBar
        variant="focal"
        postId={post.id}
        counts={post.counts}
        viewer={post.viewer}
        authorId={repostSubjectAuthorId(post)}
        title={post.report?.title ?? t("post_card.share_title", { name: post.author.name })}
        onComment={onFocusComposer}
        onQuote={onQuote}
        style={styles.actionBar}
      />

      <View style={styles.openingDivider} />
    </View>
  )
}

export function ThreadFocalSkeleton() {
  const styles = useStyles()
  return (
    <View style={styles.root} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.authorRow}>
        <View style={styles.skeletonAvatar} />
        <View style={styles.authorCopy}>
          <View style={[styles.skeletonBar, styles.skeletonName]} />
          <View style={[styles.skeletonBar, styles.skeletonHandle]} />
        </View>
      </View>
      <View style={styles.skeletonBody}>
        <View style={[styles.skeletonBar, styles.skeletonLineFull]} />
        <View style={[styles.skeletonBar, styles.skeletonLineFull]} />
        <View style={[styles.skeletonBar, styles.skeletonLineShort]} />
      </View>
      <View style={styles.openingDivider} />
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["3"],
  },
  pressed: {
    opacity: 0.82,
  },
  replyToLine: {
    height: 18,
    marginBottom: t.space["2"],
  },
  replyToPress: {
    marginBottom: t.space["2"],
    alignSelf: "flex-start",
  },
  repostAttribution: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingBottom: 9,
  },
  repostAttributionText: {
    fontFamily: t.fontFamily.bodySemiBold,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: t.radius.md,
  },
  authorCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  authorName: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 16,
    lineHeight: 21,
    color: t.colors.text,
  },
  body: {
    marginTop: t.space["3"],
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 19,
    lineHeight: 26,
    letterSpacing: -0.1,
    color: t.colors.text,
  },
  bodyMention: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 19,
    lineHeight: 26,
    color: t.colors.accentText,
  },
  block: {
    marginTop: t.space["3"],
  },
  fixBlock: {
    gap: t.space["2"],
  },
  fixTitle: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 16.5,
    lineHeight: 21,
  },
  resolutionText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13,
    lineHeight: 17,
    color: t.colors.moss["700"],
  },
  categoryPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 2.5,
    borderRadius: t.radius.pill,
  },
  categoryPillText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 10.5,
    lineHeight: 12,
  },
  embedded: {
    gap: t.space["2"],
    padding: t.space["3"],
    borderRadius: 18,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceTint,
  },
  embeddedHovered: {
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.surfaceTint,
  },
  embeddedProminent: {
    paddingHorizontal: 2,
    paddingVertical: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  embeddedBodyProminent: {
    fontSize: 14.5,
    lineHeight: 21,
  },
  embeddedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  embeddedAuthor: {
    flexShrink: 1,
  },
  timestamp: {
    marginTop: 14,
  },
  divider: {
    marginTop: t.space["3"],
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.colors.border,
  },
  statsRow: {
    flexDirection: "row",
    gap: t.space["5"],
    paddingVertical: 10,
  },
  statCount: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 14,
    color: t.colors.text,
  },
  statLabel: {
    fontSize: 13.5,
    color: t.colors.textSubtle,
  },
  actionBar: {
    marginTop: 2,
    marginHorizontal: -postActionGlyphInset(postActionLayout("focal")),
  },
  openingDivider: {
    marginTop: t.space["2"],
    marginHorizontal: -t.space["4"],
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.colors.border,
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: t.colors.surfaceTint,
  },
  skeletonBar: {
    height: 14,
    borderRadius: 7,
    backgroundColor: t.colors.surfaceTint,
  },
  skeletonName: {
    width: 120,
  },
  skeletonHandle: {
    width: 70,
  },
  skeletonBody: {
    marginTop: t.space["3"],
    gap: t.space["2"],
  },
  skeletonLineFull: {
    height: 26,
    borderRadius: 13,
    width: "100%",
  },
  skeletonLineShort: {
    height: 26,
    borderRadius: 13,
    width: "60%",
  },
}))
