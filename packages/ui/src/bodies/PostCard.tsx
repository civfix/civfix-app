import React from "react"
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type View as RNView,
  type ViewStyle,
} from "react-native"
import type { TFunction } from "i18next"
import type { PostDTO, PostRefDTO } from "@civfix/shared"
import {
  POST_SURFACE,
  ROW_A11Y_PROPS,
  WEB_ROW_FOCUS_INSET,
  space,
  categoryColor,
  focusRingProps,
  linkKeyProps,
  makeThemedStyles,
  stopPress,
  wash,
  useLayoutMode,
  useTheme,
  webCursor,
  webHover,
  webTransition,
  type Theme,
} from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { Avatar } from "../primitives/Avatar"
import { OrgAffiliationBadge } from "../primitives/OrgAffiliationBadge"
import { VerifiedBadge } from "../primitives/VerifiedBadge"
import { MediaPreview } from "../primitives/MediaPreview"
import { PostActionBar } from "../primitives/PostActionBar"
import { POST_OVERFLOW_ROW_LIFT, PostOverflowButton } from "../primitives/PostOverflowButton"
import { useNavStore } from "../nav/useNavStore"
import { usePostMediaLightbox } from "../lightbox/usePostMediaLightbox"
import { EmbeddedPost } from "./EmbeddedPost"
import { LinkedEventCard } from "./LinkedEventCard"
import { LinkedReportCard } from "./LinkedReportCard"
import { localReportThumb } from "./localReportThumbs"
import { POST_CARD_RHYTHM } from "../primitives/postCardRhythm"
import { PostMediaGrid } from "./PostMediaGrid"
import { PostOverflowMenu } from "./PostOverflowMenu"
import { usePostOverflowMenuState } from "./postCardActions"
import { useListTimeAgo } from "./useListTimeAgo"
import {
  POST_BODY_CLAMP_LINES,
  buildPostCardModel,
  buildPostCardView,
  buildPostIdentity,
  identityA11yLabel,
  repostBodyText,
  repostSubjectAuthorId,
  splitPostBodyMentions,
  type PostCardModel,
  type PostCardView,
  type PostIdentity,
} from "./postCardModel"

export type PostSurface = "flat" | "card"

export interface PostCardProps {
  post: PostDTO
  surface?: PostSurface
  onOpenPost?: (postId: string) => void
  onOpenPerson?: (personId: string) => void
  onOpenEvent?: (eventId: string) => void
  onOpenReport?: (reportId: string) => void
  style?: StyleProp<ViewStyle>
}

const RHYTHM = POST_CARD_RHYTHM
const AVATAR = RHYTHM.avatar
const GUTTER_GAP = RHYTHM.gutterGap
const MEDIA_MAX_HEIGHT = 380
const POST_MEDIA_RADIUS = 16
const BEFORE_AFTER_MEDIA_ASPECT = 1.1
const CLEARED_MEDIA_ASPECT = 2.15

const IS_WEB = Platform.OS === "web"

const AVATAR_WEB_PROPS = IS_WEB ? ({ tabIndex: -1, "aria-hidden": true } as object) : null

function PostBody({
  post,
  clamped,
  onOpenPerson,
  t,
}: {
  post: PostDTO
  clamped: boolean
  onOpenPerson: (personId: string) => void
  t: TFunction
}) {
  const styles = useStyles()
  const th = useTheme()
  const segments = splitPostBodyMentions(post.body ?? "", post.mentions)
  if (segments.length === 0) return null

  return (
    <Text
      variant="body"
      style={styles.bodyText}
      numberOfLines={clamped ? POST_BODY_CLAMP_LINES : undefined}
    >
      {segments.map((segment, index) =>
        segment.kind === "mention" ? (
          <Text
            key={`${segment.userId}-${index}`}
            variant="bodyStrong"
            color={th.colors.accent}
            accessibilityRole="link"
            accessibilityLabel={t("post_card.profile_a11y", { name: segment.handle })}
            onPress={(event) => {
              stopPress(event)
              onOpenPerson(segment.userId)
            }}
          >
            {segment.text}
          </Text>
        ) : (
          segment.text
        ),
      )}
    </Text>
  )
}

/**
 * The repost variant names the original's author, who may be a deleted account with nothing to link to,
 * so only it disables the name; the own-post variant keeps the hover dim and transitions.
 */
