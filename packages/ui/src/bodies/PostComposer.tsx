import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type AccessibilityState,
  type ViewStyle,
} from "react-native"
import type { TFunction } from "i18next"
import { TextInput } from "../primitives/TextInput"
import type { OrganizationDTO, PersonDTO, PostDTO, PostRefDTO, UserMentionDTO } from "@civfix/shared"
import { tokens } from "@civfix/shared/tokens"
import {
  focusRingProps,
  headingLevel,
  makeThemedStyles,
  useLayoutMode,
  useTheme,
  webInputReset,
} from "../theme"
import { useReducedMotion } from "../theme/useReducedMotion"
import { Avatar, MentionAutocomplete } from "../primitives"
import { useToast } from "../primitives/Toast"
import type { MentionCandidate } from "../primitives"
import { ComposerThumbs } from "../primitives/ComposerThumbs"
import { useComposerAttachments } from "../primitives/useComposerAttachments"
import { Text, Icon, iconMap, type LucideIcon } from "../typography"
import { useAuthState, actableOrganizations, useMyOrganizations, useMyProfile } from "../data"
import { useT } from "../i18n"
import { useHaptics } from "../capabilities"
import { useCreatePost, usePost } from "../data/hooks/posts"
import { useNavStore } from "../nav"
import { makeKeyboardAwareScrollHost } from "../shell/KeyboardAwareScroll"
import { PLAIN_SCROLL_HOST, useScrollHost } from "../shell/ScrollHost"
import { AuthorAsChips, authorAsSelection } from "./AuthorAsChips"
import { EmbeddedPost } from "./EmbeddedPost"
import { LinkedEventCard } from "./LinkedEventCard"
import { LinkedReportCard } from "./LinkedReportCard"
import { useListTimeAgo } from "./useListTimeAgo"
import { useFeedScrollTopStore } from "./feed/feedScrollStore"
import { optimisticPostId } from "./thread/threadModel"
import { clearStaleReportIntentAtComposerMount } from "./composerCreateFlow"
import {
  POST_BODY_MAX_LENGTH,
  activePostMentions,
  buildComposerEventRef,
  buildComposerQuoteRef,
  buildPostComposerModel,
  type PostComposerAttachGroupPlan,
  type PostComposerModel,
} from "./postComposerModel"
import { keyboardDismissModeFor } from "./keyboardDismissMode"
import {
  POST_COMPOSER_MEDIA_CAP,
  carriedMediaIndex,
  mergePostComposerMedia,
  mergePostComposerThumbs,
  postComposerCanAttach,
  snapshotCarriedMedia,
} from "./postComposerMedia"
import { postSubmitDestination, resolvePostSubmit } from "./postComposerSubmit"
import { trackPostComposerMount, type PostComposerExitHost } from "./postComposerExit"
import { usePostComposerAttach, type PostComposerAttach } from "./usePostComposerAttach"
import {
  restoreFailedPostSubmit,
  selectPostComposerDraft,
  selectPostComposerDraftHidden,
  selectPostComposerDraftOwner,
  selectPostComposerHasPendingMedia,
  usePostComposerStore,
  type PostComposerDraft,
  type PostComposerMedia,
  type PostComposerMode,
} from "./postComposerStore"

export interface PostComposerStandaloneHost {
  onBack: () => void
}

export interface PostComposerProps {
  mode?: PostComposerMode
  targetPostId?: string
  onPosted?: (post: PostDTO) => void
  standalone?: PostComposerStandaloneHost
}

const MIN_TOUCH_TARGET = 44
const AUTHOR_AVATAR = 34
/** The body grows with its text up to this share of the window, then scrolls inside itself. */
const INPUT_MAX_WINDOW_SHARE = 0.4
const LIST_ACTION_HIT_SLOP = { left: 10, right: 10 }
const ENTRANCE_MS = 280
const ENTRANCE_RISE = 36
const ENTRANCE_SCALE_FROM = 0.99

const KEYBOARD_DISMISS_MODE = keyboardDismissModeFor(Platform.OS)

const STANDALONE_SCROLL_HOST = makeKeyboardAwareScrollHost(PLAIN_SCROLL_HOST)

const EXIT_HOST: PostComposerExitHost = {
  readIntent: () => {
    const state = usePostComposerStore.getState()
    return { pendingCreate: state.draft.pendingCreate, claimedCreate: state.claimedCreate }
  },
  readStack: () => useNavStore.getState().stack,
  discard: () => usePostComposerStore.getState().discardAttachments(),
}

