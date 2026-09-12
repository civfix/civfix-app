import React from "react"
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type View as RNView,
  type ViewStyle,
} from "react-native"
import type { TFunction } from "i18next"
import type { PostDTO, PostRefDTO } from "@civfix/shared"
import { Repeat2 } from "lucide-react-native/icons"
import {
  POST_SURFACE,
  space, radius,
  categoryColor,
  focusRingProps,
  makeThemedStyles,
  stopPress,
  wash,
  useLayoutMode,
  useTheme,
  webCursor,
  webHover,
  webTransition,
} from "../theme"
import { tokens } from "@civfix/shared/tokens"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { Avatar } from "../primitives/Avatar"
import { OrgAffiliationBadge } from "../primitives/OrgAffiliationBadge"
import { MediaPreview } from "../primitives/MediaPreview"
import { PostActionBar } from "../primitives/PostActionBar"
import { useNavStore } from "../nav/useNavStore"
import { useLightbox } from "../lightbox"
import { LinkedEventCard } from "./LinkedEventCard"
import { LinkedReportCard } from "./LinkedReportCard"
import { localReportThumb } from "./localReportThumbs"
import { POST_CARD_RHYTHM } from "./postCardRhythm"
import { PostMediaGrid } from "./PostMediaGrid"
import { PostOverflowMenu } from "./PostOverflowMenu"
import { usePopoverAnchor, type AnchorRect } from "../primitives/PopoverMenu"
import { useListTimeAgo } from "./useListTimeAgo"
import {
  POST_BODY_CLAMP_LINES,
  buildPostCardModel,
  buildPostIdentity,
  identityA11yLabel,
  repostBodyText,
  repostSubjectAuthorId,
  splitPostBodyMentions,
  type PostCardModel,
  type PostCardModelOptions,
  type PostIdentity,
} from "./postCardModel"
export { buildPostCardModel, splitPostBodyMentions } from "./postCardModel"

export type PostSurface = "flat" | "card"

export interface PostCardProps extends PostCardModelOptions {
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
const EMPTY_MEDIA: PostDTO["media"] = []

const IS_WEB = Platform.OS === "web"

const ROW_ROLE = IS_WEB ? "link" : "button"

const AVATAR_WEB_PROPS = IS_WEB ? ({ tabIndex: -1, "aria-hidden": true } as object) : null

function activateOnLinkKey(event: unknown, activate: () => void): void {
  const e = event as {
    key?: string
    target?: unknown
    currentTarget?: unknown
    preventDefault?: () => void
  }
  if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return
  if (e.target !== e.currentTarget) return
  e.preventDefault?.()
  activate()
}

export function linkKeyProps(activate: () => void): object | null {
  if (!IS_WEB) return null
  return { onKeyDown: (event: unknown) => activateOnLinkKey(event, activate) }
}

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

export function OrganizerBadge({ t }: { t: TFunction }) {
  const styles = useStyles()
  return (
    <View style={styles.organizerBadge}>
      <Text style={styles.organizerBadgeText}>{t("post_card.organizer")}</Text>
    </View>
  )
}

function MetaRow({
  model,
  t,
  onOpenIdentity,
  onOpenPerson,
  onOpenPost,
  onOpenMenu,
  menuRef,
}: {
  model: PostCardModel
  t: TFunction
  onOpenIdentity: () => void
  onOpenPerson: () => void
  onOpenPost: () => void
  onOpenMenu: () => void
  menuRef: React.Ref<RNView>
}) {
  const styles = useStyles()
  const th = useTheme()
  const moreButtonStyle = React.useMemo(
    () => [styles.moreButton, WEB_MORE_TARGET, webCursor(false)],
    [styles],
  )
  const identity = model.identity
  return (
    <View style={[styles.metaRow, WEB_META_ROW_LIFT]}>
      <Pressable
        onPress={(event) => {
          stopPress(event)
          onOpenIdentity()
        }}
        accessibilityRole="link"
        accessibilityLabel={identityA11yLabel(identity, t)}
        hitSlop={4}
        {...focusRingProps}
        {...linkKeyProps(onOpenIdentity)}
        style={(state) => [
          styles.identity,
          webTransition,
          webCursor(false),
          webHover(state) ? styles.identityHovered : null,
          state.pressed ? styles.pressed : null,
        ]}
      >
        <Text variant="bodyStrong" numberOfLines={1} style={styles.authorName}>
          {identity.name}
        </Text>
        {identity.affiliation ? (
          <OrgAffiliationBadge organization={identity.affiliation} size="sm" interactive={false} />
        ) : null}
        {model.handleLabel ? (
          <Text numberOfLines={1} style={styles.handle}>
            {model.handleLabel}
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
            webTransition,
            webCursor(false),
            state.pressed ? styles.pressed : null,
          ]}
        >
          <Text numberOfLines={1} style={styles.handle}>
            {identity.viaLabel}
          </Text>
        </Pressable>
      ) : null}

