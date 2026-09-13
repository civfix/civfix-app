/**
 * ReplyComposer - the thread's docked reply bar, and the reason `PostComposer`'s whole `compact` branch
 * could be DELETED rather than patched.
 *
 * WHAT IT FIXES (all measured on the device, not theorized):
 *  1. THE REPORTED BUG. With the keyboard up, the composer row, the attach pills and the Reply button were
 *     all behind it. `useReplyDockInset()` lifts the surface by exactly the keyboard overlap, once, on
 *     iOS / Android / mobile web - see that file for why it cannot double-apply.
 *  2. THE UNBOUNDED FIELD. `inputCompact` had `minHeight: 86` and NO `maxHeight`, so a long reply pushed
 *     everything below it off-screen. The field is capped by `buildReplyComposerHeightPlan` and scrolls
 *     internally past that.
 *  3. THE WRAPPING TOOLS ROW. `tools` was `flexWrap: "wrap"` over five variable-width controls. The tools
 *     row here holds exactly two fixed-width controls plus a flex spacer and CANNOT wrap at any width in
 *     any locale (375 - 24 padding - 36 circle - 16 gap - ~86 for German "Antworten" still leaves 213pt).
 *  4. THE 284pt INLINE PANEL. Attaching moved into `ReplyAttachSheet`, a modal, costing the bar 0pt.
 *  5. THE IN-FLOW MENTION TRAY. It is absolutely positioned at `bottom: "100%"` and contributes nothing to
 *     layout, so typing "@" no longer inflates the bar.
 *
 * THREE INDEPENDENT LAYERS keep the Reply pill on screen, and none of them depends on a constant being
 * right: (a) the chrome around the field is MEASURED by two `onLayout` probes, so `REPLY_CHROME_FALLBACK`
 * only ever covers the first frame; (b) `maxHeight: plan.surfaceMax` hard-caps the whole surface against
 * the screen; (c) `flexShrink: 1` is set on the FIELD ROW AND THE INPUT ONLY - every other child is
 * `flexShrink: 0` - so RN flex shrinks the field first and the tools row is structurally the last thing
 * to give. `overflow: "hidden"` is deliberately NOT set: with correct flexShrink it is unnecessary, and
 * it is exactly what would silently clip.
 *
 * ONE PERSISTENT TextInput. Collapsed vs expanded is a STYLE difference, never a different tree: a
 * tap-a-pill-then-`ref.focus()` handoff races the keyboard on RN, and a programmatic `focus()` outside a
 * real user gesture does not raise the keyboard at all on iOS Safari - the collapsed bar would become
 * permanently untappable on mobile web.
 */
import React from "react"
import {
  AccessibilityInfo,
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type TextStyle,
  type View as NativeView,
} from "react-native"
import { TextInput } from "../../primitives/TextInput"
import { useQueryClient } from "@tanstack/react-query"
import type { CleanupDTO, LinkedEventRef, PostDTO, ReportDTO, UserMentionDTO } from "@civfix/shared"
import { tokens } from "@civfix/shared/tokens"
import { focusRingProps, makeThemedStyles, wash, useLayoutMode, useTheme, webInputReset } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { Avatar } from "../../primitives/Avatar"
import { ComposerModeBar } from "../../primitives/ComposerModeBar"
import { ComposerThumbs } from "../../primitives/ComposerThumbs"
import { MentionAutocomplete, type MentionCandidate } from "../../primitives/MentionAutocomplete"
import { isComposerCancelKey, isComposerSendKey } from "../../primitives/composerKeyPress"
import { useAutoGrowInput } from "../../primitives/useAutoGrowInput"
import { useComposerAttachments } from "../../primitives/useComposerAttachments"
import type { AnchorRect } from "../../primitives/PopoverMenu"
import { queryKeys, useAuthState, useMyProfile, useReport, useRequireAuth } from "../../data"
import { personFromAuthUser } from "../feedShare"
import { useCreatePost } from "../../data/hooks/posts"
import { useT } from "../../i18n"
import { pathForEntry } from "../../nav"
import { activePostMentions } from "../postComposerModel"
import {
  POST_COMPOSER_MEDIA_CAP,
  carriedMediaIndex,
  mergePostComposerMedia,
  mergePostComposerThumbs,
} from "../postComposerMedia"
import { resolvePostSubmit } from "../postComposerSubmit"
import type { PostComposerMedia } from "../postComposerStore"
import { ComposerAttachChip } from "./ComposerAttachChip"
import { ReplyAttachSheet } from "./ReplyAttachSheet"
import { useReplyDockInset } from "./useReplyDockInset"
import { useReplyDraftStore, EMPTY_REPLY_DRAFT } from "./replyDraftStore"
import {
  REPLY_INPUT_MIN,
  buildReplyComposerHeightPlan,
  composerFocusAfterSend,
  replyComposerState,
  threadFocalExcerpt,
} from "./threadModel"