function useComposerEntrance(): Animated.WithAnimatedValue<ViewStyle> {
  const reducedMotion = useReducedMotion()
  const progress = useRef(new Animated.Value(reducedMotion === true ? 1 : 0)).current

  useEffect(() => {
    if (reducedMotion == null) return
    if (reducedMotion) {
      progress.stopAnimation()
      progress.setValue(1)
      return
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: ENTRANCE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    })
    animation.start()
    return () => animation.stop()
  }, [progress, reducedMotion])

  return {
    opacity: progress,
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [ENTRANCE_RISE, 0] }) },
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [ENTRANCE_SCALE_FROM, 1] }) },
    ],
  }
}

/** Posting as an organization is offered only for the ones the viewer can still act for. */
function usePostAsOrganization(
  draft: Pick<PostComposerDraft, "organizationId">,
  setOrganizationId: (organizationId: string | null) => void,
) {
  const myOrgs = useMyOrganizations()
  const actableOrgs = actableOrganizations(myOrgs.data)
  const postAsOrganizations = actableOrgs ?? []
  const postAsOrganizationId = authorAsSelection(draft.organizationId, actableOrgs)
  useEffect(() => {
    if (draft.organizationId !== null && postAsOrganizationId === null) setOrganizationId(null)
  }, [draft.organizationId, postAsOrganizationId, setOrganizationId])
  const postAsOrganization =
    postAsOrganizations.find((org) => org.id === postAsOrganizationId) ?? null
  return { postAsOrganizations, postAsOrganizationId, postAsOrganization }
}

function ComposerHeader({
  presentation,
  t,
  onClose,
  onSubmit,
  submitDisabled,
  posting,
}: {
  presentation: PostComposerModel
  t: TFunction
  onClose: () => void
  onSubmit: () => void
  submitDisabled: boolean
  posting: boolean
}) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("close_a11y")}
        onPress={onClose}
        {...focusRingProps}
        style={({ pressed }) => [styles.closeButton, pressed ? styles.buttonPressed : null]}
      >
        <Icon icon={iconMap.Close} size={17} color={th.colors.text} strokeWidth={2} />
      </Pressable>
      <View pointerEvents="none" style={styles.headerTitleWrap}>
        <Text accessibilityRole="header" style={styles.headerTitle}>{presentation.title}</Text>
      </View>
      <View style={styles.headerSpacer} />
      <Pressable
        accessibilityRole="button"
        onPress={onSubmit}
        disabled={submitDisabled}
        {...focusRingProps}
        style={({ pressed }) => [styles.postButton, submitDisabled ? styles.postButtonDisabled : null, pressed ? styles.buttonPressed : null]}
      >
        <Text style={[styles.postButtonText, submitDisabled ? styles.postButtonTextDisabled : null]}>{posting ? t("action.posting") : presentation.submitLabel}</Text>
      </Pressable>
    </View>
  )
}

function ComposerAuthorRow({
  postAsOrganization,
  profile,
  t,
}: {
  postAsOrganization: OrganizationDTO | null
  profile: PersonDTO | undefined
  t: TFunction
}) {
  const styles = useStyles()
  return (
    <View style={styles.authorRow}>
      {postAsOrganization ? (
        <Avatar
          name={postAsOrganization.name}
          seed={postAsOrganization.id}
          photoUrl={postAsOrganization.logoUrl ?? null}
          size={AUTHOR_AVATAR}
          style={styles.authorOrgLogo}
        />
      ) : (
        <Avatar name={profile?.name ?? t("post_as.personal")} seed={profile?.id} photoUrl={profile?.avatarUrl} gradient={profile?.avatar ?? null} size={AUTHOR_AVATAR} />
      )}
      <Text style={styles.authorName}>{postAsOrganization?.name ?? profile?.name ?? t("post_as.personal")}</Text>
    </View>
  )
}

