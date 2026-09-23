import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type BlurEvent,
  type TextInput as RNTextInput,
  type ViewStyle,
} from "react-native"
import { TextInput } from "../../primitives/TextInput"
import type { PostDTO, UserMentionDTO } from "@civfix/shared"
import { tokens } from "@civfix/shared/tokens"
import { focusRingProps, makeThemedStyles, useTheme, webInputReset } from "../../theme"
import { Avatar, MentionAutocomplete } from "../../primitives"
import { useToast } from "../../primitives/Toast"
import type { MentionCandidate } from "../../primitives"
import { ComposerThumbs } from "../../primitives/ComposerThumbs"
import { useComposerAttachments } from "../../primitives/useComposerAttachments"
import { Icon, Text, iconMap } from "../../typography"
import { actableOrganizations, useMyOrganizations, useMyProfile } from "../../data"
import { useCreatePost } from "../../data/hooks/posts"
import { useT } from "../../i18n"
import { useHaptics } from "../../capabilities"
import { activePostMentions } from "../postComposerModel"
import {
  POST_COMPOSER_MEDIA_CAP,
  carriedMediaIndex,
  mergePostComposerMedia,
  mergePostComposerThumbs,
  postComposerCanAttach,
  snapshotCarriedMedia,
} from "../postComposerMedia"
import { resolvePostSubmit } from "../postComposerSubmit"
import {
  restoreFailedPostSubmit,
  selectPostComposerDraft,
  selectPostComposerDraftOwner,
  usePostComposerStore,
  type PostComposerMedia,
} from "../postComposerStore"
import { AuthorAsChips, authorAsSelection } from "../AuthorAsChips"
import { useNavStore } from "../../nav"
import {
  buildInlineComposerModel,
  composerEntryFor,
  inlineComposerClosesOnBlur,
  inlineComposerFocusWithin,
  inlineComposerOwnsDraft,
  type InlineComposerFocusHost,
} from "./inlineComposerModel"

const AVATAR_SIZE = 40
const MIN_TOUCH_TARGET = 44

export function InlineComposer() {
  const draftOwner = usePostComposerStore(selectPostComposerDraftOwner)
  return <InlineComposerForOwner key={draftOwner ?? ""} />
}

