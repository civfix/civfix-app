import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  AccessibilityInfo,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type TextInput as RNTextInput,
  type ViewStyle,
} from "react-native"
import { TextInput } from "../primitives/TextInput"
import type { CleanupDTO, PostDTO, UserMentionDTO } from "@civfix/shared"
import { tokens } from "@civfix/shared/tokens"
import {
  focusRingProps,
  headingLevel,
  makeThemedStyles,
  useLayoutMode,
  useTheme,
  webInputReset,
} from "../theme"
import { Avatar, MentionAutocomplete } from "../primitives"
import type { MentionCandidate } from "../primitives"
import { ComposerThumbs } from "../primitives/ComposerThumbs"
import { useComposerAttachments } from "../primitives/useComposerAttachments"
import { Text, Icon, iconMap } from "../typography"
import {
  useAttendingCleanups,
  useAuthState,
  actableOrganizations,
  useMyOrganizations,
  useMyProfile,
  useMyReports,
} from "../data"
import { attachableEvents, attachableReports } from "../data/composerAttachable"
import { useT } from "../i18n"
import { useHaptics } from "../capabilities"
import { useCreatePost } from "../data/hooks/posts"
import { useNavStore } from "../nav"
import { makeKeyboardAwareScrollHost } from "../shell/KeyboardAwareScroll"
import { PLAIN_SCROLL_HOST, useScrollHost } from "../shell/ScrollHost"
import { AuthorAsChips, authorAsSelection } from "./AuthorAsChips"
import { LinkedEventCard } from "./LinkedEventCard"
import { LinkedReportCard } from "./LinkedReportCard"
import { useFeedScrollTopStore } from "./feed/feedScrollStore"
import { clearStaleReportIntentAtComposerMount } from "./composerCreateFlow"
import {
  activePostMentions,
  buildComposerEventRef,
  buildPostComposerAttachPlan,
  buildPostComposerKeyboardPlan,
  buildPostComposerModel,
  initialPostComposerAttachmentPanel,
  postComposerSectionVisible,
  resolveComposerEvent,
  resolveComposerReport,
  shouldClearStaleAttachedEvent,
  shouldClearStaleAttachedReport,
  togglePostComposerAttachmentPanel,
} from "./postComposerModel"
export {
  activePostMentions,
  buildPostComposerAttachPlan,
  buildPostComposerKeyboardPlan,
  buildPostComposerModel,
} from "./postComposerModel"
import {
  POST_COMPOSER_MEDIA_CAP,
  carriedMediaIndex,
  mergePostComposerMedia,
  mergePostComposerThumbs,
  snapshotCarriedMedia,
} from "./postComposerMedia"
import { postSubmitDestination, resolvePostSubmit } from "./postComposerSubmit"
import { trackPostComposerMount, type PostComposerExitHost } from "./postComposerExit"
import {
  selectPostComposerHasPendingMedia,
  usePostComposerStore,
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

const STANDALONE_SCROLL_HOST = makeKeyboardAwareScrollHost(PLAIN_SCROLL_HOST)

const EXIT_HOST: PostComposerExitHost = {
  readIntent: () => {
    const state = usePostComposerStore.getState()
    return { pendingCreate: state.draft.pendingCreate, claimedCreate: state.claimedCreate }
  },
  readStack: () => useNavStore.getState().stack,
  discard: () => usePostComposerStore.getState().discardAttachments(),
}

function softenLayoutChange() {
  if (Platform.OS === "ios") LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
}

let reduceMotionCache = false

function useComposerEntrance(): Animated.WithAnimatedValue<ViewStyle> {
  const progress = useRef(new Animated.Value(reduceMotionCache ? 1 : 0)).current

  useEffect(() => {
    const settle = () => {
      progress.stopAnimation()
      progress.setValue(1)
    }
    if (reduceMotionCache) {
      settle()
    } else {
      Animated.timing(progress, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }).start()
    }
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        reduceMotionCache = !!reduceMotion
        if (reduceMotion) settle()
      })
      .catch(() => {})
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (reduceMotion) => {
      reduceMotionCache = !!reduceMotion
      if (reduceMotion) settle()
    })
    return () => {
      subscription.remove()
      progress.stopAnimation()
    }
  }, [progress])

  return {
    opacity: progress,
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }) },
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.99, 1] }) },
    ],
  }
}

