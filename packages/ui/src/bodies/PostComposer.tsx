import React, { useEffect, useMemo, useRef, useState } from "react"
import { Animated, Platform, View } from "react-native"
import type { PostDTO, UserMentionDTO } from "@civfix/shared"
import { useToast } from "../primitives/Toast"
import type { MentionCandidate } from "../primitives"
import { useComposerAttachments } from "../primitives/useComposerAttachments"
import { Text } from "../typography"
import { useAuthState, useMyProfile } from "../data"
import { useT } from "../i18n"
import { useHaptics } from "../capabilities"
import { useCreatePost, usePost } from "../data/hooks/posts"
import { useNavStore } from "../nav"
import { makeKeyboardAwareScrollHost } from "../shell/KeyboardAwareScroll"
import { PLAIN_SCROLL_HOST, useScrollHost } from "../shell/ScrollHost"
import { AuthorAsChips } from "./AuthorAsChips"
import { useListTimeAgo } from "./useListTimeAgo"
import { useFeedScrollTopStore } from "./feed/feedScrollStore"
import { optimisticPostId } from "./thread/threadModel"
import { clearStaleReportIntentAtComposerMount } from "./composerCreateFlow"
import { activePostMentions, buildComposerQuoteRef, buildPostComposerModel } from "./postComposerModel"
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
import { usePostComposerAttach } from "./usePostComposerAttach"
import {
  restoreFailedPostSubmit,
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
import { useComposerEntrance } from "./postComposer/useComposerEntrance"
import { usePostAsOrganization } from "./postComposer/usePostAsOrganization"

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