function InlineComposerForOwner() {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("post-composer")
  const haptics = useHaptics()
  const profile = useMyProfile().data?.profile
  const create = useCreatePost()
  const attachments = useComposerAttachments(POST_COMPOSER_MEDIA_CAP)
  const inputRef = useRef<RNTextInput>(null)
  const cardRef = useRef<View>(null)
  const submittingRef = useRef(false)
  const mountedRef = useRef(true)
  const toast = useToast()

  const body = usePostComposerStore((state) => selectPostComposerDraft(state).body)
  const mentionedUsers = usePostComposerStore((state) => selectPostComposerDraft(state).mentionedUsers)
  const setBody = usePostComposerStore((state) => state.setBody)
  const setMentionedUsers = usePostComposerStore((state) => state.setMentionedUsers)
  const setMedia = usePostComposerStore((state) => state.setMedia)
  const setOrganizationId = usePostComposerStore((state) => state.setOrganizationId)
  const draftOrganizationId = usePostComposerStore((state) => selectPostComposerDraft(state).organizationId)
  const ownsDraft = usePostComposerStore((state) => inlineComposerOwnsDraft(selectPostComposerDraft(state)))

  const myOrgs = useMyOrganizations()
  const actableOrgs = actableOrganizations(myOrgs.data)
  const postAsOrganizations = actableOrgs ?? []
  const postAsOrganizationId = authorAsSelection(draftOrganizationId, actableOrgs)
  const postAsOrganization =
    postAsOrganizations.find((org) => org.id === postAsOrganizationId) ?? null

  const [open, setOpen] = useState(false)
  const [bodyFocused, setBodyFocused] = useState(false)
  const [carriedMedia, setCarriedMedia] = useState<PostComposerMedia[]>([])
  const [droppedMedia, setDroppedMedia] = useState(0)
  const pressingOwnControlRef = useRef(false)
  const deferredBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const composerMedia = useMemo(
    () => mergePostComposerMedia(carriedMedia, attachments.attachments),
    [carriedMedia, attachments.attachments],
  )
  const composerThumbs = useMemo(
    () => mergePostComposerThumbs(carriedMedia, attachments.attachments),
    [carriedMedia, attachments.attachments],
  )

  useEffect(() => {
    if (!open) return
    setMedia(composerMedia)
  }, [open, composerMedia, setMedia])

  useEffect(() => {
    if (draftOrganizationId !== null && postAsOrganizationId === null) setOrganizationId(null)
  }, [draftOrganizationId, postAsOrganizationId, setOrganizationId])

  const canAttachMedia = postComposerCanAttach({
    hookCanAttach: attachments.canAttach,
    carried: carriedMedia.length,
    picked: attachments.attachments.length,
  })

  const mediaUploadIds = useMemo(
    () => composerMedia.flatMap((media) => (media.uploadId ? [media.uploadId] : [])),
    [composerMedia],
  )
  const activeMentions = useMemo(
    () => activePostMentions(body, mentionedUsers),
    [body, mentionedUsers],
  )
  const hasReadyMedia =
    composerMedia.length === 0 || mediaUploadIds.length === composerMedia.length
  const resolution = resolvePostSubmit(
    {
      body,
      mediaCount: composerMedia.length,
      mediaUploadIds,
      kind: "post",
      mentionedUserIds: activeMentions.map((user) => user.id),
      organizationId: postAsOrganizationId,
    },
    hasReadyMedia,
  )
  const model = buildInlineComposerModel(
    {
      open,
      hasAuthor: profile != null,
      sending: create.isPending,
      resolution: resolution.action,
    },
    t,
  )

  const openComposer = useCallback(() => {
    const draft = selectPostComposerDraft(usePostComposerStore.getState())
    if (!inlineComposerOwnsDraft(draft)) {
      useNavStore.getState().push({ kind: "composer", ...composerEntryFor(draft) })
      return
    }
    const snapshot = snapshotCarriedMedia(draft.media)
    setCarriedMedia(snapshot.carried)
    setDroppedMedia(snapshot.dropped)
    setOpen(true)
  }, [])

  const closeComposer = useCallback(() => {
    attachments.reset()
    setCarriedMedia([])
    setDroppedMedia(0)
    setBodyFocused(false)
    pressingOwnControlRef.current = false
    setOpen(false)
  }, [attachments])

  useEffect(() => {
    if (open && !ownsDraft) closeComposer()
  }, [open, ownsDraft, closeComposer])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (deferredBlurRef.current != null) clearTimeout(deferredBlurRef.current)
    }
  }, [])

  const onFocus = useCallback(() => {
    pressingOwnControlRef.current = false
    setBodyFocused(true)
  }, [])

  const holdOwnControl = useCallback(() => {
    pressingOwnControlRef.current = true
  }, [])

  const releaseOwnControl = useCallback(() => {
    pressingOwnControlRef.current = false
  }, [])

  const onBlur = useCallback(
    (event: BlurEvent) => {
      const pressingOwnControl = pressingOwnControlRef.current
      setBodyFocused(false)
      const settle = (next: unknown) => {
        const focusWithin = inlineComposerFocusWithin({
          card: cardRef.current as unknown as InlineComposerFocusHost | null,
          next,
          pressingOwnControl,
        })
        if (inlineComposerClosesOnBlur({ body, mediaCount: composerMedia.length, focusWithin }))
          closeComposer()
      }
      if (Platform.OS !== "web") {
        settle(null)
        return
      }
      const landed = (event?.nativeEvent as { relatedTarget?: unknown } | undefined)?.relatedTarget
      if (landed != null) {
        settle(landed)
        return
      }
      if (deferredBlurRef.current != null) clearTimeout(deferredBlurRef.current)
      deferredBlurRef.current = setTimeout(() => {
        deferredBlurRef.current = null
        settle(typeof document === "undefined" ? null : document.activeElement)
      }, 0)
    },
    [body, closeComposer, composerMedia.length],
  )

  const removeMedia = useCallback(
    (id: string) => {
      const index = carriedMediaIndex(id)
      if (index != null) {
        setCarriedMedia((current) => current.filter((_, at) => at !== index))
        return
      }
      attachments.removeAttachment(id)
    },
    [attachments],
  )

  const onMention = useCallback(
    (candidate: MentionCandidate, nextDraft: string) => {
      setBody(nextDraft)
      if ((candidate as { kind?: string }).kind === "jurisdiction") return
      const user: UserMentionDTO = {
        id: candidate.id,
        handle: candidate.handle,
        displayName: candidate.displayName,
      }
      setMentionedUsers([...mentionedUsers.filter((item) => item.id !== user.id), user])
    },
    [mentionedUsers, setBody, setMentionedUsers],
  )

  const submit = useCallback(() => {
    if (submittingRef.current) return
    if (!open || !ownsDraft) return
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
      media: composerMedia.flatMap((item) =>
        item.uploadId
          ? [
              {
                id: item.uploadId,
                kind: item.kind,
                url: item.uri,
                thumbUrl: item.posterUri,
                status: "ready" as const,
              },
            ]
          : [],
      ),
      mentions: activeMentions,
      event: null,
      report: null,
      repostOf: null,
      replyToId: null,
      threadRootId: null,
    }
    const staged = selectPostComposerDraft(usePostComposerStore.getState())
    usePostComposerStore.getState().reset({ mode: "post", targetPostId: null })
    create
      .mutateAsync(
        { input: resolution.input, optimistic },
        {
          onSuccess: () => {
            haptics.success()
            attachments.reset()
            setCarriedMedia([])
            setDroppedMedia(0)
            setOpen(false)
          },
          onSettled: () => {
            submittingRef.current = false
          },
        },
      )
      .catch(() => {
        haptics.error()
        const restored = restoreFailedPostSubmit(staged)
        if (!mountedRef.current) {
          toast.show(t(restored ? "submit_error_restored" : "submit_error"), { variant: "error" })
        }
      })
  }, [
    activeMentions,
    attachments,
    composerMedia,
    create,
    haptics,
    open,
    ownsDraft,
    postAsOrganization,
    profile,
    resolution,
    t,
    toast,
  ])

  if (!profile) return null

  const avatar = (
    <Avatar
      name={profile.name}
      seed={profile.id}
      photoUrl={profile.avatarUrl}
      gradient={profile.avatar ?? null}
      size={AVATAR_SIZE}
    />
  )

  const postButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={model.submitLabel}
      accessibilityState={{ disabled: model.submitDisabled }}
      disabled={model.submitDisabled}
      onPress={submit}
      {...focusRingProps}
      style={({ pressed }) => [
        styles.postButton,
        model.submitDisabled ? styles.postButtonDisabled : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text
        style={[styles.postButtonText, model.submitDisabled ? styles.postButtonTextDisabled : null]}
      >
        {model.submitLabel}
      </Text>
    </Pressable>
  )

  if (model.state === "collapsed") {
    return (
      <View style={styles.card}>
        {avatar}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("input_a11y")}
          onPress={openComposer}
          {...focusRingProps}
          style={({ pressed }) => [styles.placeholder, pressed ? styles.pressed : null]}
        >
          <Text style={styles.placeholderText} numberOfLines={1}>
            {model.placeholder}
          </Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View ref={cardRef} style={styles.card}>
      {avatar}
      <View style={styles.column}>
        <View style={[styles.inputSurface, bodyFocused ? styles.inputSurfaceFocused : null]}>
          <TextInput
            ref={inputRef}
            accessibilityLabel={t("input_a11y")}
            value={body}
            onChangeText={setBody}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={model.placeholder}
            placeholderTextColor={th.colors.textSubtle}
            multiline
            maxLength={2000}
            autoFocus
            style={[webInputReset, styles.input]}
          />
          <MentionAutocomplete draft={body} onSelect={onMention} />
          <ComposerThumbs
            attachments={composerThumbs}
            onRemove={removeMedia}
            style={styles.thumbs}
          />
        </View>
        {attachments.attachError ? (
          <Text style={styles.error}>{attachments.attachError}</Text>
        ) : null}
        {postAsOrganizations.length > 0 ? (
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
        ) : null}
        {droppedMedia > 0 ? <Text style={styles.error}>{t("media_dropped")}</Text> : null}
        {create.isError ? <Text style={styles.error}>{t("submit_error")}</Text> : null}
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("add_media_a11y")}
            accessibilityState={{ disabled: !canAttachMedia }}
            disabled={!canAttachMedia}
            onPressIn={holdOwnControl}
            onPressOut={releaseOwnControl}
            onPress={() => void attachments.onAttach()}
            hitSlop={6}
            {...focusRingProps}
            style={({ pressed }) => [
              styles.addMedia,
              !canAttachMedia ? styles.addMediaDisabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <View style={styles.addMediaDisc}>
              <Icon
                icon={iconMap.Image}
                size={18}
                color={canAttachMedia ? th.colors.accent : th.colors.textSubtle}
                strokeWidth={2.2}
              />
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("close_a11y")}
            onPress={closeComposer}
            hitSlop={6}
            {...focusRingProps}
            style={({ pressed }) => [styles.close, pressed ? styles.pressed : null]}
          >
            <Icon icon={iconMap.Close} size={16} color={th.colors.textMuted} strokeWidth={2} />
          </Pressable>
          <View style={styles.actionsSpacer} />
          {postButton}
        </View>
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: t.space["3"],
    backgroundColor: t.colors.neutral.card,
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["3"],
    marginBottom: t.space["3"],
  },
  column: { flex: 1, minWidth: 0, gap: t.space["2"] },
  placeholder: {
    flex: 1,
    minWidth: 0,
    minHeight: AVATAR_SIZE,
    justifyContent: "center",
  },
  placeholderText: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 14.5,
    lineHeight: 21,
    color: t.colors.textSubtle,
  },
  inputSurface: {
    borderRadius: 18,
    backgroundColor: t.colors.surfaceTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    paddingHorizontal: t.space["2"],
    paddingVertical: t.space["1"],
  },
  inputSurfaceFocused:
    Platform.OS === "web"
      ? ({ boxShadow: tokens.shadow.ring, borderColor: t.colors.accent } as ViewStyle)
      : { borderColor: t.colors.accent },
  input: {
    minHeight: 72,
    maxHeight: 220,
    padding: t.space["2"],
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 14.5,
    lineHeight: 21,
    color: t.colors.text,
    textAlignVertical: "top",
  },
  thumbs: { marginHorizontal: t.space["2"], marginBottom: t.space["1"] },
  actions: { flexDirection: "row", alignItems: "center", gap: t.space["2"] },
  actionsSpacer: { flex: 1 },
  addMedia: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  addMediaDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.surfaceTint,
  },
  addMediaDisabled: { opacity: 0.52 },
  close: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  postButton: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 16,
    borderRadius: t.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.accent,
  },
  postButtonDisabled: { backgroundColor: t.colors.surfaceTint },
  postButtonText: {
    color: t.colors.neutral.card,
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 14,
    lineHeight: 18,
  },
  postButtonTextDisabled: { color: t.colors.textSubtle },
  error: {
    color: t.colors.accentText,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12.5,
  },
  pressed: { opacity: 0.82 },
}))