type PostMetaVariant = "own" | "repost"

function PostMetaRow({
  variant,
  identity,
  timeLabel,
  t,
  onOpenIdentity,
  onOpenPerson,
  onOpenPost,
  onOpenMenu,
  menuRef,
  menuOpen,
}: {
  variant: PostMetaVariant
  identity: PostIdentity
  timeLabel: string
  t: TFunction
  onOpenIdentity: () => void
  onOpenPerson: () => void
  onOpenPost: () => void
  onOpenMenu: () => void
  menuRef: React.Ref<RNView>
  menuOpen: boolean
}) {
  const styles = useStyles()
  const own = variant === "own"
  const linkable = identity.organization != null || identity.personId != null
  const transition = own ? webTransition : null
  return (
    <View style={[styles.metaRow, POST_OVERFLOW_ROW_LIFT]}>
      <Pressable
        onPress={(event) => {
          stopPress(event)
          onOpenIdentity()
        }}
        {...(own ? null : { disabled: !linkable })}
        accessibilityRole="link"
        accessibilityLabel={identityA11yLabel(identity, t)}
        hitSlop={4}
        {...focusRingProps}
        {...linkKeyProps(onOpenIdentity)}
        style={(state) => [
          styles.identity,
          transition,
          webCursor(!own && !linkable),
          own && webHover(state) ? styles.identityHovered : null,
          state.pressed ? styles.pressed : null,
        ]}
      >
        <Text variant="bodyStrong" numberOfLines={1} style={styles.authorName}>
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
      </Pressable>

      {identity.viaLabel ? (
        <Pressable
          onPress={(event) => {
            stopPress(event)
            onOpenPerson()
          }}
          accessibilityRole="link"
          accessibilityLabel={t("post_card.profile_a11y", { name: identity.personName })}
          hitSlop={4}
          {...focusRingProps}
          {...linkKeyProps(onOpenPerson)}
          style={(state) => [
            styles.identity,
            transition,
            webCursor(false),
            state.pressed ? styles.pressed : null,
          ]}
        >
          <Text numberOfLines={1} style={styles.handle}>
            {identity.viaLabel}
          </Text>
        </Pressable>
      ) : null}

      <Text style={styles.metaText}>{"·"}</Text>

      <Pressable
        onPress={(event) => {
          stopPress(event)
          onOpenPost()
        }}
        accessibilityRole="link"
        accessibilityLabel={t("post_card.permalink_a11y", { time: timeLabel })}
        hitSlop={6}
        {...focusRingProps}
        {...linkKeyProps(onOpenPost)}
        style={(state) => [transition, webCursor(false), state.pressed ? styles.pressed : null]}
      >
        <Text style={styles.metaText}>{timeLabel}</Text>
      </Pressable>

      <View style={styles.metaSpacer} />

      <PostOverflowButton label={t("post_card.more_a11y")} onPress={onOpenMenu} buttonRef={menuRef} expanded={menuOpen} />
    </View>
  )
}

function LabeledMedia({
  media,
  label,
  alt,
  tone,
  wide = false,
  onPress,
}: {
  media: PostDTO["media"][number]
  label: string
  alt: string
  tone: "before" | "after"
  wide?: boolean
  onPress: () => void
}) {
  const styles = useStyles()
  return (
    <Pressable
      onPress={(event) => {
        stopPress(event)
        onPress()
      }}
      accessibilityRole="imagebutton"
      accessibilityLabel={alt}
      {...focusRingProps}
      style={(state) => [styles.fixMediaCell, webCursor(false), state.pressed ? styles.pressed : null]}
    >
      <MediaPreview
        uri={media.url}
        kind={media.kind}
        posterUri={media.thumbUrl}
        thumbUri={wide ? null : media.thumbUrl ?? null}
        aspectRatio={wide ? CLEARED_MEDIA_ASPECT : BEFORE_AFTER_MEDIA_ASPECT}
        alt={alt}
      />
      <View style={[styles.mediaLabel, tone === "after" ? styles.mediaLabelAfter : styles.mediaLabelBefore]}>
        <Text style={styles.mediaLabelText}>{label}</Text>
      </View>
    </Pressable>
  )
}

