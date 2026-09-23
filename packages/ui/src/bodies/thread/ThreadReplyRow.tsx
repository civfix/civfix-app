import React from "react"
import { Pressable, StyleSheet, View } from "react-native"
import type { PostDTO } from "@civfix/shared"
import { focusRingProps, makeThemedStyles, stopPress, wash, webCursor, webTransition } from "../../theme"
import { Text } from "../../typography"
import { useT } from "../../i18n"
import { Avatar } from "../../primitives/Avatar"
import { OrgAffiliationBadge } from "../../primitives/OrgAffiliationBadge"
import { VerifiedBadge } from "../../primitives/VerifiedBadge"
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
import { ROW_ROLE, WEB_ROW_FOCUS_INSET, linkKeyProps } from "../PostCard"
import { PostMediaGrid } from "../PostMediaGrid"
import { POST_OVERFLOW_ROW_LIFT, PostOverflowButton } from "../../primitives/PostOverflowButton"
import { PostOverflowMenu } from "../PostOverflowMenu"
import {
  buildPostIdentity,
  identityA11yLabel,
  postMenuSubject,
  repostSubjectAuthorId,
  splitPostBodyMentions,
} from "../postCardModel"
import { POST_CARD_RHYTHM } from "../postCardRhythm"
import { usePopoverAnchor, type AnchorRect } from "../../primitives/PopoverMenu"
import { useLightbox } from "../../lightbox"
import { useRowHover } from "../rowHover"
import { useListTimeAgo } from "../useListTimeAgo"
import {
  THREAD_AVATAR_SIZE,
  THREAD_RAIL_GAP,
  THREAD_RAIL_W,
  type ThreadRailSegment,
} from "./threadModel"

const RHYTHM = POST_CARD_RHYTHM
const EMPTY_MEDIA: PostDTO["media"] = []

export interface ThreadReplyRowProps {
  post: PostDTO
  rail: ThreadRailSegment
  hairline?: boolean
  isOptimistic?: boolean
  onOpenEntry?: (entry: DetailEntry) => void
  onDeleted?: (postId: string) => void
}