/** The surface's own vertical padding (8 top + 8 bottom) - part of `measuredChrome`. */
const SURFACE_PADDING = 16
/** The two 6pt gaps between the three measured/flexing blocks - the rest of `measuredChrome`. */
const SURFACE_GAPS = 12
/** The shared `PostComposeInputSchema` cap; the counter appears in the last 200 and reddens in the last 50. */
const BODY_MAX = 2000
const COUNTER_VISIBLE_AT = 200
const COUNTER_URGENT_AT = 50
const REPLY_FOCUS_AFTER_SEND = composerFocusAfterSend("thread-reply")

export interface ReplyComposerHandle {
  /** Focus the field (the focal post's comment glyph calls this instead of re-pushing the screen). */
  focus: () => void
}

export interface ReplyComposerProps {
  /**
   * The thread's focal post - the ONLY thing this composer replies to. Replying to a reply means opening
   * that reply's own thread, where it becomes the focal post. Also the permalink the signed-out pill
   * returns to after auth.
   */
  focalPost: PostDTO
  /** The live height of the thread body root, from its `onLayout`. Drives every cap. */
  rootHeight: number
  /**
   * The SERVER-returned reply, for the screen's local `sentReplies` tail.
   */
  onPosted?: (post: PostDTO) => void
}

/** One process-level reduced-motion read for this screen's single composer (not a per-row subscription). */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false)
  React.useEffect(() => {
    let mounted = true
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value)
      })
      .catch(() => undefined)
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced)
    return () => {
      mounted = false
      sub.remove()
    }
  }, [])
  return reduced
}