function FixShowcase({
  post,
  model,
  t,
  onOpenMedia,
}: {
  post: PostDTO
  model: PostCardModel
  t: TFunction
  onOpenMedia: (index: number) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  if (!post.report) return null
  const color = categoryColor(post.report.category, th.scheme)
  const media = post.media ?? []

  return (
    <View style={styles.fixShowcase}>
      <View style={styles.fixHeaderRow}>
        <View style={styles.fixCheck}>
          <Icon icon={iconMap.Check} size={14} color={th.colors.moss["700"]} strokeWidth={2.6} />
        </View>
        <Text style={styles.fixTitle}>{t("post_card.fix_confirmed")}</Text>
        {model.categoryLabel ? (
          <View style={[styles.categoryPill, { backgroundColor: wash(color, 0.82, th) }]}>
            <Text style={[styles.categoryPillText, { color }]}>{model.categoryLabel}</Text>
          </View>
        ) : null}
      </View>

      <Text variant="bodyStrong" numberOfLines={2} style={styles.reportTitle}>
        {post.report.title}
      </Text>
      {model.resolutionLabel ? (
        <Text style={styles.resolutionText}>{model.resolutionLabel}</Text>
      ) : null}

      {model.fixLayout === "before-after" && media[0] && media[1] ? (
        <View style={styles.beforeAfterRow}>
          <LabeledMedia
            media={media[0]}
            label={t("post_card.media_before")}
            alt={t("post_card.media_before_a11y")}
            tone="before"
            onPress={() => onOpenMedia(0)}
          />
          <LabeledMedia
            media={media[1]}
            label={t("post_card.media_after")}
            alt={t("post_card.media_after_a11y")}
            tone="after"
            onPress={() => onOpenMedia(1)}
          />
        </View>
      ) : model.fixLayout === "cleared" && media[0] ? (
        <LabeledMedia
          media={media[0]}
          label={t("post_card.media_cleared")}
          alt={t("post_card.media_cleared_a11y")}
          tone="after"
          wide
          onPress={() => onOpenMedia(0)}
        />
      ) : null}
    </View>
  )
}

function PostCardAttachments({
  post,
  model,
  view,
  t,
  timeAgo,
  onOpenMedia,
  onOpenPost,
  onOpenEvent,
  onOpenReport,
}: {
  post: PostDTO
  model: PostCardModel
  view: PostCardView
  t: TFunction
  timeAgo: (iso: string) => string
  onOpenMedia: (index: number) => void
  onOpenPost: (postId: string) => void
  onOpenEvent: (eventId: string) => void
  onOpenReport: (reportId: string) => void
}) {
  const styles = useStyles()
  const { isRepost, embedded, media, displayEvent, displayReport } = view
  return (
    <>
      {!model.showFixShowcase && media.length > 0 ? (
        <View style={styles.attachment}>
          <PostMediaGrid
            media={media}
            t={t}
            radius={POST_MEDIA_RADIUS}
            maxHeight={MEDIA_MAX_HEIGHT}
            onPressItem={onOpenMedia}
          />
        </View>
      ) : null}

      {displayEvent ? (
        <View style={styles.attachment}>
          <LinkedEventCard
            event={displayEvent}
            layout="list"
            timeZone={displayEvent.timezone ?? undefined}
            onPress={() => onOpenEvent(displayEvent.id)}
          />
        </View>
      ) : null}

      {displayReport && !model.showFixShowcase ? (
        <View style={styles.attachment}>
          <LinkedReportCard
            report={{ ...displayReport, thumbUrl: displayReport.thumbUrl ?? localReportThumb(displayReport.id) }}
            layout="list"
            headline="title"
            onPress={() => onOpenReport(displayReport.id)}
          />
        </View>
      ) : null}

      {!isRepost && model.showFixShowcase ? (
        <View style={styles.attachment}>
          <FixShowcase post={post} model={model} t={t} onOpenMedia={onOpenMedia} />
        </View>
      ) : null}

      {!isRepost && embedded ? (
        <View style={styles.attachment}>
          <EmbeddedPost post={embedded} t={t} timeAgo={timeAgo} onPress={() => onOpenPost(embedded.id)} />
        </View>
      ) : null}
    </>
  )
}

function RepostBody({
  embedded,
  clamped,
  t,
}: {
  embedded: PostRefDTO
  clamped: boolean
  t: TFunction
}) {
  const styles = useStyles()
  const th = useTheme()
  if (embedded.deleted) {
    return (
      <Text variant="body" color={th.colors.textMuted} style={styles.bodyText}>
        {t("post_card.unavailable")}
      </Text>
    )
  }
  const text = repostBodyText(embedded)
  if (!text) return null
  return (
    <Text variant="body" numberOfLines={clamped ? POST_BODY_CLAMP_LINES : undefined} style={styles.bodyText}>
      {text}
    </Text>
  )
}

export const PostCard = React.memo(function PostCard({
  post,
  surface = POST_SURFACE,
  onOpenPost,
  onOpenPerson,
  onOpenEvent,
  onOpenReport,
  style,
}: PostCardProps) {
  const styles = useStyles()
  const th = useTheme()
  const push = useNavStore((state) => state.push)
  const { t } = useT("home-feed")
  const layout = useLayoutMode()
  const [expanded, setExpanded] = React.useState(false)
  const { menuOpen, menuAnchor, menuTrigger, openMenu, closeMenu, menuSubject } = usePostOverflowMenuState(post)
  const timeAgo = useListTimeAgo()
  const model = React.useMemo(() => buildPostCardModel(post, t, { timeAgo }), [post, t, timeAgo])
  const view = React.useMemo(() => buildPostCardView(post, model), [post, model])
  const { isRepost, embedded, rowPostId, actionTargetId, openableOriginalId, media } = view

  const openPost = React.useCallback(
    (postId: string) => (onOpenPost ? onOpenPost(postId) : push({ kind: "post-thread", id: postId })),
    [onOpenPost, push],
  )
  const openPerson = React.useCallback(
    (personId: string) => (onOpenPerson ? onOpenPerson(personId) : push({ kind: "person", id: personId })),
    [onOpenPerson, push],
  )
  const openEvent = React.useCallback(
    (eventId: string) => (onOpenEvent ? onOpenEvent(eventId) : push({ kind: "cleanup", id: eventId })),
    [onOpenEvent, push],
  )
  const openReport = React.useCallback(
    (reportId: string) => (onOpenReport ? onOpenReport(reportId) : push({ kind: "pin", id: reportId })),
    [onOpenReport, push],
  )

  const openOriginal = React.useMemo(
    () => (openableOriginalId ? () => openPost(openableOriginalId) : undefined),
    [openableOriginalId, openPost],
  )
  const embeddedIdentity = React.useMemo(
    () =>
      embedded
        ? buildPostIdentity(embedded.author, embedded.organization, t, t("post_card.deleted_account"))
        : null,
    [embedded, t],
  )
  const rowIdentity = isRepost && embeddedIdentity ? embeddedIdentity : model.identity
  const openIdentity = React.useCallback(
    (identity: PostIdentity) => {
      if (identity.organization) {
        push({ kind: "org", slug: identity.organization.slug })
        return
      }
      if (identity.personId) openPerson(identity.personId)
    },
    [push, openPerson],
  )
  const openAuthor = () => openIdentity(rowIdentity)
  const openRowPerson = () => {
    if (rowIdentity.personId) openPerson(rowIdentity.personId)
  }

  const onComment = React.useCallback(() => openPost(actionTargetId), [openPost, actionTargetId])
  const onQuote = React.useCallback(
    () => push({ kind: "composer", composerMode: "quote", targetPostId: actionTargetId }),
    [push, actionTargetId],
  )

  const openMedia = usePostMediaLightbox(media)

  const clamp = model.bodyExpandable && !expanded
  const isFlat = surface === "flat"

  const [rowHovered, setRowHovered] = React.useState(false)
  const rowHoverProps = IS_WEB
    ? ({
        onPointerEnter: (event: { pointerType?: string }) => {
          if (event?.pointerType !== "touch") setRowHovered(true)
        },
        onPointerLeave: () => setRowHovered(false),
        onPointerCancel: () => setRowHovered(false),
      } as object)
    : null

  const pressFill = IS_WEB && layout === "expanded" ? styles.rowFlatPressed : null

  return (
    <>
      <Pressable
        onPress={() => openPost(rowPostId)}
        {...ROW_A11Y_PROPS}
        {...rowHoverProps}
        style={(state) => [
          isFlat ? styles.rowFlat : styles.rowCard,
          isFlat ? WEB_ROW_FOCUS_INSET : null,
          webTransition,
          webCursor(false),
          rowHovered ? (isFlat ? styles.rowFlatHovered : styles.rowCardHovered) : null,
          state.pressed && isFlat ? pressFill : null,
          style,
        ]}
      >
        {model.repostAttribution ? (
          <View style={styles.repostAttribution}>
            <Icon icon={iconMap.Repeat2} size={13} color={th.colors.textMuted} />
            <Text style={styles.repostAttributionText} numberOfLines={1}>
              {model.repostAttribution}
            </Text>
          </View>
        ) : null}

        <View style={styles.row}>
          <Pressable
            onPress={(event) => {
              stopPress(event)
              openAuthor()
            }}
            accessibilityRole="link"
            accessibilityLabel={identityA11yLabel(rowIdentity, t)}
            {...focusRingProps}
            {...linkKeyProps(openAuthor)}
            {...AVATAR_WEB_PROPS}
            style={(state) => [styles.gutter, webCursor(false), state.pressed ? styles.pressed : null]}
          >
            <Avatar
              name={rowIdentity.avatarName}
              seed={rowIdentity.avatarSeed}
              photoUrl={rowIdentity.avatarUrl}
              gradient={rowIdentity.avatarGradient}
              size={AVATAR}
              {...(rowIdentity.organization ? { style: styles.orgAvatar } : {})}
              decorative
            />
          </Pressable>

          <View style={styles.content}>
            <PostMetaRow
              variant={isRepost ? "repost" : "own"}
              identity={rowIdentity}
              timeLabel={isRepost && embedded ? timeAgo(embedded.createdAt) : model.timeLabel}
              t={t}
              onOpenIdentity={openAuthor}
              onOpenPerson={openRowPerson}
              onOpenPost={() => openPost(rowPostId)}
              onOpenMenu={openMenu}
              menuRef={menuTrigger.ref}
              menuOpen={menuOpen}
            />

            {model.replyingToLabel && !isRepost ? (
              <Pressable
                onPress={(event) => {
                  stopPress(event)
                  if (post.replyToId) openPost(post.replyToId)
                }}
                accessibilityRole="link"
                accessibilityLabel={model.replyingToLabel}
                hitSlop={4}
                {...focusRingProps}
                {...linkKeyProps(() => {
                  if (post.replyToId) openPost(post.replyToId)
                })}
                style={(state) => [styles.replyingTo, webCursor(false), state.pressed ? styles.pressed : null]}
              >
                <Text numberOfLines={1} style={styles.replyingToText}>
                  {model.replyingToLabel}
                </Text>
              </Pressable>
            ) : null}

            {isRepost && embedded ? (
              <RepostBody embedded={embedded} clamped={clamp} t={t} />
            ) : (
              <PostBody post={post} clamped={clamp} onOpenPerson={openPerson} t={t} />
            )}

            {clamp ? (
              <Pressable
                onPress={(event) => {
                  stopPress(event)
                  setExpanded(true)
                }}
                accessibilityRole="button"
                accessibilityLabel={t("post_card.show_more")}
                hitSlop={6}
                {...focusRingProps}
                style={(state) => [styles.showMore, webCursor(false), state.pressed ? styles.pressed : null]}
              >
                <Text style={styles.showMoreText}>{t("post_card.show_more")}</Text>
              </Pressable>
            ) : null}

            <PostCardAttachments
              post={post}
              model={model}
              view={view}
              t={t}
              timeAgo={timeAgo}
              onOpenMedia={openMedia}
              onOpenPost={openPost}
              onOpenEvent={openEvent}
              onOpenReport={openReport}
            />

            <PostActionBar
              variant="timeline"
              postId={post.id}
              counts={post.counts}
              viewer={post.viewer}
              authorId={repostSubjectAuthorId(post)}
              title={post.report?.title ?? t("post_card.share_title", { name: post.author.name })}
              onComment={onComment}
              onQuote={onQuote}
            />
          </View>
        </View>
      </Pressable>

      {isFlat ? <View style={styles.separator} /> : null}

      <PostOverflowMenu
        visible={menuOpen}
        subject={menuSubject}
        anchorRect={menuAnchor}
        onClose={closeMenu}
        onOpenPerson={openPerson}
        onOpenOriginal={openOriginal}
      />
    </>
  )
})

const META_ROW: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: space["1"],
  minHeight: POST_CARD_RHYTHM.metaRowMinHeight,
}