export function PostComposer({ mode = "post", targetPostId, onPosted, standalone }: PostComposerProps) {
  const styles = useStyles()
  const th = useTheme()
  const back = useNavStore((state) => state.back)
  const push = useNavStore((state) => state.push)
  const { t } = useT("post-composer")
  const presentation = buildPostComposerModel(mode, t)
  const platform = Platform.OS === "ios" || Platform.OS === "android" || Platform.OS === "web"
    ? Platform.OS
    : "other"
  const keyboard = buildPostComposerKeyboardPlan({ platform })
  const isStandalone = standalone !== undefined
  const onBack = standalone?.onBack
  const inheritedScrollHost = useScrollHost()
  const { ScrollView: ComposerScrollView } = isStandalone
    ? STANDALONE_SCROLL_HOST
    : inheritedScrollHost
  const entranceStyle = useComposerEntrance()
  const { height: windowHeight } = useWindowDimensions()
  const inputMaxHeight = Math.round(windowHeight * 0.4)
  const profile = useMyProfile().data?.profile
  const { isAuthenticated } = useAuthState()
  const events = useAttendingCleanups()
  const haptics = useHaptics()
  const create = useCreatePost()
  const draft = usePostComposerStore((state) => state.draft)
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
  const restore = usePostComposerStore((state) => state.restore)
  const hasPendingMedia = usePostComposerStore(selectPostComposerHasPendingMedia)
  const [attachmentPanel, setAttachmentPanel] = useState(initialPostComposerAttachmentPanel)
  const [eventsExpanded, setEventsExpanded] = useState(false)
  const [reportsExpanded, setReportsExpanded] = useState(false)
  const reports = useMyReports()
  const attachments = useComposerAttachments(POST_COMPOSER_MEDIA_CAP)
  const [carriedSnapshot] = useState(() =>
    snapshotCarriedMedia(usePostComposerStore.getState().draft.media),
  )
  const [carriedMedia, setCarriedMedia] = useState<PostComposerMedia[]>(() => carriedSnapshot.carried)
  const [droppedMedia, setDroppedMedia] = useState(() => carriedSnapshot.dropped)
  const inputRef = useRef<RNTextInput>(null)
  const submittingRef = useRef(false)
  const expanded = useLayoutMode() === "expanded"
  const [bodyFocused, setBodyFocused] = useState(false)
  const listActionStyle = expanded ? [styles.listAction, styles.listActionFlush] : styles.listAction

  useEffect(() => {
    setMode(mode)
    setReplyToPostId(mode === "reply" ? (targetPostId ?? null) : null)
    setQuotePostId(mode === "quote" ? (targetPostId ?? null) : null)
  }, [mode, setMode, setQuotePostId, setReplyToPostId, targetPostId])

  useEffect(clearStaleReportIntentAtComposerMount, [])

  useEffect(() => trackPostComposerMount(EXIT_HOST), [])

  const eventItems = useMemo(() => events.data ?? [], [events.data])
  const attachedEvent = useMemo(
    () => resolveComposerEvent(draft.attachedEventId, draft.attachedEvent, eventItems),
    [draft.attachedEvent, draft.attachedEventId, eventItems],
  )
  const attachedCleanup = eventItems.find((event) => event.id === attachedEvent?.id)
  const mediaUploadIds = useMemo(
    () => draft.media.flatMap((media) => media.status === "ready" && media.uploadId ? [media.uploadId] : []),
    [draft.media],
  )
  const reportItems = useMemo(
    () => reports.data?.pages.flatMap((page) => page.items) ?? [],
    [reports.data],
  )
  const attachedReport = useMemo(
    () => resolveComposerReport(draft.attachedReportId, draft.attachedReport, reportItems),
    [draft.attachedReportId, draft.attachedReport, reportItems],
  )
  const eventCandidates = useMemo(() => attachableEvents(eventItems), [eventItems])
  const reportCandidates = useMemo(() => attachableReports(reportItems), [reportItems])

  const eventsLoaded = events.isSuccess || events.isError
  const reportsLoaded = reports.isSuccess || reports.isError
  useEffect(() => {
    if (
      shouldClearStaleAttachedEvent({
        attachedEventId: draft.attachedEventId,
        resolved: attachedEvent != null,
        loaded: events.isSuccess,
      })
    ) {
      setAttachedEvent(null)
    }
  }, [attachedEvent, draft.attachedEventId, events.isSuccess, setAttachedEvent])
  useEffect(() => {
    if (
      shouldClearStaleAttachedReport({
        attachedReportId: draft.attachedReportId,
        resolved: attachedReport != null,
        loaded: reports.isSuccess,
        hasNextPage: reports.hasNextPage === true,
        hasSnapshot: draft.attachedReport != null,
      })
    ) {
      setAttachedReportId(null)
    }
  }, [
    attachedReport,
    draft.attachedReport,
    draft.attachedReportId,
    reports.hasNextPage,
    reports.isSuccess,
    setAttachedReportId,
  ])

  const attachPlan = buildPostComposerAttachPlan({
    mode,
    signedIn: isAuthenticated,
    attachmentPanel,
    events: {
      loaded: eventsLoaded,
      count: eventCandidates.length,
      expanded: eventsExpanded,
      attached: attachedEvent != null,
    },
    reports: {
      loaded: reportsLoaded,
      count: reportCandidates.length,
      expanded: reportsExpanded,
      hasNextPage: reports.hasNextPage === true,
      attached: attachedReport != null,
    },
  })

  const composerMedia = useMemo(
    () => mergePostComposerMedia(carriedMedia, attachments.attachments),
    [carriedMedia, attachments.attachments],
  )
  const composerThumbs = useMemo(
    () => mergePostComposerThumbs(carriedMedia, attachments.attachments),
    [carriedMedia, attachments.attachments],
  )
  const canAttachMedia = attachments.canAttach && composerMedia.length < POST_COMPOSER_MEDIA_CAP
  const removeMedia = (id: string) => {
    const carriedIndex = carriedMediaIndex(id)
    if (carriedIndex != null) {
      setCarriedMedia((current) => current.filter((_, index) => index !== carriedIndex))
      return
    }
    attachments.removeAttachment(id)
  }

  useEffect(() => {
    setMedia(composerMedia)
  }, [composerMedia, setMedia])
  const activeMentions = useMemo(
    () => activePostMentions(draft.body, draft.mentionedUsers),
    [draft.body, draft.mentionedUsers],
  )
  const myOrgs = useMyOrganizations()
  const actableOrgs = actableOrganizations(myOrgs.data)
  const postAsOrganizations = actableOrgs ?? []
  const postAsOrganizationId = authorAsSelection(draft.organizationId, actableOrgs)
  useEffect(() => {
    if (draft.organizationId !== null && postAsOrganizationId === null) setOrganizationId(null)
  }, [draft.organizationId, postAsOrganizationId, setOrganizationId])
  const postAsOrganization =
    postAsOrganizations.find((org) => org.id === postAsOrganizationId) ?? null
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
      id: `optimistic-${Date.now()}`,
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
    const staged = usePostComposerStore.getState().draft
    reset({ mode, targetPostId: targetPostId ?? null })
    create.mutate({ input: resolution.input, optimistic }, {
      onError: () => {
        haptics.error()
        restore(staged)
      },
      onSuccess: (post) => {
        haptics.success()
        attachments.reset()
        setCarriedMedia([])
        setDroppedMedia(0)
        setAttachmentPanel(null)
        setEventsExpanded(false)
        setReportsExpanded(false)
        onPosted?.(post)
        if (onBack) onBack()
        else back()
        if (postSubmitDestination(resolution.input.kind) === "thread") push({ kind: "post-thread", id: post.id })
        else useFeedScrollTopStore.getState().requestScrollTop()
      },
      onSettled: () => {
        submittingRef.current = false
      },
    })
  }

  const onMention = (candidate: MentionCandidate, nextDraft: string) => {
    setBody(nextDraft)
    if ((candidate as { kind?: string }).kind === "jurisdiction") return
    const user: UserMentionDTO = { id: candidate.id, handle: candidate.handle, displayName: candidate.displayName }
    setMentionedUsers([...draft.mentionedUsers.filter((item) => item.id !== user.id), user])
  }

  const attachEvent = (event: CleanupDTO) => {
    softenLayoutChange()
    setAttachedEvent(buildComposerEventRef(event, new Date().toISOString()))
    setEventsExpanded(false)
    setAttachmentPanel(null)
  }
  const detachEvent = () => {
    softenLayoutChange()
    setAttachedEvent(null)
    setEventsExpanded(false)
  }
  const attachReport = (id: string) => {
    softenLayoutChange()
    setAttachedReportId(id)
    setReportsExpanded(false)
    setAttachmentPanel(null)
  }
  const detachReport = () => {
    softenLayoutChange()
    setAttachedReportId(null)
    setReportsExpanded(false)
  }
  const onEventsShowMore = () => {
    softenLayoutChange()
    setEventsExpanded(true)
  }
  const onEventsShowFewer = () => {
    softenLayoutChange()
    setEventsExpanded(false)
  }
  const onReportsShowMore = () => {
    const revealsLoaded = reportCandidates.length > attachPlan.reports.visibleCount
    if (!reportsExpanded) {
      softenLayoutChange()
      setReportsExpanded(true)
    }
    if (!revealsLoaded && reports.hasNextPage && !reports.isFetchingNextPage) void reports.fetchNextPage()
  }
  const onReportsShowFewer = () => {
    softenLayoutChange()
    setReportsExpanded(false)
  }

  const closeComposer = () => {
    usePostComposerStore.getState().discardAttachments()
    attachments.reset()
    setCarriedMedia([])
    setDroppedMedia(0)
    ;(onBack ?? back)()
  }

  const submitDisabled = !profile || resolution.action !== "submit" || create.isPending

  const addMediaButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("add_media_a11y")}
      accessibilityState={{ disabled: !canAttachMedia }}
      disabled={!canAttachMedia}
      onPress={() => void attachments.onAttach()}
      hitSlop={6}
      {...focusRingProps}
      style={({ pressed }) => [
        styles.addMedia,
        !canAttachMedia ? styles.addMediaDisabled : null,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      <Icon
        icon={iconMap.Plus}
        size={18}
        color={canAttachMedia ? th.colors.accent : th.colors.textSubtle}
        strokeWidth={2.2}
      />
    </Pressable>
  )

  const messageSection = (
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
            ref={inputRef}
            accessibilityLabel={t("input_a11y")}
            value={draft.body}
            onChangeText={setBody}
            onFocus={() => setBodyFocused(true)}
            onBlur={() => setBodyFocused(false)}
            placeholder={presentation.placeholder}
            placeholderTextColor={th.colors.textSubtle}
            multiline
            maxLength={2000}
            autoFocus
            style={[expanded ? webInputReset : null, styles.input, { maxHeight: inputMaxHeight }]}
          />
          <MentionAutocomplete draft={draft.body} onSelect={onMention} />
          <ComposerThumbs
            attachments={composerThumbs}
            onRemove={removeMedia}
            style={styles.thumbsInCard}
          />
          <View style={styles.mediaRow}>{addMediaButton}</View>
        </View>
      </View>
    </View>
  )

  const errorLines = (
    <>
      {attachments.attachError ? <Text style={styles.error}>{attachments.attachError}</Text> : null}
      {droppedMedia > 0 ? <Text style={styles.error}>{t("media_dropped")}</Text> : null}
      {create.isError ? <Text style={styles.error}>{t("submit_error")}</Text> : null}
    </>
  )

  const attachedEventCard = attachedEvent ? (
    <LinkedEventCard
      event={attachedEvent}
      cleanup={attachedCleanup}
      layout="list"
      selectable
      selected
      onRemove={detachEvent}
    />
  ) : null
  const attachedReportCard = attachedReport ? (
    <LinkedReportCard report={attachedReport} layout="list" headline="title" onRemove={detachReport} />
  ) : null

  const showMoreLabel = (count: number | null) =>
    count != null ? t("section.show_more_count", { count }) : t("section.show_more")

  const eventsSectionVisible =
    attachPlan.variant === "sections" && postComposerSectionVisible(attachPlan.events.state)
  const reportsSectionVisible =
    attachPlan.variant === "sections" && postComposerSectionVisible(attachPlan.reports.state)

  const attachSections = eventsSectionVisible || reportsSectionVisible ? (
    <View style={styles.attachArea}>
      {eventsSectionVisible ? (
      <View style={styles.group}>
        <View style={styles.groupHeader}>
          <Text accessibilityRole="header" {...headingLevel(2)} style={styles.groupTitle}>{t("section.events")}</Text>
        </View>
        {attachPlan.events.state === "attached" ? attachedEventCard : null}
        {attachPlan.events.state === "list" ? (
          <View style={styles.groupList}>
            {eventCandidates.slice(0, attachPlan.events.visibleCount).map((event) => (
              <LinkedEventCard
                key={event.id}
                event={buildComposerEventRef(event)}
                cleanup={event}
                layout="list"
                selectable
                selected={false}
                onPress={() => attachEvent(event)}
              />
            ))}
            {attachPlan.events.showMoreVisible || attachPlan.events.showFewerVisible ? (
              <View style={styles.groupActions}>
                {attachPlan.events.showMoreVisible ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: eventsExpanded }}
                    onPress={onEventsShowMore}
                    hitSlop={{ left: 10, right: 10 }}
                    {...focusRingProps}
                    style={({ pressed }) => [listActionStyle, pressed ? styles.listActionPressed : null]}
                  >
                    <Text style={styles.listActionText}>{showMoreLabel(attachPlan.events.showMoreCount)}</Text>
                  </Pressable>
                ) : null}
                {attachPlan.events.showFewerVisible ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: eventsExpanded }}
                    onPress={onEventsShowFewer}
                    hitSlop={{ left: 10, right: 10 }}
                    {...focusRingProps}
                    style={({ pressed }) => [listActionStyle, pressed ? styles.listActionPressed : null]}
                  >
                    <Text style={styles.listActionText}>{t("section.show_fewer")}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      ) : null}

      {reportsSectionVisible ? (
      <View style={styles.group}>
        <View style={styles.groupHeader}>
          <Text accessibilityRole="header" {...headingLevel(2)} style={styles.groupTitle}>{t("section.reports")}</Text>
        </View>
        {attachPlan.reports.state === "attached" ? attachedReportCard : null}
        {attachPlan.reports.state === "list" ? (
          <View style={styles.groupList}>
            {reportCandidates.slice(0, attachPlan.reports.visibleCount).map((report) => (
              <LinkedReportCard
                key={report.id}
                report={report}
                layout="list"
                selectable
                selected={false}
                onPress={() => attachReport(report.id)}
              />
            ))}
            {attachPlan.reports.showMoreVisible || attachPlan.reports.showFewerVisible ? (
              <View style={styles.groupActions}>
                {attachPlan.reports.showMoreVisible ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: reportsExpanded, disabled: reports.isFetchingNextPage }}
                    disabled={reports.isFetchingNextPage}
                    onPress={onReportsShowMore}
                    hitSlop={{ left: 10, right: 10 }}
                    {...focusRingProps}
                    style={({ pressed }) => [listActionStyle, pressed ? styles.listActionPressed : null]}
                  >
                    <Text style={styles.listActionText}>{showMoreLabel(attachPlan.reports.showMoreCount)}</Text>
                  </Pressable>
                ) : null}
                {attachPlan.reports.showFewerVisible ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: reportsExpanded }}
                    onPress={onReportsShowFewer}
                    hitSlop={{ left: 10, right: 10 }}
                    {...focusRingProps}
                    style={({ pressed }) => [listActionStyle, pressed ? styles.listActionPressed : null]}
                  >
                    <Text style={styles.listActionText}>{t("section.show_fewer")}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      ) : null}
    </View>
  ) : null

  const attachedPreviews = attachPlan.variant === "pills" && (attachedEventCard || attachedReportCard) ? (
    <View style={styles.attachedStack}>
      {attachedEventCard}
      {attachedReportCard}
    </View>
  ) : null

  const panelBody = (kind: "events" | "reports") => {
    const group = kind === "events" ? attachPlan.events : attachPlan.reports
    return (
      <ScrollView style={styles.panel} nestedScrollEnabled contentContainerStyle={styles.pickerContent}>
        {group.state === "loading" ? <View style={styles.groupPlaceholder} /> : null}
        {group.state === "empty" ? (
          <Text style={styles.emptyPicker}>{kind === "events" ? t("empty_events") : t("empty_reports")}</Text>
        ) : null}
        {group.state === "list" && kind === "events"
          ? eventCandidates.map((event) => (
              <LinkedEventCard
                key={event.id}
                event={buildComposerEventRef(event)}
                cleanup={event}
                layout="list"
                selectable
                selected={event.id === draft.attachedEventId}
                onPress={() => attachEvent(event)}
              />
            ))
          : null}
        {group.state === "list" && kind === "reports" ? (
          <>
            {reportCandidates.map((report) => (
              <LinkedReportCard
                key={report.id}
                report={report}
                layout="list"
                selectable
                selected={report.id === draft.attachedReportId}
                onPress={() => attachReport(report.id)}
              />
            ))}
            {group.showMoreVisible ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: reports.isFetchingNextPage }}
                disabled={reports.isFetchingNextPage}
                onPress={() => { if (reports.hasNextPage && !reports.isFetchingNextPage) void reports.fetchNextPage() }}
                hitSlop={{ left: 10, right: 10 }}
                {...focusRingProps}
                style={({ pressed }) => [listActionStyle, pressed ? styles.listActionPressed : null]}
              >
                <Text style={styles.listActionText}>{t("section.show_more")}</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    )
  }

  const attachPanels = attachPlan.variant === "pills" ? (
    <>
      {attachPlan.eventPanelVisible ? panelBody("events") : null}
      {attachPlan.reportPanelVisible ? panelBody("reports") : null}
    </>
  ) : null

  const eventPill = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("pills.event_a11y")}
      accessibilityState={{ expanded: attachPlan.eventPanelVisible }}
      onPress={() => setAttachmentPanel((current) => togglePostComposerAttachmentPanel(current, "events"))}
      {...focusRingProps}
      style={({ pressed }) => [styles.pill, attachPlan.eventPanelVisible ? styles.pillOpen : null, pressed ? styles.listActionPressed : null]}
    >
      <Icon icon={iconMap.Calendar} size={16} color={th.colors.accent} />
      <Text style={styles.pillText}>{t("pills.event")}</Text>
    </Pressable>
  )
  const reportPill = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("pills.report_a11y")}
      accessibilityState={{ expanded: attachPlan.reportPanelVisible }}
      onPress={() => setAttachmentPanel((current) => togglePostComposerAttachmentPanel(current, "reports"))}
      {...focusRingProps}
      style={({ pressed }) => [styles.pill, attachPlan.reportPanelVisible ? styles.pillOpen : null, pressed ? styles.listActionPressed : null]}
    >
      <Icon icon={iconMap.MapPin} size={16} color={th.colors.accent} />
      <Text style={styles.pillText}>{t("pills.report")}</Text>
    </Pressable>
  )

  const replyPillsRow = attachPlan.variant === "pills" ? (
    <View style={styles.pillsRow}>
      {eventPill}
      {reportPill}
    </View>
  ) : null

  const attachAreaVisible =
    attachSections != null || attachedPreviews != null || replyPillsRow != null

  const fields = (
    <View style={styles.fields}>
      <View style={styles.authorRow}>
        {postAsOrganization ? (
          <Avatar
            name={postAsOrganization.name}
            seed={postAsOrganization.id}
            photoUrl={postAsOrganization.logoUrl ?? null}
            size={34}
            style={styles.authorOrgLogo}
          />
        ) : (
          <Avatar name={profile?.name ?? "You"} seed={profile?.id} photoUrl={profile?.avatarUrl} gradient={profile?.avatar ?? null} size={34} />
        )}
        <Text style={styles.authorName}>{postAsOrganization?.name ?? profile?.name ?? "You"}</Text>
      </View>

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

      {messageSection}
      {errorLines}

      {attachAreaVisible ? <View style={styles.attachDivider} /> : null}
      {attachedPreviews}
      {attachPanels}
      {attachSections}
      {replyPillsRow}
    </View>
  )

  return (
    <Animated.View style={[styles.root, entranceStyle]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("close_a11y")}
          onPress={closeComposer}
          {...focusRingProps}
          style={({ pressed }) => [styles.closeButton, pressed ? styles.buttonPressed : null]}
        >
          <Icon icon={iconMap.Close} size={17} color={th.colors.text} strokeWidth={2} />
        </Pressable>
        <View pointerEvents="none" style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{presentation.title}</Text>
        </View>
        <View style={styles.headerSpacer} />
        <Pressable
          accessibilityRole="button"
          onPress={submit}
          disabled={submitDisabled}
          {...focusRingProps}
          style={({ pressed }) => [styles.postButton, submitDisabled ? styles.postButtonDisabled : null, pressed ? styles.buttonPressed : null]}
        >
          <Text style={[styles.postButtonText, submitDisabled ? styles.postButtonTextDisabled : null]}>{create.isPending ? t("action.posting") : presentation.submitLabel}</Text>
        </Pressable>
      </View>
      <ComposerScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={keyboard.scrollView.keyboardDismissMode}
        contentInsetAdjustmentBehavior="automatic"
      >
        {fields}
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
  addMedia: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.surfaceTint, marginLeft: t.space["2"], marginTop: 6, marginBottom: 6 },
  addMediaDisabled: { opacity: 0.52 },
  postButton: { minHeight: 44, paddingHorizontal: 18, borderRadius: t.radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.accent, zIndex: 2 },
  postButtonDisabled: { backgroundColor: t.colors.surfaceTint },
  postButtonText: { color: t.colors.neutral.card, fontFamily: t.fontFamily.bodyExtraBold, fontSize: 14, lineHeight: 18 },
  postButtonTextDisabled: { color: t.colors.textSubtle },
  buttonPressed: { opacity: 0.78, transform: [{ scale: 0.94 }] },
  attachDivider: { height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border, marginTop: t.space["1"], marginBottom: t.space["1"] },
  attachArea: { gap: 18, marginTop: t.space["1"] },
  group: { gap: 9 },
  groupHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: t.space["2"] },
  groupTitle: { color: t.colors.text, fontFamily: t.fontFamily.displayBold, fontSize: 20, lineHeight: 25, letterSpacing: -0.35 },
  groupList: { gap: 9 },
  groupActions: { flexDirection: "row", alignItems: "center", gap: t.space["2"] },
  groupPlaceholder: { height: 72, borderRadius: 16, backgroundColor: t.colors.surfaceTint },
  listAction: { minHeight: 44, justifyContent: "center", paddingHorizontal: 10, borderRadius: t.radius.pill },
  listActionFlush: { paddingHorizontal: 0 },
  listActionPressed: { opacity: 0.55 },
  listActionText: { color: t.colors.accentText, fontFamily: t.fontFamily.bodyBold, fontSize: 13.5, lineHeight: 18 },
  attachedStack: { gap: 9 },
  panel: { maxHeight: 284 },
  pickerContent: { gap: 9, padding: 1 },
  pillsRow: { flexDirection: "row", alignItems: "center", gap: t.space["2"] },
  pill: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: t.radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border, backgroundColor: t.colors.neutral.card },
  pillOpen: { borderColor: t.colors.accent, backgroundColor: t.colors.surfaceTint },
  pillText: { color: t.colors.accentText, fontFamily: t.fontFamily.bodyBold, fontSize: 13, lineHeight: 18 },
  emptyPicker: { padding: 14, borderRadius: 16, backgroundColor: t.colors.surfaceTint, fontFamily: t.fontFamily.bodyMedium, fontSize: 13.5, lineHeight: 19, color: t.colors.textMuted },
  error: { color: t.colors.accentText, fontFamily: t.fontFamily.bodySemiBold },
}))