export const ReplyComposer = React.forwardRef<ReplyComposerHandle, ReplyComposerProps>(
  function ReplyComposer({ focalPost, rootHeight, onPosted }, ref) {
    const styles = useStyles()
    const th = useTheme()
    const { t } = useT("post-composer")
    const { t: tFeed } = useT("home-feed")
    const requireAuth = useRequireAuth()
    // The optimistic reply's author. NOT `useMyProfile()` alone: it is declared `retry: false`, so one
    // transient failure would leave `profile` undefined for the session - the composer would expand and
    // accept text while the Reply pill stayed permanently grey and `send()` returned early, with no copy
    // anywhere saying why. The auth store is populated whenever `isAuthenticated` is, and the server's
    // response carries the authoritative author, so the projection only ever fills a gap.
    const { isAuthenticated, user } = useAuthState()
    const profile =
      useMyProfile().data?.profile ?? (user ? personFromAuthUser(user) : undefined)
    const create = useCreatePost()
    const dock = useReplyDockInset()
    const reducedMotion = useReducedMotion()

    const targetId = focalPost.id
    const draft = useReplyDraftStore((state) => state.drafts[targetId]) ?? EMPTY_REPLY_DRAFT
    const setBody = useReplyDraftStore((state) => state.setBody)
    const setMentionedUsers = useReplyDraftStore((state) => state.setMentionedUsers)
    const setDraftMedia = useReplyDraftStore((state) => state.setMedia)
    const setAttachedEvent = useReplyDraftStore((state) => state.setAttachedEvent)
    const setAttachedReportId = useReplyDraftStore((state) => state.setAttachedReportId)
    const clearDraft = useReplyDraftStore((state) => state.clearDraft)
    const queryClient = useQueryClient()

    const [focused, setFocused] = React.useState(false)
    /**
     * Does this composer sit in the landscape CARD? Three round-1 polish fixes hang off it (DS-05 focus
     * ring, DS-06 one left column, DS-14 even inset + a visible hairline), all held to expanded because
     * the identical bar ships in the portrait thread, which is pinned to its redesign baseline.
     */
    const inCard = useLayoutMode() === "expanded"
    const [attachOpen, setAttachOpen] = React.useState(false)
    const [attachAnchor, setAttachAnchor] = React.useState<AnchorRect | null>(null)
    const [chromeTop, setChromeTop] = React.useState<number | null>(null)
    const [chromeBottom, setChromeBottom] = React.useState<number | null>(null)
    const plusRef = React.useRef<NativeView | null>(null)
    /** Set SYNCHRONOUSLY at the top of `send`: React state is async and a fast double-tap outruns it. */
    const submittingRef = React.useRef(false)

    const attachments = useComposerAttachments(POST_COMPOSER_MEDIA_CAP)
    /**
     * The media the draft arrived with. `useComposerAttachments` is component-local and restarts empty on
     * every mount, so without this a reply you left and came back to would lose its (already finalized,
     * still submittable) attachments. The store only ever holds `ready` items, so unlike the full-screen
     * composer there is no "dropped, add them again" case to report.
     */
    const [carried, setCarried] = React.useState<PostComposerMedia[]>(
      () => useReplyDraftStore.getState().get(targetId).media,
    )
    /**
     * The chosen report's ROW - the chip's title AND the optimistic reply's linked-report card (which is
     * why it is the full DTO: `LinkedReportCardData` carries no lat/lng). DERIVED from
     * `draft.attachedReportId` via the shared report-detail cache, not mirrored component state, so there
     * is nothing here to go stale. `onSelectReport` primes this exact cache
     * entry with the full row it already has in hand, so attaching still shows the real title immediately
     * instead of a flash of the generic label while a redundant fetch resolves.
     */
    const attachedReportQuery = useReport(draft.attachedReportId ?? undefined)
    const attachedReport = attachedReportQuery.data ?? null

    const media = React.useMemo(
      () => mergePostComposerMedia(carried, attachments.attachments),
      [carried, attachments.attachments],
    )
    const thumbs = React.useMemo(
      () => mergePostComposerThumbs(carried, attachments.attachments),
      [carried, attachments.attachments],
    )
    const readyMedia = React.useMemo(() => media.filter((item) => item.status === "ready"), [media])
    const readyKey = readyMedia.map((item) => item.uploadId ?? item.uri).join("|")
    const draftMediaKey = draft.media.map((item) => item.uploadId ?? item.uri).join("|")
    // Mirror only the FINALIZED media into the draft, and only when it actually changed, so a write does
    // not bump `updatedAt` (and therefore the eviction order) on every render.
    React.useEffect(() => {
      if (readyKey !== draftMediaKey) setDraftMedia(targetId, readyMedia)
    }, [readyKey, draftMediaKey, readyMedia, setDraftMedia, targetId])

    const hasAttachments =
      media.length > 0 || draft.attachedEventId != null || draft.attachedReportId != null
    const state = replyComposerState({
      focused,
      hasDraft: draft.body.trim().length > 0,
      hasAttachments,
      signedIn: isAuthenticated,
      hasError: create.isError,
    })
    const expanded = state === "expanded"

    const measuredChrome =
      chromeTop != null && chromeBottom != null
        ? chromeTop + chromeBottom + SURFACE_PADDING + SURFACE_GAPS
        : null
    const plan = buildReplyComposerHeightPlan({
      rootHeight,
      keyboardInset: dock.inset,
      expanded,
      hasThumbs: thumbs.length > 0,
      measuredChrome,
    })
    const grow = useAutoGrowInput(draft.body, REPLY_INPUT_MIN, plan.inputMax)

    React.useImperativeHandle(ref, () => ({ focus: () => grow.ref.current?.focus() }), [grow.ref])

    // Soften the collapse<->expand swap. iOS only, matching the codebase's existing rule (Android
    // LayoutAnimation is documented as flaky), and never under reduced motion. The KEYBOARD inset is
    // deliberately NOT animated - see useReplyDockInset.
    const prevExpanded = React.useRef(expanded)
    React.useEffect(() => {
      if (prevExpanded.current === expanded) return
      prevExpanded.current = expanded
      if (Platform.OS === "ios" && !reducedMotion) {
        LayoutAnimation.configureNext({ ...LayoutAnimation.Presets.easeInEaseOut, duration: 180 })
      }
    }, [expanded, reducedMotion])

    const onChromeTop = (event: LayoutChangeEvent) => setChromeTop(event.nativeEvent.layout.height)
    const onChromeBottom = (event: LayoutChangeEvent) => setChromeBottom(event.nativeEvent.layout.height)

    const activeMentions = React.useMemo(
      () => activePostMentions(draft.body, draft.mentionedUsers),
      [draft.body, draft.mentionedUsers],
    )
    const mediaUploadIds = readyMedia.flatMap((item) => (item.uploadId ? [item.uploadId] : []))
    const hasReadyMedia = media.length === 0 || mediaUploadIds.length === media.length
    const resolution = resolvePostSubmit(
      {
        body: draft.body,
        eventId: draft.attachedEventId,
        reportId: draft.attachedReportId,
        mediaCount: media.length,
        mediaUploadIds,
        kind: "reply",
        replyToId: targetId,
        mentionedUserIds: activeMentions.map((user) => user.id),
      },
      hasReadyMedia,
    )
    const submitDisabled = !profile || resolution.action !== "submit" || create.isPending

    const onMention = (candidate: MentionCandidate, nextDraft: string) => {
      setBody(targetId, nextDraft)
      if ((candidate as { kind?: string }).kind === "jurisdiction") return
      const user: UserMentionDTO = {
        id: candidate.id,
        handle: candidate.handle,
        displayName: candidate.displayName,
      }
      setMentionedUsers(targetId, [
        ...draft.mentionedUsers.filter((item) => item.id !== user.id),
        user,
      ])
    }

    const removeMedia = (id: string) => {
      // Carried thumbs are keyed by POSITION: the same asset picked twice shares a uri, and filtering on
      // it used to delete both copies at once.
      const index = carriedMediaIndex(id)
      if (index != null) {
        setCarried((current) => current.filter((_item, at) => at !== index))
        return
      }
      attachments.removeAttachment(id)
    }

    const send = () => {
      if (submittingRef.current) return
      if (!profile || resolution.action !== "submit") return
      submittingRef.current = true
      const optimistic: PostDTO = {
        id: `optimistic-${Date.now()}`,
        author: profile,
        kind: "reply",
        body: resolution.input.body ?? null,
        createdAt: new Date().toISOString(),
        editedAt: null,
        counts: { likes: 0, reposts: 0, replies: 0, saves: 0 },
        viewer: { liked: false, reposted: false, saved: false },
        media: readyMedia.flatMap((item) =>
          item.uploadId
            ? [{
                id: item.uploadId,
                kind: item.kind,
                url: item.uri,
                thumbUrl: item.posterUri,
                status: "ready" as const,
              }]
            : [],
        ),
        mentions: activeMentions,
        event: draft.attachedEvent
          ? { ...draft.attachedEvent, linkedAt: new Date().toISOString() }
          : null,
        // Built from the picked ROW, exactly as `event` is built from `draft.attachedEvent`. Leaving it
        // null made an attachment-only reply render as an essentially EMPTY row for the length of the
        // request, and then pop its card in (shifting the list) when the server DTO replaced it.
        // `attachedReport` is fetched BY `draft.attachedReportId` (see the hook above it is derived
        // from), so the id check is a defensive no-op once the query resolves - it just covers the one
        // render right after a re-aim where the new id's data has not landed yet.
        report:
          attachedReport && attachedReport.id === draft.attachedReportId
            ? {
                id: attachedReport.id,
                category: attachedReport.category,
                ...(attachedReport.type ? { type: attachedReport.type } : {}),
                // Matches the server's own projection (`r.title ?? "Report"`).
                title: attachedReport.title?.trim() || "Report",
                status: attachedReport.status,
                lat: attachedReport.lat,
                lng: attachedReport.lng,
                addr: attachedReport.addr ?? null,
                thumbUrl: null,
                linkedAt: new Date().toISOString(),
              }
            : null,
        repostOf: null,
        replyToId: targetId,
        // The server derives `parent.thread_root_id ?? parent.id`. Setting BOTH to the parent id (what the
        // old composer did) is only correct at depth 1 - and drilling into a reply now makes depth 2 real.
        threadRootId: focalPost.threadRootId ?? focalPost.id,
      }
      create.mutate(
        { input: resolution.input, optimistic },
        {
          onSuccess: (post) => {
            clearDraft(targetId)
            attachments.reset()
            setCarried([])
            setAttachOpen(false)
            onPosted?.(post)
            if (REPLY_FOCUS_AFTER_SEND === "release") {
              grow.ref.current?.blur()
              Keyboard.dismiss()
            }
          },
          onSettled: () => {
            submittingRef.current = false
          },
        },
      )
    }

    const onKeyPress = (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (Platform.OS !== "web") return
      if (isComposerSendKey(event)) {
        if (!submitDisabled) send()
        return
      }
      if (isComposerCancelKey(event)) grow.ref.current?.blur()
    }

    const openAttachSheet = () => {
      const trigger = plusRef.current
      if (trigger && typeof trigger.measureInWindow === "function") {
        trigger.measureInWindow((x, y, width, height) => {
          setAttachAnchor({ x, y, width, height })
          setAttachOpen(true)
        })
        return
      }
      setAttachAnchor(null)
      setAttachOpen(true)
    }

    const canAttachMedia = attachments.canAttach && media.length < POST_COMPOSER_MEDIA_CAP
    const canAttachAnything = canAttachMedia || draft.attachedEventId == null || draft.attachedReportId == null

    // ---- SIGNED OUT: the whole surface is one sign-in pill. Both thread queries are auth-gated, so a
    // signed-out reader would otherwise get a permanently disabled grey Reply button on a dead screen.
    if (state === "signed-out") {
      return (
        <View style={[styles.surface, { paddingBottom: th.space["2"] + dock.restPad }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              requireAuth(() => undefined, { next: pathForEntry({ kind: "post-thread", id: focalPost.id }) })
            }
            {...focusRingProps}
            style={({ pressed }) => [styles.signInPill, pressed ? styles.pressed : null]}
          >
            <Text style={styles.signInLabel}>{t("reply.signed_out")}</Text>
          </Pressable>
        </View>
      )
    }

    const remaining = BODY_MAX - draft.body.length
    const targetHandle = focalPost.author.handle?.replace(/^@/, "") ?? null
    const replyingTo = targetHandle
      ? t("reply.context", { handle: `@${targetHandle}` })
      : t("reply.context", { handle: focalPost.author.name })

    return (
      <View style={styles.root}>
        <View
          style={[
            styles.surface,
            // DS-14, EXPANDED: the bar's own hairline is `colors.border` on the card's SAND fill, a
            // one-unit-per-channel difference, so the last reply butted straight into the field with
            // nothing marking the boundary; §6's on-sand rule is `borderStrong` lightened to 0.45.
            inCard ? styles.surfaceInCard : null,
            {
              // DS-14, EXPANDED: 12 all round. The field measured 12px to the card's right edge but only
              // 8 to its bottom, so the composer sat visibly lower in its own gutter than beside it.
              // `dock.restPad` (0 on a pointer surface) still rides on top wherever a dock overlaps.
              paddingBottom: (inCard ? th.space["3"] : th.space["2"]) + dock.restPad,
              maxHeight: plan.surfaceMax,
              marginBottom: dock.inset,
            },
          ]}
        >
          {/* ABSOLUTE, at bottom:"100%" - the tray floats OVER the reply list and contributes exactly 0
              to the surface's height, so typing "@" never moves the field or the Reply pill. */}
          {expanded ? (
            <MentionAutocomplete
              draft={draft.body}
              onSelect={onMention}
              maxHeight={plan.trayMax}
              style={styles.tray}
            />
          ) : null}

          {expanded ? (
            <View onLayout={onChromeTop} style={[styles.chrome, inCard ? styles.chromeInCard : null]}>
              <ComposerModeBar
                mode="reply"
                title={replyingTo}
                excerpt={threadFocalExcerpt(focalPost, tFeed)}
                accentColor={th.colors.accent}
                onCancel={() => grow.ref.current?.blur()}
              />
            </View>
          ) : null}

          <View style={styles.fieldRow}>
            <Avatar
              name={profile?.name ?? "You"}
              seed={profile?.id}
              photoUrl={profile?.avatarUrl}
              gradient={profile?.avatar ?? null}
              size={28}
              decorative
              style={expanded ? styles.fieldAvatarExpanded : undefined}
            />
            <TextInput
              ref={grow.ref}
              accessibilityLabel={t("input_a11y")}
              value={draft.body}
              onChangeText={(text) => setBody(targetId, text)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={t("reply.placeholder_named")}
              placeholderTextColor={th.colors.textSubtle}
              multiline
              maxLength={BODY_MAX}
              blurOnSubmit={false}
              onContentSizeChange={grow.onContentSizeChange}
              onKeyPress={onKeyPress}
              style={[
                // DS-05: `webInputReset` FIRST (so `styles.input`'s own border/colour still win) - it is
                // what strips the browser's default blue `outline`, which was painting a saturated
                // ~#0B57D0 ring on the sand card. `inputFocused` then draws the house coral treatment.
                // Driven by the field's own focus state, not `focusRingProps`: a text field must show
                // focus for POINTER focus too, which `:focus-visible` deliberately withholds.
                inCard ? webInputReset : null,
                styles.input,
                { maxHeight: plan.inputMax, height: expanded ? grow.height : 36 },
                inCard && focused ? styles.inputFocused : null,
              ]}
            />
          </View>

          {expanded ? (
            <View
              onLayout={onChromeBottom}
              style={[styles.chromeBottom, inCard ? styles.chromeInCard : null]}
            >
              {thumbs.length > 0 ? (
                <ComposerThumbs attachments={thumbs} onRemove={removeMedia} singleRow />
              ) : null}
              {draft.attachedEvent ? (
                <ComposerAttachChip
                  kind="event"
                  title={draft.attachedEvent.title}
                  onRemove={() => setAttachedEvent(targetId, null)}
                />
              ) : null}
              {draft.attachedReportId ? (
                <ComposerAttachChip
                  kind="report"
                  title={attachedReport?.title?.trim() || t("attach.report")}
                  onRemove={() => setAttachedReportId(targetId, null)}
                />
              ) : null}
              {attachments.attachError ? (
                <Text style={styles.error}>{attachments.attachError}</Text>
              ) : null}
              {create.isError ? <Text style={styles.error}>{t("submit_error")}</Text> : null}

              {/* NO flexWrap. Two fixed-width controls + a flex spacer cannot wrap at any width in any
                  locale - which structurally kills the old bar's 2-and-3-line wrapping bug. */}
              <View style={styles.toolsRow}>
                <Pressable
                  ref={plusRef}
                  accessibilityRole="button"
                  accessibilityLabel={t("reply.attach_a11y")}
                  accessibilityState={{ disabled: !canAttachAnything }}
                  disabled={!canAttachAnything}
                  onPress={openAttachSheet}
                  hitSlop={6}
                  {...focusRingProps}
                  style={({ pressed }) => [
                    styles.plus,
                    !canAttachAnything ? styles.plusDisabled : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Icon
                    icon={iconMap.Plus}
                    size={20}
                    color={canAttachAnything ? th.colors.accent : th.colors.textSubtle}
                    strokeWidth={2.2}
                  />
                </Pressable>
                <View style={styles.toolsSpacer} />
                {remaining <= COUNTER_VISIBLE_AT ? (
                  <Text
                    style={[
                      styles.counter,
                      remaining <= COUNTER_URGENT_AT ? styles.counterUrgent : null,
                    ]}
                  >
                    {t("reply.chars_left", { count: remaining })}
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={send}
                  disabled={submitDisabled}
                  {...focusRingProps}
                  style={({ pressed }) => [
                    styles.replyPill,
                    submitDisabled ? styles.replyPillDisabled : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text
                    style={[styles.replyLabel, submitDisabled ? styles.replyLabelDisabled : null]}
                  >
                    {create.isPending ? t("action.posting") : t("action.reply")}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        {/* Mounted only while open: its two candidate queries must not fire for every thread you read. */}
        {attachOpen ? (
          <ReplyAttachSheet
            visible={attachOpen}
            onClose={() => setAttachOpen(false)}
            anchor={attachAnchor}
            canAttachMedia={canAttachMedia}
            onPhoto={() => void attachments.onAttach()}
            onCamera={() => void attachments.onCapture()}
            attachedEventId={draft.attachedEventId}
            attachedReportId={draft.attachedReportId}
            onSelectEvent={(event: LinkedEventRef, _cleanup: CleanupDTO) =>
              setAttachedEvent(targetId, event)
            }
            onSelectReport={(report) => {
              setAttachedReportId(targetId, report.id)
              // Prime the SAME cache entry `useReport` above reads, with the full row the sheet already
              // has in hand - otherwise the chip would show the generic label for a beat while a fetch
              // for a report we just received in full round-trips to the server.
              queryClient.setQueryData<ReportDTO>(queryKeys.report(report.id), report)
            }}
          />
        ) : null}
      </View>
    )
  },
)

const useStyles = makeThemedStyles((t) => ({
  root: {
    position: "relative",
  },
  surface: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
    backgroundColor: t.colors.bg,
    paddingHorizontal: t.space["3"],
    paddingTop: t.space["2"],
    gap: 6,
  },
  // DS-14, EXPANDED ONLY. Two changes, both about the bar's edges inside the sand card:
  //   - the top hairline becomes the on-sand rule §6 names (`borderStrong` lightened to 0.45, 1px flat).
  //     `colors.border` on `colors.bg` is rgb(236,229,216) on rgb(237,230,216) - literally invisible - so
  //     on a full thread the last reply ran straight into the field with nothing separating them;
  //   - the top inset joins the sides at 12 (the bottom is evened at the call site, where `dock.restPad`
  //     is added), so the field's four gaps to the card finally agree.
  surfaceInCard: {
    borderTopWidth: 1,
    borderTopColor: wash(t.colors.borderStrong, 0.45, t),
    paddingTop: t.space["3"],
  },
  // Floats above the surface; `bottom: "100%"` puts its BOTTOM edge on the surface's TOP edge.
  tray: {
    position: "absolute",
    left: t.space["3"],
    right: t.space["3"],
    bottom: "100%",
    marginBottom: 6,
    zIndex: 2,
  },
  // The two MEASURED, non-shrinking blocks. flexShrink:0 is what makes the field give first.
  chrome: {
    flexShrink: 0,
  },
  chromeBottom: {
    flexShrink: 0,
    gap: 6,
  },
  // DS-06, EXPANDED ONLY. The expanded bar is three stacked rows and they sat on three different left
  // edges: the "Replying to @x" chip and the +/Reply tools row started at the surface gutter (x~108 at
  // 1440) while the FIELD started at x~142, inset past the 28pt avatar - so the one row the other two
  // belong to was the only one indented, and the composer read as three unrelated blocks. Indenting the
  // two chrome blocks by the avatar gutter (28 avatar + `fieldRow`'s 10 gap) puts all three on the
  // field's left edge without restructuring the tree - which matters, because the two `onLayout` probes
  // that budget this bar's height measure exactly these blocks.
  chromeInCard: {
    marginLeft: 28 + 10,
  },
  // The ONLY shrinking block (with the input inside it).
  fieldRow: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fieldAvatarExpanded: {
    alignSelf: "flex-start",
    marginTop: 4,
  },
  input: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    minHeight: 36,
    paddingHorizontal: t.space["3"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["2"],
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surfaceTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 15,
    lineHeight: 20,
    color: t.colors.text,
    textAlignVertical: "top",
  },
  // DS-05, EXPANDED ONLY: the house focused-field treatment (`SearchBody.styles.fieldFocused` verbatim) -
  // the coral `shadow.ring` plus an accent border - replacing Chrome's default blue outline on the single
  // most-used field of the thread surface.
  inputFocused:
    Platform.OS === "web"
      ? ({ boxShadow: tokens.shadow.ring, borderColor: t.colors.accent } as unknown as TextStyle)
      : { borderColor: t.colors.accent },
  toolsRow: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
  },
  toolsSpacer: {
    flex: 1,
  },
  plus: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.surfaceTint,
    flexShrink: 0,
  },
  plusDisabled: {
    opacity: 0.45,
  },
  counter: {
    marginRight: t.space["3"],
    fontFamily: t.fontFamily.bodyMedium,
    fontSize: 12,
    color: t.colors.textSubtle,
  },
  counterUrgent: {
    color: t.colors.bloom["600"],
  },
  replyPill: {
    height: 36,
    paddingHorizontal: t.space["4"],
    borderRadius: t.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.accent,
    flexShrink: 0,
  },
  replyPillDisabled: {
    backgroundColor: t.colors.surfaceTint,
  },
  replyLabel: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 14,
    lineHeight: 18,
    color: t.colors.onAccent,
  },
  replyLabelDisabled: {
    color: t.colors.textSubtle,
  },
  error: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 13,
    lineHeight: 17,
    color: t.colors.bloom["600"],
  },
  signInPill: {
    minHeight: 44,
    borderRadius: t.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.accent,
    ...t.shadows.pin,
  },
  signInLabel: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 14,
    lineHeight: 18,
    color: t.colors.onAccent,
  },
  pressed: {
    opacity: 0.78,
  },
}))
