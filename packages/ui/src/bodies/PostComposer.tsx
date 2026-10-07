import React, { useEffect, useMemo, useState } from "react"
import { Animated, Platform, View } from "react-native"
import type { PostDTO } from "@civfix/shared"
import type { MentionCandidate } from "../primitives"
import { useComposerAttachments } from "../primitives/useComposerAttachments"
import { Text } from "../typography"
import { useAuthState, useMyProfile } from "../data"
import { useT } from "../i18n"
import { usePost } from "../data/hooks/posts"
import { useNavStore } from "../nav"
import { makeKeyboardAwareScrollHost } from "../shell/KeyboardAwareScroll"
import { PLAIN_SCROLL_HOST, useScrollHost } from "../shell/ScrollHost"
import { AuthorAsChips } from "./AuthorAsChips"
import { useListTimeAgo } from "./useListTimeAgo"
import { useFeedScrollTopStore } from "./feed/feedScrollStore"
import { clearStaleReportIntentAtComposerMount } from "./composerCreateFlow"
import { activePostMentions, buildComposerQuoteRef, buildPostComposerModel, mergeMention } from "./postComposerModel"
import { keyboardDismissModeFor } from "./keyboardDismissMode"
import {
  POST_COMPOSER_MEDIA_CAP,
  carriedMediaIndex,
  mergePostComposerMedia,
  mergePostComposerThumbs,
  postComposerCanAttach,
  snapshotCarriedMedia,
} from "./postComposerMedia"
import {
  buildOptimisticPost,
  postSubmitDestination,
  resolvePostSubmit,
  toPostOrganizationRef,
} from "./postComposerSubmit"
import { trackPostComposerMount, type PostComposerExitHost } from "./postComposerExit"
import { usePostComposerAttach } from "./usePostComposerAttach"
import {
  selectPostComposerDraft,
  selectPostComposerDraftHidden,
  selectPostComposerDraftOwner,
  selectPostComposerHasPendingMedia,
  usePostComposerStore,
  type PostComposerMedia,
  type PostComposerMode,
} from "./postComposerStore"
import { AttachPills } from "./postComposer/AttachPills"
import { AttachSections } from "./postComposer/AttachSections"
import { ComposerAuthorRow } from "./postComposer/ComposerAuthorRow"
import { ComposerHeader } from "./postComposer/ComposerHeader"
import { ComposerMessageField } from "./postComposer/ComposerMessageField"
import { QuotedPreview } from "./postComposer/QuotedPreview"
import { usePostComposerStyles } from "./postComposer/postComposerStyles"
import { useEntranceAnimation } from "./useEntranceAnimation"
import { usePostAsOrganization } from "./postComposer/usePostAsOrganization"
import { useSubmitPost } from "./postComposer/useSubmitPost"

export interface PostComposerStandaloneHost {
  onBack: () => void
}

export interface PostComposerProps {
  mode?: PostComposerMode
  targetPostId?: string
  onPosted?: (post: PostDTO) => void
  standalone?: PostComposerStandaloneHost
}

const KEYBOARD_DISMISS_MODE = keyboardDismissModeFor(Platform.OS)

const COMPOSER_ENTRANCE = { from: { translateY: 36, scale: 0.99 }, duration: 280 }

const STANDALONE_SCROLL_HOST = makeKeyboardAwareScrollHost(PLAIN_SCROLL_HOST)

const EXIT_HOST: PostComposerExitHost = {
  readIntent: () => {
    const state = usePostComposerStore.getState()
    return { pendingCreate: state.draft.pendingCreate, claimedCreate: state.claimedCreate }
  },
  readStack: () => useNavStore.getState().stack,
  discard: () => usePostComposerStore.getState().discardAttachments(),
}

export function PostComposer(props: PostComposerProps) {
  const draftOwner = usePostComposerStore(selectPostComposerDraftOwner)
  return <PostComposerForOwner key={draftOwner ?? ""} {...props} />
}

function PostComposerForOwner({ mode = "post", targetPostId, onPosted, standalone }: PostComposerProps) {
  const styles = usePostComposerStyles()
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
  const entranceStyle = useEntranceAnimation(COMPOSER_ENTRANCE)
  const profile = useMyProfile().data?.profile
  const { isAuthenticated } = useAuthState()
  const { create, submit: submitPost } = useSubmitPost()
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
  const hasPendingMedia = usePostComposerStore(selectPostComposerHasPendingMedia)
  const attachments = useComposerAttachments(POST_COMPOSER_MEDIA_CAP)
  const [carriedSnapshot] = useState(() =>
    snapshotCarriedMedia(draft.media),
  )
  const [carriedMedia, setCarriedMedia] = useState<PostComposerMedia[]>(() => carriedSnapshot.carried)
  const [droppedMedia, setDroppedMedia] = useState(() => carriedSnapshot.dropped)

  useEffect(() => {
    setMode(mode)
    setReplyToPostId(mode === "reply" ? (targetPostId ?? null) : null)
    setQuotePostId(mode === "quote" ? (targetPostId ?? null) : null)
  }, [mode, setMode, setQuotePostId, setReplyToPostId, targetPostId])

  useEffect(clearStaleReportIntentAtComposerMount, [])

  useEffect(() => trackPostComposerMount(EXIT_HOST), [])

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

  const submit = () =>
    submitPost(
      () => {
        if (!profile || resolution.action !== "submit") return null
        const now = new Date()
        const linkedAt = now.toISOString()
        return {
          input: resolution.input,
          optimistic: buildOptimisticPost({
            author: profile,
            organization: postAsOrganization ? toPostOrganizationRef(postAsOrganization) : null,
            kind: resolution.input.kind,
            body: resolution.input.body ?? null,
            now,
            media: composerMedia,
            mentions: activeMentions,
            event: attachedEvent ? { ...attachedEvent, linkedAt } : null,
            report: attachedReport ? { ...attachedReport, linkedAt } : null,
            replyToId: resolution.input.replyToId ?? null,
            threadRootId: resolution.input.replyToId ?? null,
          }),
          resetTo: { mode, targetPostId: targetPostId ?? null },
        }
      },
      (post, input) => {
        attachments.reset()
        setCarriedMedia([])
        setDroppedMedia(0)
        attach.resetAttachUi()
        onPosted?.(post)
        if (onBack) onBack()
        else back()
        if (postSubmitDestination(input.kind) === "thread") push({ kind: "post-thread", id: post.id })
        else useFeedScrollTopStore.getState().requestScrollTop()
      },
    )

  const onMention = (candidate: MentionCandidate, nextDraft: string) => {
    setBody(nextDraft)
    const mentioned = mergeMention(draft.mentionedUsers, candidate)
    if (mentioned) setMentionedUsers(mentioned)
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