function ComposerMessageField({
  t,
  body,
  placeholder,
  draftHidden,
  onChangeBody,
  onMention,
  thumbs,
  onRemoveMedia,
  canAttachMedia,
  onAttachMedia,
}: {
  t: TFunction
  body: string
  placeholder: string
  draftHidden: boolean
  onChangeBody: (body: string) => void
  onMention: (candidate: MentionCandidate, nextDraft: string) => void
  thumbs: React.ComponentProps<typeof ComposerThumbs>["attachments"]
  onRemoveMedia: (id: string) => void
  canAttachMedia: boolean
  onAttachMedia: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const expanded = useLayoutMode() === "expanded"
  const [bodyFocused, setBodyFocused] = useState(false)
  const { height: windowHeight } = useWindowDimensions()
  const inputMaxHeight = Math.round(windowHeight * INPUT_MAX_WINDOW_SHARE)
  return (
    <View style={styles.messageSection}>
      <View style={styles.composeRow}>
        <View
          style={[
            styles.inputWrap,
            styles.inputSurface,
            expanded && bodyFocused ? styles.inputSurfaceFocused : null,
          ]}
        >
          <TextInput
            accessibilityLabel={t("input_a11y")}
            value={body}
            onChangeText={onChangeBody}
            editable={!draftHidden}
            onFocus={() => setBodyFocused(true)}
            onBlur={() => setBodyFocused(false)}
            placeholder={placeholder}
            placeholderTextColor={th.colors.textSubtle}
            multiline
            maxLength={POST_BODY_MAX_LENGTH}
            autoFocus
            style={[expanded ? webInputReset : null, styles.input, { maxHeight: inputMaxHeight }]}
          />
          <MentionAutocomplete draft={body} onSelect={onMention} />
          <ComposerThumbs
            attachments={thumbs}
            onRemove={onRemoveMedia}
            style={styles.thumbsInCard}
          />
          <View style={styles.mediaRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("add_media_a11y")}
              accessibilityState={{ disabled: !canAttachMedia }}
              disabled={!canAttachMedia}
              onPress={onAttachMedia}
              hitSlop={6}
              {...focusRingProps}
              style={({ pressed }) => [
                styles.addMedia,
                !canAttachMedia ? styles.addMediaDisabled : null,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <View style={styles.addMediaDisc}>
                <Icon
                  icon={iconMap.Plus}
                  size={18}
                  color={canAttachMedia ? th.colors.accent : th.colors.textSubtle}
                  strokeWidth={2.2}
                />
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  )
}

function QuotedPreview({
  quotedRef,
  failed,
  t,
  tf,
  timeAgo,
}: {
  quotedRef: PostRefDTO | null
  failed: boolean
  t: TFunction
  tf: TFunction
  timeAgo: (iso: string) => string
}) {
  const styles = useStyles()
  return (
    <View style={styles.quoted}>
      {quotedRef ? (
        <EmbeddedPost post={quotedRef} t={tf} timeAgo={timeAgo} />
      ) : failed ? (
        <Text style={styles.quotedUnavailable}>{t("quote.unavailable")}</Text>
      ) : (
        <View style={styles.quotedSkeleton} />
      )}
    </View>
  )
}

function ListActionButton({
  label,
  onPress,
  accessibilityState,
  disabled,
}: {
  label: string
  onPress: () => void
  accessibilityState: AccessibilityState
  disabled?: boolean
}) {
  const styles = useStyles()
  const flush = useLayoutMode() === "expanded"
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      disabled={disabled}
      onPress={onPress}
      hitSlop={LIST_ACTION_HIT_SLOP}
      {...focusRingProps}
      style={({ pressed }) => [
        flush ? [styles.listAction, styles.listActionFlush] : styles.listAction,
        pressed ? styles.listActionPressed : null,
      ]}
    >
      <Text style={styles.listActionText}>{label}</Text>
    </Pressable>
  )
}

function AttachGroup({
  title,
  plan,
  attached,
  candidates,
  showMore,
  showFewer,
}: {
  title: string
  plan: PostComposerAttachGroupPlan
  attached: React.ReactNode
  candidates: React.ReactNode
  showMore: React.ReactNode
  showFewer: React.ReactNode
}) {
  const styles = useStyles()
  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <Text accessibilityRole="header" {...headingLevel(2)} style={styles.groupTitle}>{title}</Text>
      </View>
      {plan.state === "attached" ? attached : null}
      {plan.state === "list" ? (
        <View style={styles.groupList}>
          {candidates}
          {plan.showMoreVisible || plan.showFewerVisible ? (
            <View style={styles.groupActions}>
              {plan.showMoreVisible ? showMore : null}
              {plan.showFewerVisible ? showFewer : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function AttachedEventCard({ attach }: { attach: PostComposerAttach }) {
  const { attachedEvent } = attach
  if (!attachedEvent) return null
  return (
    <LinkedEventCard
      event={attachedEvent}
      cleanup={attach.attachedCleanup}
      layout="list"
      timeZone={attachedEvent.timezone ?? undefined}
      selectable
      selected
      onRemove={attach.detachEvent}
    />
  )
}

function AttachedReportCard({ attach }: { attach: PostComposerAttach }) {
  if (!attach.attachedReport) return null
  return <LinkedReportCard report={attach.attachedReport} layout="list" headline="title" onRemove={attach.detachReport} />
}

function AttachSections({ attach, t }: { attach: PostComposerAttach; t: TFunction }) {
  const styles = useStyles()
  const { attachPlan } = attach
  const showMoreLabel = (count: number | null) =>
    count != null ? t("section.show_more_count", { count }) : t("section.show_more")
  return (
    <View style={styles.attachArea}>
      {attach.eventsSectionVisible ? (
        <AttachGroup
          title={t("section.events")}
          plan={attachPlan.events}
          attached={<AttachedEventCard attach={attach} />}
          candidates={attach.eventCandidates.slice(0, attachPlan.events.visibleCount).map((event) => (
            <LinkedEventCard
              key={event.id}
              event={buildComposerEventRef(event)}
              cleanup={event}
              layout="list"
              timeZone={event.timezone ?? undefined}
              selectable
              selected={false}
              onPress={() => attach.attachEvent(event)}
            />
          ))}
          showMore={
            <ListActionButton
              label={showMoreLabel(attachPlan.events.showMoreCount)}
              accessibilityState={{ expanded: attach.eventsExpanded }}
              onPress={attach.showMoreEvents}
            />
          }
          showFewer={
            <ListActionButton
              label={t("section.show_fewer")}
              accessibilityState={{ expanded: attach.eventsExpanded }}
              onPress={attach.showFewerEvents}
            />
          }
        />
      ) : null}

      {attach.reportsSectionVisible ? (
        <AttachGroup
          title={t("section.reports")}
          plan={attachPlan.reports}
          attached={<AttachedReportCard attach={attach} />}
          candidates={attach.reportCandidates.slice(0, attachPlan.reports.visibleCount).map((report) => (
            <LinkedReportCard
              key={report.id}
              report={report}
              layout="list"
              selectable
              selected={false}
              onPress={() => attach.attachReport(report.id)}
            />
          ))}
          showMore={
            <ListActionButton
              label={showMoreLabel(attachPlan.reports.showMoreCount)}
              accessibilityState={{ expanded: attach.reportsExpanded, disabled: attach.fetchingMoreReports }}
              disabled={attach.fetchingMoreReports}
              onPress={attach.showMoreReports}
            />
          }
          showFewer={
            <ListActionButton
              label={t("section.show_fewer")}
              accessibilityState={{ expanded: attach.reportsExpanded }}
              onPress={attach.showFewerReports}
            />
          }
        />
      ) : null}
    </View>
  )
}

function AttachPanel({
  kind,
  attach,
  draft,
  t,
}: {
  kind: "events" | "reports"
  attach: PostComposerAttach
  draft: PostComposerDraft
  t: TFunction
}) {
  const styles = useStyles()
  const group = kind === "events" ? attach.attachPlan.events : attach.attachPlan.reports
  return (
    <ScrollView style={styles.panel} nestedScrollEnabled contentContainerStyle={styles.pickerContent}>
      {group.state === "loading" ? <View style={styles.groupPlaceholder} /> : null}
      {group.state === "empty" ? (
        <Text style={styles.emptyPicker}>{kind === "events" ? t("empty_events") : t("empty_reports")}</Text>
      ) : null}
      {group.state === "list" && kind === "events"
        ? attach.eventCandidates.map((event) => (
            <LinkedEventCard
              key={event.id}
              event={buildComposerEventRef(event)}
              cleanup={event}
              layout="list"
              timeZone={event.timezone ?? undefined}
              selectable
              selected={event.id === draft.attachedEventId}
              onPress={() => attach.attachEvent(event)}
            />
          ))
        : null}
      {group.state === "list" && kind === "reports" ? (
        <>
          {attach.reportCandidates.map((report) => (
            <LinkedReportCard
              key={report.id}
              report={report}
              layout="list"
              selectable
              selected={report.id === draft.attachedReportId}
              onPress={() => attach.attachReport(report.id)}
            />
          ))}
          {group.showMoreVisible ? (
            <ListActionButton
              label={t("section.show_more")}
              accessibilityState={{ disabled: attach.fetchingMoreReports }}
              disabled={attach.fetchingMoreReports}
              onPress={attach.fetchMoreReports}
            />
          ) : null}
        </>
      ) : null}
    </ScrollView>
  )
}

function AttachPill({
  label,
  a11yLabel,
  icon,
  open,
  onPress,
}: {
  label: string
  a11yLabel: string
  icon: LucideIcon
  open: boolean
  onPress: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      {...focusRingProps}
      style={({ pressed }) => [styles.pill, open ? styles.pillOpen : null, pressed ? styles.listActionPressed : null]}
    >
      <Icon icon={icon} size={16} color={th.colors.accent} />
      <Text style={styles.pillText}>{label}</Text>
    </Pressable>
  )
}

/** Reply and quote composers tuck the attach lists behind two pills, one open panel at a time. */
function AttachPills({ attach, draft, t }: { attach: PostComposerAttach; draft: PostComposerDraft; t: TFunction }) {
  const styles = useStyles()
  const { attachPlan } = attach
  const previewsVisible = attach.attachedEvent != null || attach.attachedReport != null
  return (
    <>
      {previewsVisible ? (
        <View style={styles.attachedStack}>
          <AttachedEventCard attach={attach} />
          <AttachedReportCard attach={attach} />
        </View>
      ) : null}
      {attachPlan.eventPanelVisible ? <AttachPanel kind="events" attach={attach} draft={draft} t={t} /> : null}
      {attachPlan.reportPanelVisible ? <AttachPanel kind="reports" attach={attach} draft={draft} t={t} /> : null}
      <View style={styles.pillsRow}>
        <AttachPill
          label={t("pills.event")}
          a11yLabel={t("pills.event_a11y")}
          icon={iconMap.Calendar}
          open={attachPlan.eventPanelVisible}
          onPress={() => attach.togglePanel("events")}
        />
        <AttachPill
          label={t("pills.report")}
          a11yLabel={t("pills.report_a11y")}
          icon={iconMap.MapPin}
          open={attachPlan.reportPanelVisible}
          onPress={() => attach.togglePanel("reports")}
        />
      </View>
    </>
  )
}

export function PostComposer(props: PostComposerProps) {
  const draftOwner = usePostComposerStore(selectPostComposerDraftOwner)
  return <PostComposerForOwner key={draftOwner ?? ""} {...props} />
}

function PostComposerForOwner({ mode = "post", targetPostId, onPosted, standalone }: PostComposerProps) {
  const styles = useStyles()
  const back = useNavStore((state) => state.back)
  const push = useNavStore((state) => state.push)
  const { t } = useT("post-composer")
  const { t: tf } = useT("home-feed")
  const timeAgo = useListTimeAgo()
  const presentation = buildPostComposerModel(mode, t)
  const isStandalone = standalone !== undefined
  const onBack = standalone?.onBack
  const inheritedScrollHost = useScrollHost()
  const { ScrollView: ComposerScrollView } = isStandalone
    ? STANDALONE_SCROLL_HOST
    : inheritedScrollHost
  const entranceStyle = useComposerEntrance()
  const profile = useMyProfile().data?.profile
  const { isAuthenticated } = useAuthState()
  const haptics = useHaptics()
  const create = useCreatePost()
  const draft = usePostComposerStore(selectPostComposerDraft)
  // The store ignores writes to a hidden draft, so the composer goes read-only instead of eating input.
  const draftHidden = usePostComposerStore(selectPostComposerDraftHidden)
  const setBody = usePostComposerStore((state) => state.setBody)
  const setMentionedUsers = usePostComposerStore((state) => state.setMentionedUsers)
  const setAttachedEvent = usePostComposerStore((state) => state.setAttachedEvent)
  const setAttachedReportId = usePostComposerStore((state) => state.setAttachedReportId)
  const setMedia = usePostComposerStore((state) => state.setMedia)
  const setMode = usePostComposerStore((state) => state.setMode)
  const setOrganizationId = usePostComposerStore((state) => state.setOrganizationId)
  const setReplyToPostId = usePostComposerStore((state) => state.setReplyToPostId)
  const setQuotePostId = usePostComposerStore((state) => state.setQuotePostId)
  const reset = usePostComposerStore((state) => state.reset)
  const toast = useToast()
  const mountedRef = useRef(true)
  const hasPendingMedia = usePostComposerStore(selectPostComposerHasPendingMedia)
  const attachments = useComposerAttachments(POST_COMPOSER_MEDIA_CAP)
  const [carriedSnapshot] = useState(() =>
    snapshotCarriedMedia(draft.media),
  )
  const [carriedMedia, setCarriedMedia] = useState<PostComposerMedia[]>(() => carriedSnapshot.carried)
  const [droppedMedia, setDroppedMedia] = useState(() => carriedSnapshot.dropped)
  const submittingRef = useRef(false)

  useEffect(() => {
    setMode(mode)
    setReplyToPostId(mode === "reply" ? (targetPostId ?? null) : null)
    setQuotePostId(mode === "quote" ? (targetPostId ?? null) : null)
  }, [mode, setMode, setQuotePostId, setReplyToPostId, targetPostId])

  useEffect(clearStaleReportIntentAtComposerMount, [])

  useEffect(() => trackPostComposerMount(EXIT_HOST), [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const attach = usePostComposerAttach({
    mode,
    signedIn: isAuthenticated,
    draft,
    setAttachedEvent,
    setAttachedReportId,
  })
  const { attachPlan, attachedEvent, attachedReport } = attach
  const mediaUploadIds = useMemo(
    () => draft.media.flatMap((media) => media.status === "ready" && media.uploadId ? [media.uploadId] : []),
    [draft.media],
  )
  const quoteTargetId = mode === "quote" ? targetPostId : undefined
  const quotedPost = usePost(quoteTargetId)
  const quotedRef = useMemo(
    () => (quotedPost.data ? buildComposerQuoteRef(quotedPost.data) : null),
    [quotedPost.data],
  )

  const composerMedia = useMemo(
    () => mergePostComposerMedia(carriedMedia, attachments.attachments),
    [carriedMedia, attachments.attachments],
  )
  const composerThumbs = useMemo(
    () => mergePostComposerThumbs(carriedMedia, attachments.attachments),
    [carriedMedia, attachments.attachments],
  )
  const canAttachMedia = postComposerCanAttach({
    hookCanAttach: !draftHidden && attachments.canAttach,
    carried: carriedMedia.length,
    picked: attachments.attachments.length,
  })
  const removeMedia = (id: string) => {
    const carriedIndex = carriedMediaIndex(id)
    if (carriedIndex != null) {
      setCarriedMedia((current) => current.filter((_, index) => index !== carriedIndex))
      return
    }
    attachments.removeAttachment(id)
  }

  useEffect(() => {
    if (!draftHidden) setMedia(composerMedia)
  }, [composerMedia, draftHidden, setMedia])
  const activeMentions = useMemo(
    () => activePostMentions(draft.body, draft.mentionedUsers),
    [draft.body, draft.mentionedUsers],
  )
  const { postAsOrganizations, postAsOrganizationId, postAsOrganization } = usePostAsOrganization(
    draft,
    setOrganizationId,
  )
  const resolution = resolvePostSubmit({
    body: draft.body,
    eventId: draft.attachedEventId,
    reportId: draft.attachedReportId,
    mediaCount: draft.media.length,
    mediaUploadIds,
    kind: draft.mode,
    replyToId: draft.replyToPostId,
    repostOfId: draft.quotePostId,
    mentionedUserIds: activeMentions.map((user) => user.id),
    organizationId: postAsOrganizationId,
  }, draft.media.length === 0 || (!hasPendingMedia && mediaUploadIds.length === draft.media.length))

  const submit = () => {
    if (submittingRef.current) return
    if (!profile || resolution.action !== "submit") return
    submittingRef.current = true
    const optimistic: PostDTO = {
      id: optimisticPostId(Date.now()),
      author: profile,
      organization: postAsOrganization
        ? {
            id: postAsOrganization.id,
            slug: postAsOrganization.slug,
            name: postAsOrganization.name,
            logoUrl: postAsOrganization.logoUrl ?? null,
            verified: postAsOrganization.verifiedStatus === "verified",
            ...(postAsOrganization.verifiedKind
              ? { verifiedKind: postAsOrganization.verifiedKind }
              : {}),
          }
        : null,
      kind: resolution.input.kind,
      body: resolution.input.body ?? null,
      createdAt: new Date().toISOString(),
      editedAt: null,
      counts: { likes: 0, reposts: 0, replies: 0, saves: 0 },
      viewer: { liked: false, reposted: false, saved: false },
      media: composerMedia.flatMap((item) => item.uploadId ? [{
        id: item.uploadId,
        kind: item.kind,
        url: item.uri,
        thumbUrl: item.posterUri,
        status: "ready" as const,
      }] : []),
      mentions: activeMentions,
      event: attachedEvent ? { ...attachedEvent, linkedAt: new Date().toISOString() } : null,
      report: attachedReport ? { ...attachedReport, linkedAt: new Date().toISOString() } : null,
      repostOf: null,
      replyToId: resolution.input.replyToId ?? null,
      threadRootId: resolution.input.replyToId ?? null,
    }
    const staged = selectPostComposerDraft(usePostComposerStore.getState())
    reset({ mode, targetPostId: targetPostId ?? null })
    create.mutateAsync({ input: resolution.input, optimistic }, {
      onSuccess: (post) => {
        haptics.success()
        attachments.reset()
        setCarriedMedia([])
        setDroppedMedia(0)
        attach.resetAttachUi()
        onPosted?.(post)
        if (onBack) onBack()
        else back()
        if (postSubmitDestination(resolution.input.kind) === "thread") push({ kind: "post-thread", id: post.id })
        else useFeedScrollTopStore.getState().requestScrollTop()
      },
      onSettled: () => {
        submittingRef.current = false
      },
    }).catch(() => {
      haptics.error()
      const restored = restoreFailedPostSubmit(staged)
      if (!mountedRef.current) {
        toast.show(t(restored ? "submit_error_restored" : "submit_error"), { variant: "error" })
      }
    })
  }

  const onMention = (candidate: MentionCandidate, nextDraft: string) => {
    setBody(nextDraft)
    if ((candidate as { kind?: string }).kind === "jurisdiction") return
    const user: UserMentionDTO = { id: candidate.id, handle: candidate.handle, displayName: candidate.displayName }
    setMentionedUsers([...draft.mentionedUsers.filter((item) => item.id !== user.id), user])
  }

  const closeComposer = () => {
    usePostComposerStore.getState().discardAttachments()
    attachments.reset()
    setCarriedMedia([])
    setDroppedMedia(0)
    ;(onBack ?? back)()
  }

  const submitDisabled =
    draftHidden || !profile || resolution.action !== "submit" || create.isPending

  const sectionsVisible = attach.eventsSectionVisible || attach.reportsSectionVisible
  const pillsVisible = attachPlan.variant === "pills"

  return (
    <Animated.View style={[styles.root, entranceStyle]}>
      <ComposerHeader
        presentation={presentation}
        t={t}
        onClose={closeComposer}
        onSubmit={submit}
        submitDisabled={submitDisabled}
        posting={create.isPending}
      />
      <ComposerScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={KEYBOARD_DISMISS_MODE}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.fields}>
          <ComposerAuthorRow postAsOrganization={postAsOrganization} profile={profile} t={t} />

          <AuthorAsChips
            organizations={postAsOrganizations}
            value={postAsOrganizationId}
            onChange={setOrganizationId}
            label={t("post_as.label")}
            personalLabel={t("post_as.personal")}
            chipA11y={(name) => t("post_as.a11y", { name })}
            groupA11y={t("post_as.group_a11y")}
            disabled={create.isPending}
          />

          <ComposerMessageField
            t={t}
            body={draft.body}
            placeholder={presentation.placeholder}
            draftHidden={draftHidden}
            onChangeBody={setBody}
            onMention={onMention}
            thumbs={composerThumbs}
            onRemoveMedia={removeMedia}
            canAttachMedia={canAttachMedia}
            onAttachMedia={() => void attachments.onAttach()}
          />
          {quoteTargetId ? (
            <QuotedPreview quotedRef={quotedRef} failed={quotedPost.isError} t={t} tf={tf} timeAgo={timeAgo} />
          ) : null}
          {attachments.attachError ? <Text style={styles.error}>{attachments.attachError}</Text> : null}
          {droppedMedia > 0 ? <Text style={styles.error}>{t("media_dropped")}</Text> : null}
          {create.isError ? <Text style={styles.error}>{t("submit_error")}</Text> : null}

          {sectionsVisible || pillsVisible ? <View style={styles.attachDivider} /> : null}
          {pillsVisible ? <AttachPills attach={attach} draft={draft} t={t} /> : null}
          {sectionsVisible ? <AttachSections attach={attach} t={t} /> : null}
        </View>
      </ComposerScrollView>
    </Animated.View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.bg },
  header: { minHeight: 60, paddingHorizontal: t.space["4"], flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border, position: "relative" },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.neutral.card, borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border, zIndex: 2 },
  headerTitleWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  headerTitle: { fontFamily: t.fontFamily.bodyExtraBold, fontSize: 17, lineHeight: 22, color: t.colors.text },
  headerSpacer: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: t.space["4"], paddingBottom: 36 },
  fields: { gap: 14 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  authorName: { fontFamily: t.fontFamily.bodyBold, fontSize: 13.5, lineHeight: 18, color: t.colors.textMuted },
  authorOrgLogo: { borderRadius: t.radius.sm },
  messageSection: { gap: 9 },
  composeRow: { flexDirection: "row", alignItems: "flex-start", gap: t.space["3"] },
  inputWrap: { flex: 1, minWidth: 0 },
  inputSurface: { paddingHorizontal: t.space["2"], paddingVertical: t.space["1"], borderRadius: 18, backgroundColor: t.colors.neutral.card, borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border },
  inputSurfaceFocused:
    Platform.OS === "web"
      ? ({ boxShadow: tokens.shadow.ring, borderColor: t.colors.accent } as ViewStyle)
      : { borderColor: t.colors.accent },
  input: { minHeight: 104, padding: t.space["2"], fontFamily: t.fontFamily.bodyRegular, fontSize: 14.5, lineHeight: 21, color: t.colors.text, textAlignVertical: "top" },
  thumbsInCard: { marginHorizontal: t.space["2"], marginTop: t.space["1"] },
  mediaRow: { flexDirection: "row", alignItems: "center" },
  addMedia: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: "center", justifyContent: "center", marginLeft: t.space["1"], marginTop: 2, marginBottom: 2 },
  addMediaDisc: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.surfaceTint },
  addMediaDisabled: { opacity: 0.52 },
  postButton: { minHeight: 44, paddingHorizontal: 18, borderRadius: t.radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.accent, zIndex: 2 },
  postButtonDisabled: { backgroundColor: t.colors.surfaceTint },
  postButtonText: { color: t.colors.neutral.card, fontFamily: t.fontFamily.bodyExtraBold, fontSize: t.fontSize["14"], lineHeight: 18 },
  postButtonTextDisabled: { color: t.colors.textSubtle },
  buttonPressed: { opacity: 0.78, transform: [{ scale: 0.94 }] },
  attachDivider: { height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border, marginTop: t.space["1"], marginBottom: t.space["1"] },
  attachArea: { gap: 18, marginTop: t.space["1"] },
  group: { gap: 9 },
  groupHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: t.space["2"] },
  groupTitle: { color: t.colors.text, fontFamily: t.fontFamily.displayBold, fontSize: t.fontSize["20"], lineHeight: 25, letterSpacing: -0.35 },
  groupList: { gap: 9 },
  groupActions: { flexDirection: "row", alignItems: "center", gap: t.space["2"] },
  groupPlaceholder: { height: 72, borderRadius: 16, backgroundColor: t.colors.surfaceTint },
  listAction: { minHeight: 44, justifyContent: "center", paddingHorizontal: 10, borderRadius: t.radius.pill },
  listActionFlush: { paddingHorizontal: 0 },
  listActionPressed: { opacity: 0.55 },
  listActionText: { color: t.colors.accentText, fontFamily: t.fontFamily.bodyBold, fontSize: 13.5, lineHeight: 18 },
  quoted: { marginTop: t.space["1"] },
  quotedSkeleton: { height: 96, borderRadius: 16, backgroundColor: t.colors.surfaceTint },
  quotedUnavailable: { padding: 14, borderRadius: 16, backgroundColor: t.colors.surfaceTint, fontFamily: t.fontFamily.bodyMedium, fontSize: 13.5, lineHeight: 19, color: t.colors.textMuted },
  attachedStack: { gap: 9 },
  panel: { maxHeight: 284 },
  pickerContent: { gap: 9, padding: 1 },
  pillsRow: { flexDirection: "row", alignItems: "center", gap: t.space["2"] },
  pill: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: t.radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border, backgroundColor: t.colors.neutral.card },
  pillOpen: { borderColor: t.colors.accent, backgroundColor: t.colors.surfaceTint },
  pillText: { color: t.colors.accentText, fontFamily: t.fontFamily.bodyBold, fontSize: t.fontSize["13"], lineHeight: 18 },
  emptyPicker: { padding: 14, borderRadius: 16, backgroundColor: t.colors.surfaceTint, fontFamily: t.fontFamily.bodyMedium, fontSize: 13.5, lineHeight: 19, color: t.colors.textMuted },
  error: { color: t.colors.accentText, fontFamily: t.fontFamily.bodySemiBold },
}))
