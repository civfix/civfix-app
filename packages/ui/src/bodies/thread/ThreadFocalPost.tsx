import React from "react"
import { Pressable, StyleSheet, View } from "react-native"
import type { TFunction } from "i18next"
import type { PostDTO, PostRefDTO } from "@civfix/shared"
import { Repeat2 } from "lucide-react-native/icons"
import { makeThemedStyles, useTheme, categoryColor, focusRingProps, wash } from "../../theme"
import { Text, Icon } from "../../typography"
import { useLocale, useT } from "../../i18n"
import { Avatar } from "../../primitives/Avatar"
import { OrgAffiliationBadge } from "../../primitives/OrgAffiliationBadge"
import { VerifiedBadge } from "../../primitives/VerifiedBadge"
import { PostActionBar } from "../../primitives/PostActionBar"
import {
  formatPostActionCount,
  postActionGlyphInset,
  postActionLayout,
} from "../../primitives/postActionModel"
import { useNavStore } from "../../nav/useNavStore"
import type { DetailEntry } from "../../nav/types"
import { EmbeddedPost } from "../EmbeddedPost"
import { LinkedEventCard } from "../LinkedEventCard"
import { LinkedReportCard } from "../LinkedReportCard"
import { localReportThumb } from "../localReportThumbs"
import { PostMediaGrid } from "../PostMediaGrid"
import { PostOverflowButton } from "../../primitives/PostOverflowButton"
import {
  buildPostCardModel,
  identityA11yLabel,
  postMenuSubject,
  repostSubjectAuthorId,
  splitPostBodyMentions,
} from "../postCardModel"
import { PostOverflowMenu } from "../PostOverflowMenu"
import { usePopoverAnchor, type AnchorRect } from "../../primitives/PopoverMenu"
import { useLightbox } from "../../lightbox"
import { focalTimestamp } from "../relativeTime"
import { useListTimeAgo } from "../useListTimeAgo"
import { buildFocalPostStats } from "./threadModel"

const EMPTY_MEDIA: PostDTO["media"] = []

export type ThreadFocalParent = PostDTO | PostRefDTO | null

export interface ThreadFocalPostProps {
  post: PostDTO
  parent: ThreadFocalParent
  onFocusComposer: () => void
  onOpenEntry?: (entry: DetailEntry) => void
  onDeleted?: () => void
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

export function ThreadFocalPost({
  post,
  parent,
  onFocusComposer,
  onOpenEntry,
  onDeleted,
}: ThreadFocalPostProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("home-feed")
  const { locale } = useLocale()
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
  const identity = model.identity
  const openActingPerson = React.useCallback(() => {
    if (identity.personId) openPerson(identity.personId)
  }, [identity, openPerson])
  const openIdentity = React.useCallback(() => {
    if (identity.organization) {
      openEntry({ kind: "org", slug: identity.organization.slug })
      return
    }
    if (identity.personId) openPerson(identity.personId)
  }, [identity, openEntry, openPerson])
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [menuAnchor, setMenuAnchor] = React.useState<AnchorRect | null>(null)
  const menuTrigger = usePopoverAnchor(setMenuAnchor)
  const openMenu = React.useCallback(() => {
    menuTrigger.measure()
    setMenuOpen(true)
  }, [menuTrigger])
  const closeMenu = React.useCallback(() => setMenuOpen(false), [])
  const menuSubject = React.useMemo(() => postMenuSubject(post), [post])
  const embedded = model.embeddedPost
  const openOriginal = React.useMemo(
    () =>
      isRepost && embedded && !embedded.deleted
        ? () => openEntry({ kind: "post-thread", id: embedded.id })
        : undefined,
    [isRepost, embedded, openEntry],
  )
  const lightbox = useLightbox()
  const media = post.media ?? EMPTY_MEDIA
  const openMedia = React.useCallback(
    (index: number) => {
      const items = media.map((item) => ({
        url: item.url,
        kind: item.kind,
        thumbUrl: item.thumbUrl ?? null,
        width: item.width ?? null,
        height: item.height ?? null,
      }))
      if (items.length > 0) lightbox.open(items, index)
    },
    [lightbox, media],
  )
  const timestamp = focalTimestamp(post.createdAt, locale)
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

      <View style={styles.authorRow}>
        <Pressable
          onPress={openIdentity}
          accessibilityRole="button"
          accessibilityLabel={identityA11yLabel(identity, t)}
          hitSlop={5}
          {...focusRingProps}
          style={({ pressed }) => [styles.authorTarget, pressed ? styles.pressed : null]}
        >
          <Avatar
            name={identity.avatarName}
            seed={identity.avatarSeed}
            photoUrl={identity.avatarUrl}
            gradient={identity.avatarGradient}
            size={44}
            {...(identity.organization ? { style: styles.orgAvatar } : {})}
            decorative
          />
          <View style={styles.authorCopy}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={styles.authorName}>
                {identity.name}
              </Text>
              {identity.official ? <VerifiedBadge size="sm" /> : null}
              {identity.affiliation ? (
                <OrgAffiliationBadge organization={identity.affiliation} size="sm" interactive={false} />
              ) : null}
            </View>
            {identity.handleLabel ? (
              <Text variant="caption" color={th.colors.textSubtle} numberOfLines={1}>
                {identity.handleLabel}
              </Text>
            ) : null}
          </View>
        </Pressable>

        <PostOverflowButton
          label={t("post_card.more_a11y")}
          onPress={openMenu}
          buttonRef={menuTrigger.ref}
          expanded={menuOpen}
        />
      </View>

      {identity.viaLabel ? (
        <Pressable
          onPress={openActingPerson}
          disabled={!identity.personId}
          accessibilityRole="button"
          accessibilityLabel={t("post_card.profile_a11y", { name: identity.personName })}
          hitSlop={5}
          {...focusRingProps}
          style={({ pressed }) => [styles.viaRow, pressed ? styles.pressed : null]}
        >
          <Text variant="caption" color={th.colors.textSubtle} numberOfLines={1}>
            {identity.viaLabel}
          </Text>
        </Pressable>
      ) : null}

      {!isFix && !isRepost && bodySegments.length > 0 ? (
        <Text style={styles.body}>
          {bodySegments.map((segment, index) =>
            segment.kind === "mention" ? (
              <Text
                key={`${segment.userId}-${index}`}
                style={styles.bodyMention}
                accessibilityRole="link"
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

      {!isFix && !isRepost && media.length > 0 ? (
        <View style={styles.block}>
          <PostMediaGrid media={media} t={t} radius={18} maxHeight={320} onPressItem={openMedia} />
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
          <PostMediaGrid media={media} t={t} radius={18} maxHeight={320} onPressItem={openMedia} />
        </View>
      ) : null}

      {!isFix && !isRepost && post.event ? (
        <View style={styles.block}>
          <LinkedEventCard
            event={post.event}
            layout="list"
            variant="detail"
            timeZone={post.event.timezone ?? undefined}
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

      <PostOverflowMenu
        visible={menuOpen}
        subject={menuSubject}
        anchorRect={menuAnchor}
        onClose={closeMenu}
        onOpenPerson={openPerson}
        onOpenOriginal={openOriginal}
        onDeleted={onDeleted}
      />
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
  orgAvatar: {
    borderRadius: t.radius.sm,
  },
  viaRow: {
    alignSelf: "flex-start",
    marginTop: 2,
  },
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
  },
  authorTarget: {
    flex: 1,
    minWidth: 0,
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