function metaText(t: Theme): TextStyle {
  return {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    lineHeight: 19,
    color: t.colors.textMuted,
  }
}

const useStyles = makeThemedStyles((t) => ({
  rowFlat: {
    width: "100%",
    paddingHorizontal: RHYTHM.rowPaddingH,
    paddingTop: RHYTHM.rowPaddingTop,
    paddingBottom: RHYTHM.rowPaddingBottom,
    backgroundColor: t.colors.bg,
  },
  rowFlatHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  rowFlatPressed: {
    backgroundColor: wash(t.colors.borderStrong, 0.35, t),
  },
  rowCard: {
    width: "100%",
    paddingHorizontal: 14,
    paddingTop: t.space["3"],
    paddingBottom: 2,
    borderRadius: 24,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s1,
  },
  rowCardHovered: {
    borderColor: t.colors.borderStrong,
  },
  separator: Platform.OS === "web"
    ? { height: 1, backgroundColor: wash(t.colors.borderStrong, 0.45, t) }
    : { height: StyleSheet.hairlineWidth, backgroundColor: t.colors.borderStrong },
  pressed: {
    opacity: 0.62,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  gutter: {
    width: AVATAR,
    marginRight: GUTTER_GAP,
    borderRadius: AVATAR / 2,
  },
  orgAvatar: {
    borderRadius: t.radius.sm,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: RHYTHM.textGap,
  },
  metaRow: META_ROW,
  attachment: {
    marginTop: RHYTHM.attachmentExtraMargin,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["1"],
    flexShrink: 1,
    minWidth: 0,
    borderRadius: t.radius.sm,
  },
  identityHovered: {
    opacity: 0.75,
  },
  authorName: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: t.fontSize["15"],
    lineHeight: 20,
  },
  handle: {
    flexShrink: 1,
    ...metaText(t),
  },
  metaText: metaText(t),
  metaSpacer: {
    flex: 1,
    minWidth: 0,
  },
  bodyText: {
    fontSize: t.fontSize["15"],
    lineHeight: 21,
  },
  replyingTo: {
    alignSelf: "flex-start",
  },
  replyingToText: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13.5,
    lineHeight: 18,
    color: t.colors.textMuted,
  },
  showMore: {
    alignSelf: "flex-start",
    paddingVertical: t.space["1"],
  },
  showMoreText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    lineHeight: 19,
    color: t.colors.accentText,
  },
  repostAttribution: {
    flexDirection: "row",
    alignItems: "center",
    gap: RHYTHM.repostGlyphGap,
    marginLeft: RHYTHM.repostIndent,
    marginBottom: t.space["1"],
  },
  repostAttributionText: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 12.5,
    lineHeight: 16,
    color: t.colors.textMuted,
  },
  fixShowcase: {
    gap: t.space["2"],
    padding: t.space["3"],
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceTint,
  },
  fixHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    flexWrap: "wrap",
  },
  fixCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.moss["50"],
  },
  fixTitle: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: t.fontSize["13"],
    lineHeight: 17,
    letterSpacing: 0.2,
    color: t.colors.moss["700"],
  },
  categoryPill: {
    paddingHorizontal: 9,
    paddingVertical: 2.5,
    borderRadius: t.radius.pill,
  },
  categoryPillText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 10.5,
    lineHeight: 12,
  },
  reportTitle: {
    fontSize: t.fontSize["15"],
    lineHeight: 20,
  },
  resolutionText: {
    fontFamily: t.fontFamily.bodyMedium,
    fontSize: t.fontSize["13"],
    lineHeight: 17,
    color: t.colors.moss["700"],
  },
  beforeAfterRow: {
    flexDirection: "row",
    gap: t.space["2"],
  },
  fixMediaCell: {
    flex: 1,
    minWidth: 0,
    position: "relative",
  },
  mediaLabel: {
    position: "absolute",
    top: t.space["2"],
    left: t.space["2"],
    paddingHorizontal: t.space["2"],
    paddingVertical: t.space["1"],
    borderRadius: t.radius.pill,
  },
  mediaLabelBefore: {
    backgroundColor: t.colors.scrimStrong,
  },
  mediaLabelAfter: {
    backgroundColor: t.colors.brand.moss,
  },
  mediaLabelText: {
    color: t.colors.onAccent,
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.6,
  },
}))