      <Text style={styles.metaDot}>{"·"}</Text>

      <Pressable
        onPress={(event) => {
          stopPress(event)
          onOpenPost()
        }}
        accessibilityRole="link"
        accessibilityLabel={t("post_card.permalink_a11y", { time: model.timeLabel })}
        hitSlop={6}
        {...focusRingProps}
        {...linkKeyProps(onOpenPost)}
        style={(state) => [
          webTransition,
          webCursor(false),
          state.pressed ? styles.pressed : null,
        ]}
      >
        <Text style={styles.timestamp}>{model.timeLabel}</Text>
      </Pressable>

      {model.showOrganizerBadge ? <OrganizerBadge t={t} /> : null}

      <View style={styles.metaSpacer} />

      <Pressable
        ref={menuRef}
        onPress={(event) => {
          stopPress(event)
          onOpenMenu()
        }}
        accessibilityRole="button"
        accessibilityLabel={t("post_card.more_a11y")}
        hitSlop={8}
        {...focusRingProps}
        style={moreButtonStyle}
      >
        {(state) => (
          <>
            <View
              style={[
                styles.moreHalo,
                WEB_MORE_HALO_TOP,
                webTransition,
                state.pressed ? styles.moreHaloPressed : webHover(state) ? styles.moreHaloHovered : null,
              ]}
            />
            <Icon icon={iconMap.Ellipsis} size={RHYTHM.overflowGlyph} color={th.colors.textMuted} />
          </>
        )}
      </Pressable>
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
        aspectRatio={wide ? 2.15 : 1.1}
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

function EmbeddedPost({
  post,
  t,
  timeAgo,
  onPress,
}: {
  post: PostRefDTO
  t: TFunction
  timeAgo: (iso: string) => string
  onPress: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const identity = React.useMemo(
    () => buildPostIdentity(post.author, post.organization, t, t("post_card.deleted_account")),
    [post.author, post.organization, t],
  )
  return (
    <Pressable
      onPress={(event) => {
        stopPress(event)
        onPress()
      }}
      accessibilityRole="button"
      accessibilityLabel={t("post_card.open_quote_a11y")}
      {...focusRingProps}
      style={(state) => [
        styles.embedded,
        webTransition,
        webCursor(false),
        webHover(state) ? styles.embeddedHovered : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.embeddedHeader}>
        {post.author || identity.organization ? (
          <Avatar
            name={identity.avatarName}
            seed={identity.avatarSeed}
            photoUrl={identity.avatarUrl}
            gradient={identity.avatarGradient}
            size={20}
            {...(identity.organization ? { style: styles.orgAvatar } : {})}
            decorative
          />
        ) : null}
        <Text variant="bodyStrong" numberOfLines={1} style={styles.embeddedAuthor}>
          {identity.name}
        </Text>
        {identity.affiliation ? (
          <OrgAffiliationBadge organization={identity.affiliation} size="sm" interactive={false} />
        ) : null}
        {identity.handleLabel ? (
          <Text numberOfLines={1} style={styles.embeddedHandle}>
            {identity.handleLabel}
          </Text>
        ) : null}
        {identity.viaLabel ? (
          <Text numberOfLines={1} style={styles.embeddedHandle}>
            {identity.viaLabel}
          </Text>
        ) : null}
        <Text style={styles.embeddedTime}>{`· ${timeAgo(post.createdAt)}`}</Text>
      </View>
      <Text
        variant="body"
        numberOfLines={4}
        color={post.deleted ? th.colors.textMuted : th.colors.text}
        style={styles.embeddedBody}
      >
        {post.deleted ? t("post_card.unavailable") : post.excerpt}
      </Text>
      {post.media.length > 0 && !post.deleted ? (
        <PostMediaGrid media={post.media} t={t} radius={12} maxHeight={220} />
      ) : null}
    </Pressable>
  )
}

export const PostCard = React.memo(function PostCard({
  post,
  surface = POST_SURFACE,
  neighborhood,
  reportedBy,
  resolutionLabel,
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
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [menuAnchor, setMenuAnchor] = React.useState<AnchorRect | null>(null)
  const menuTrigger = usePopoverAnchor(setMenuAnchor)
  const openMenu = React.useCallback(() => {
    menuTrigger.measure()
    setMenuOpen(true)
  }, [menuTrigger])
  const timeAgo = useListTimeAgo()
  const model = React.useMemo(
    () => buildPostCardModel(post, t, { neighborhood, reportedBy, resolutionLabel, timeAgo }),
    [post, t, neighborhood, reportedBy, resolutionLabel, timeAgo],
  )

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

  const isRepost = model.variant === "repost" && model.embeddedPost != null
  const embedded = model.embeddedPost
  const rowPostId = isRepost && embedded ? embedded.id : post.id
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

  const onComment = React.useCallback(() => openPost(post.id), [openPost, post.id])
  const onQuote = React.useCallback(
    () => push({ kind: "composer", composerMode: "quote", targetPostId: post.id }),
    [push, post.id],
  )

  const media = isRepost && embedded ? embedded.media ?? EMPTY_MEDIA : post.media ?? EMPTY_MEDIA
  const displayEvent = isRepost ? (embedded?.event ?? null) : (post.event ?? null)
  const displayReport = isRepost ? (embedded?.report ?? null) : (post.report ?? null)
  const lightbox = useLightbox()
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

  const rowKeyProps = linkKeyProps(() => openPost(rowPostId))

  const pressFill = IS_WEB && layout === "expanded" ? styles.rowFlatPressed : null

  return (
    <>
      <Pressable
        onPress={() => openPost(rowPostId)}
        accessibilityRole={ROW_ROLE}
        accessibilityLabel={t("post_card.open_thread_a11y", { name: rowIdentity.name })}
        {...focusRingProps}
        {...rowHoverProps}
        {...rowKeyProps}
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
            <Icon icon={Repeat2} size={13} color={th.colors.textMuted} />
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
            {isRepost && embedded && embeddedIdentity ? (
              <EmbeddedPostMeta
                identity={embeddedIdentity}
                createdAt={embedded.createdAt}
                t={t}
                timeAgo={timeAgo}
                onOpenIdentity={() => openIdentity(embeddedIdentity)}
                onOpenPerson={() => {
                  if (embeddedIdentity.personId) openPerson(embeddedIdentity.personId)
                }}
                onOpenPost={() => openPost(embedded.id)}
              />
            ) : (
              <MetaRow
                model={model}
                t={t}
                onOpenIdentity={() => openIdentity(model.identity)}
                onOpenPerson={() => openPerson(post.author.id)}
                onOpenPost={() => openPost(post.id)}
                onOpenMenu={openMenu}
                menuRef={menuTrigger.ref}
              />
            )}

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
              embedded.deleted ? (
                <Text variant="body" color={th.colors.textMuted} style={styles.bodyText}>
                  {t("post_card.unavailable")}
                </Text>
              ) : repostBodyText(embedded) ? (
                <Text
                  variant="body"
                  numberOfLines={clamp ? POST_BODY_CLAMP_LINES : undefined}
                  style={styles.bodyText}
                >
                  {repostBodyText(embedded)}
                </Text>
              ) : null
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

            {!model.showFixShowcase && media.length > 0 ? (
              <View style={styles.attachment}>
                <PostMediaGrid
                  media={media}
                  t={t}
                  radius={16}
                  maxHeight={MEDIA_MAX_HEIGHT}
                  onPressItem={openMedia}
                />
              </View>
            ) : null}

            {displayEvent ? (
              <View style={styles.attachment}>
                <LinkedEventCard event={displayEvent} layout="list" onPress={() => openEvent(displayEvent.id)} />
              </View>
            ) : null}

            {displayReport && !model.showFixShowcase ? (
              <View style={styles.attachment}>
                <LinkedReportCard
                  report={{ ...displayReport, thumbUrl: displayReport.thumbUrl ?? localReportThumb(displayReport.id) }}
                  layout="list"
                  headline="title"
                  onPress={() => openReport(displayReport.id)}
                />
              </View>
            ) : null}

            {!isRepost && model.showFixShowcase ? (
              <View style={styles.attachment}>
                <FixShowcase post={post} model={model} t={t} onOpenMedia={openMedia} />
              </View>
            ) : null}

            {!isRepost && embedded ? (
              <View style={styles.attachment}>
                <EmbeddedPost post={embedded} t={t} timeAgo={timeAgo} onPress={() => openPost(embedded.id)} />
              </View>
            ) : null}

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
        post={post}
        anchorRect={menuAnchor}
        onClose={() => setMenuOpen(false)}
        onOpenPerson={openPerson}
      />
    </>
  )
})

function EmbeddedPostMeta({
  identity,
  createdAt,
  t,
  timeAgo,
  onOpenIdentity,
  onOpenPerson,
  onOpenPost,
}: {
  identity: PostIdentity
  createdAt: string
  t: TFunction
  timeAgo: (iso: string) => string
  onOpenIdentity: () => void
  onOpenPerson: () => void
  onOpenPost: () => void
}) {
  const styles = useStyles()
  const linkable = identity.organization != null || identity.personId != null
  return (
    <View style={styles.metaRow}>
      <Pressable
        onPress={(event) => {
          stopPress(event)
          onOpenIdentity()
        }}
        disabled={!linkable}
        accessibilityRole="link"
        accessibilityLabel={identityA11yLabel(identity, t)}
        hitSlop={4}
        {...focusRingProps}
        {...linkKeyProps(onOpenIdentity)}
        style={(state) => [styles.identity, webCursor(!linkable), state.pressed ? styles.pressed : null]}
      >
        <Text variant="bodyStrong" numberOfLines={1} style={styles.authorName}>
          {identity.name}
        </Text>
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
          style={(state) => [styles.identity, webCursor(false), state.pressed ? styles.pressed : null]}
        >
          <Text numberOfLines={1} style={styles.handle}>
            {identity.viaLabel}
          </Text>
        </Pressable>
      ) : null}

      <Text style={styles.metaDot}>{"·"}</Text>

      <Pressable
        onPress={(event) => {
          stopPress(event)
          onOpenPost()
        }}
        accessibilityRole="link"
        accessibilityLabel={t("post_card.permalink_a11y", { time: timeAgo(createdAt) })}
        hitSlop={6}
        {...focusRingProps}
        {...linkKeyProps(onOpenPost)}
        style={(state) => [webCursor(false), state.pressed ? styles.pressed : null]}
      >
        <Text style={styles.timestamp}>{timeAgo(createdAt)}</Text>
      </Pressable>

      <View style={styles.metaSpacer} />
    </View>
  )
}

const RING_FOOTPRINT = Number.parseFloat(/^0 0 0 (\d+(?:\.\d+)?)px/.exec(tokens.shadow.ring)?.[1] ?? "3")
const WEB_ROW_FOCUS_INSET: ViewStyle = IS_WEB
  ? ({ outlineOffset: -RING_FOOTPRINT } as unknown as ViewStyle)
  : {}

const WEB_MORE_TARGET_GROWTH = (RHYTHM.overflowTarget - RHYTHM.overflowBoxHeight) / 2
const WEB_MORE_TARGET: ViewStyle = IS_WEB
  ? {
      height: RHYTHM.overflowTarget,
      marginTop: -WEB_MORE_TARGET_GROWTH,
      marginBottom: -WEB_MORE_TARGET_GROWTH,
      borderRadius: radius.pill,
    }
  : {}
const WEB_META_ROW_LIFT: ViewStyle = IS_WEB ? { zIndex: 1 } : {}
const WEB_MORE_HALO_TOP: ViewStyle = IS_WEB
  ? { top: (RHYTHM.overflowTarget - RHYTHM.overflowHalo) / 2 }
  : {}

const META_ROW: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: space["1"],
  minHeight: POST_CARD_RHYTHM.metaRowMinHeight,
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
    paddingTop: 12,
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
    fontSize: 15,
    lineHeight: 20,
  },
  handle: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 14,
    lineHeight: 19,
    color: t.colors.textMuted,
  },
  metaDot: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 14,
    lineHeight: 19,
    color: t.colors.textMuted,
  },
  timestamp: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 14,
    lineHeight: 19,
    color: t.colors.textMuted,
  },
  metaSpacer: {
    flex: 1,
    minWidth: 0,
  },
  moreButton: {
    width: RHYTHM.overflowTarget,
    height: RHYTHM.overflowBoxHeight,
    marginRight: -RHYTHM.overflowOverhang,
    alignItems: "center",
    justifyContent: "center",
  },
  moreHalo: {
    position: "absolute",
    left: RHYTHM.overflowHaloLeft,
    top: RHYTHM.overflowHaloTop,
    width: RHYTHM.overflowHalo,
    height: RHYTHM.overflowHalo,
    borderRadius: RHYTHM.overflowHalo / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  moreHaloHovered: {
    backgroundColor: t.colors.sky["50"],
  },
  moreHaloPressed: {
    backgroundColor: t.colors.sky["100"],
  },
  bodyText: {
    fontSize: 15,
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
    fontSize: 14,
    lineHeight: 19,
    color: t.colors.accentText,
  },
  organizerBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.sun["50"],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.sun["100"],
  },
  organizerBadgeText: {
    color: t.colors.sun["700"],
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.45,
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
    fontSize: 13,
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
    fontSize: 15,
    lineHeight: 20,
  },
  resolutionText: {
    fontFamily: t.fontFamily.bodyMedium,
    fontSize: 13,
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
  embedded: {
    gap: t.space["1"],
    padding: t.space["3"],
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  embeddedHovered: {
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.surfaceTint,
  },
  embeddedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["1"],
  },
  embeddedAuthor: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 19,
  },
  embeddedHandle: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    color: t.colors.textMuted,
  },
  embeddedTime: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    color: t.colors.textMuted,
  },
  embeddedBody: {
    fontSize: 14,
    lineHeight: 19,
  },
}))