export const ThreadReplyRow = React.memo(function ThreadReplyRow({
  post,
  rail,
  hairline = true,
  isOptimistic = false,
  onOpenEntry,
  onDeleted,
}: ThreadReplyRowProps) {
  const styles = useStyles()
  const { hovered, hoverProps } = useRowHover()
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
  const openThread = React.useCallback(
    () => openEntry({ kind: "post-thread", id: post.id }),
    [openEntry, post.id],
  )
  const onQuote = React.useCallback(
    () => openEntry({ kind: "composer", composerMode: "quote", targetPostId: post.id }),
    [openEntry, post.id],
  )
  const timeAgo = useListTimeAgo()
  const identity = React.useMemo(
    () => buildPostIdentity(post.author, post.organization, t, t("post_card.deleted_account")),
    [post.author, post.organization, t],
  )
  const openIdentity = React.useCallback(() => {
    if (identity.organization) {
      openEntry({ kind: "org", slug: identity.organization.slug })
      return
    }
    if (identity.personId) openPerson(identity.personId)
  }, [identity, openEntry, openPerson])
  const openActingPerson = React.useCallback(() => {
    if (identity.personId) openPerson(identity.personId)
  }, [identity, openPerson])
  const metaTail = `${identity.handleLabel ? `${identity.handleLabel} · ` : ""}${isOptimistic ? t("thread.sending") : timeAgo(post.createdAt)}`
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [menuAnchor, setMenuAnchor] = React.useState<AnchorRect | null>(null)
  const menuTrigger = usePopoverAnchor(setMenuAnchor)
  const openMenu = React.useCallback(() => {
    menuTrigger.measure()
    setMenuOpen(true)
  }, [menuTrigger])
  const closeMenu = React.useCallback(() => setMenuOpen(false), [])
  const menuSubject = React.useMemo(() => postMenuSubject(post), [post])
  const onMenuDeleted = React.useCallback(() => onDeleted?.(post.id), [onDeleted, post.id])
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

  return (
    <>
      <Pressable
        onPress={openThread}
        disabled={isOptimistic}
        accessibilityRole={ROW_ROLE}
        accessibilityLabel={t("post_card.open_thread_a11y", { name: identity.name })}
        {...focusRingProps}
        {...hoverProps}
        {...(isOptimistic ? null : linkKeyProps(openThread))}
        style={(state) => [
          styles.outer,
          hairline ? styles.outerRule : null,
          isOptimistic ? styles.outerOptimistic : null,
          WEB_ROW_FOCUS_INSET,
          webTransition,
          webCursor(isOptimistic),
          !isOptimistic && hovered ? styles.outerHovered : null,
          !isOptimistic && state.pressed ? styles.outerPressed : null,
        ]}
      >
        <View style={styles.row}>
          <View style={styles.railColumn}>
            {rail.above ? <View style={styles.railAbove} /> : null}
            {rail.below ? <View style={styles.railBelow} /> : null}
            <Pressable
              onPress={(event) => {
                stopPress(event)
                openIdentity()
              }}
              accessibilityRole="button"
              accessibilityLabel={identityA11yLabel(identity, t)}
              hitSlop={5}
              {...focusRingProps}
              style={({ pressed }) => (pressed ? styles.pressed : null)}
            >
              <Avatar
                name={identity.avatarName}
                seed={identity.avatarSeed}
                photoUrl={identity.avatarUrl}
                gradient={identity.avatarGradient}
                size={THREAD_AVATAR_SIZE}
                {...(identity.organization ? { style: styles.orgAvatar } : {})}
                decorative
              />
            </Pressable>
          </View>

          <View style={styles.content}>
            <View style={[styles.metaRow, POST_OVERFLOW_ROW_LIFT]}>
              <Text numberOfLines={1} style={styles.metaName}>
                {identity.name}
              </Text>
              {identity.official ? <VerifiedBadge size="sm" /> : null}
              {identity.affiliation ? (
                <OrgAffiliationBadge organization={identity.affiliation} size="sm" interactive={false} />
              ) : null}
              {identity.viaLabel ? (
                <Pressable
                  onPress={(event) => {
                    stopPress(event)
                    openActingPerson()
                  }}
                  disabled={!identity.personId}
                  accessibilityRole="button"
                  accessibilityLabel={t("post_card.profile_a11y", { name: identity.personName })}
                  hitSlop={4}
                  {...focusRingProps}
                  style={({ pressed }) => [styles.viaTail, pressed ? styles.pressed : null]}
                >
                  <Text numberOfLines={1} style={styles.metaTail}>
                    {`${identity.viaLabel} · `}
                  </Text>
                </Pressable>
              ) : null}
              <Text numberOfLines={1} style={styles.metaTail}>
                {metaTail}
              </Text>

              <View style={styles.metaSpacer} />

              {isOptimistic ? null : (
                <PostOverflowButton
                  label={t("post_card.more_a11y")}
                  onPress={openMenu}
                  buttonRef={menuTrigger.ref}
                />
              )}
            </View>

            {segments.length > 0 ? (
              <Text style={styles.body}>
                {segments.map((segment, index) =>
                  segment.kind === "mention" ? (
                    <Text
                      key={`${segment.userId}-${index}`}
                      style={styles.bodyMention}
                      onPress={(event) => {
                        stopPress(event)
                        openPerson(segment.userId)
                      }}
                    >
                      {segment.text}
                    </Text>
                  ) : (
                    segment.text
                  ),
                )}
              </Text>
            ) : null}

            {media.length > 0 ? (
              <View style={styles.block}>
                <PostMediaGrid media={media} t={t} radius={14} maxHeight={240} onPressItem={openMedia} />
              </View>
            ) : null}

            {post.event ? (
              <View style={styles.block}>
                <LinkedEventCard
                  event={post.event}
                  layout="list"
                  timeZone={post.event.timezone ?? undefined}
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

            <View style={styles.actionsWrap} pointerEvents={isOptimistic ? "none" : "auto"}>
              <PostActionBar
                variant="reply"
                postId={post.id}
                counts={post.counts}
                viewer={post.viewer}
                authorId={repostSubjectAuthorId(post)}
                title={post.report?.title ?? t("post_card.share_title", { name: post.author.name })}
                onComment={openThread}
                onQuote={onQuote}
              />
            </View>
          </View>
        </View>
      </Pressable>

      <PostOverflowMenu
        visible={menuOpen}
        subject={menuSubject}
        anchorRect={menuAnchor}
        onClose={closeMenu}
        onOpenPerson={openPerson}
        onDeleted={onMenuDeleted}
      />
    </>
  )
})

const useStyles = makeThemedStyles((t) => ({
  orgAvatar: {
    borderRadius: t.radius.sm,
  },
  viaTail: {
    flexShrink: 1,
    minWidth: 0,
  },
  outer: {
    backgroundColor: t.colors.bg,
  },
  outerRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  outerHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  outerPressed: {
    backgroundColor: wash(t.colors.borderStrong, 0.35, t),
  },
  outerOptimistic: {
    opacity: 0.55,
  },
  row: {
    flexDirection: "row",
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["3"],
    paddingBottom: t.space["2"],
  },
  railColumn: {
    width: THREAD_AVATAR_SIZE,
    alignItems: "center",
  },
  railAbove: {
    position: "absolute",
    left: (THREAD_AVATAR_SIZE - THREAD_RAIL_W) / 2,
    top: -t.space["3"],
    height: t.space["3"] + THREAD_AVATAR_SIZE / 2,
    width: THREAD_RAIL_W,
    backgroundColor: t.colors.borderStrong,
  },
  railBelow: {
    position: "absolute",
    left: (THREAD_AVATAR_SIZE - THREAD_RAIL_W) / 2,
    top: THREAD_AVATAR_SIZE / 2,
    bottom: -t.space["2"],
    width: THREAD_RAIL_W,
    backgroundColor: t.colors.borderStrong,
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
    minHeight: RHYTHM.metaRowMinHeight,
  },
  metaSpacer: {
    flex: 1,
    minWidth: 0,
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
  pressed: {
    opacity: 0.6,
  },
}))
