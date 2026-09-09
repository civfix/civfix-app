/**
 * The composer's state machine: the draft, its staged @mentions and attachments, and the two inline
 * modes - "edit" (P1: the composer field itself becomes the edit box, parking the in-progress draft)
 * and "reply" (P2: a plain send aimed at a quoted message). Owns submit, so the edit/send/reply
 * decision lives in one place (the pure resolveComposerSubmit) instead of in the JSX.
 */
import { useCallback, useMemo, useRef, useState } from "react"
import { Platform } from "react-native"
import type { NativeSyntheticEvent, TextInputKeyPressEventData } from "react-native"
import { MESSAGE_BODY_MAX, type ChatMessageDTO, type UserSearchResultDTO } from "@civfix/shared"
import type { ComposerMedia } from "../../data"
import type { MentionCandidate } from "../../primitives"
import { useToast } from "../../primitives"
import { useComposerAttachments } from "../../primitives/useComposerAttachments"
import { useAutoGrowInput } from "../../primitives/useAutoGrowInput"
import { isComposerSendKey, isComposerCancelKey } from "../../primitives/composerKeyPress"
import { conversationFieldEscape } from "../../shell/shellKeyModel"
import { useT } from "../../i18n"
import { resolveComposerSubmit, type ComposerSubmitMode } from "../composerSubmit"
import { bodyMentionsHandle } from "./mentionMatch"
import { CONTROL, COMPOSER_MAX } from "./styles"

export type ComposerModeValue = { kind: "edit" | "reply"; message: ChatMessageDTO } | null

export interface ComposerModeState {
  draft: string
  composerMode: ComposerModeValue
  editPending: boolean
  submitMode: ComposerSubmitMode | null
  /** Staged attachments (shared hook) - the thumb strip, the attach sheet and the upload gate. */
  att: ReturnType<typeof useComposerAttachments>
  /** The auto-growing TextInput's ref + measured height. */
  grow: ReturnType<typeof useAutoGrowInput>
  onChangeDraft: (text: string) => void
  onPickMention: (candidate: MentionCandidate, nextDraft: string) => void
  /** Context-menu "Edit": flip the composer into edit mode for this message. Stable identity. */
  onOpenEdit: (message: ChatMessageDTO) => void
  /** Context-menu "Reply" / swipe-to-reply: aim the composer at this message. Stable identity. */
  onOpenReply: (message: ChatMessageDTO) => void
  cancelComposerMode: () => void
  onSend: () => void
  onComposerKeyPress: ((e: NativeSyntheticEvent<TextInputKeyPressEventData>) => void) | undefined
}

export function useComposerMode({
  send,
  edit,
  sendTyping,
  scrollToBottom,
}: {
  send: (body: string, mentionedUserIds?: string[], media?: ComposerMedia[], replyToId?: string) => void
  edit: (messageId: string, body: string, mentionedUserIds?: string[]) => Promise<void>
  sendTyping: () => void
  scrollToBottom: () => void
}): ComposerModeState {
  const { t } = useT("conversation")
  const toast = useToast()
  const [draft, setDraft] = useState("")
  const [mentioned, setMentioned] = useState<UserSearchResultDTO[]>([])
  const att = useComposerAttachments()
  const grow = useAutoGrowInput(draft, CONTROL, COMPOSER_MAX)
  // Inline composer mode: "edit" (P1) repurposes the composer field itself (no modal); "reply" (P2)
  // keeps the composer as a plain send aimed at the quoted message (mode bar shows author + excerpt).
  const [composerMode, setComposerMode] = useState<ComposerModeValue>(null)
  const [editPending, setEditPending] = useState(false)

  // Mirror of the live draft state for callbacks that must stay referentially STABLE (onOpenEdit feeds
  // every rendered Bubble via renderItem - depending on `draft` directly would re-render the whole list
  // per keystroke). Assigned every render, so reads are always fresh.
  const draftStateRef = useRef<{ draft: string; mentioned: UserSearchResultDTO[] }>({ draft: "", mentioned: [] })
  draftStateRef.current = { draft, mentioned }
  // Same stability trick for the composer mode: onOpenReply is fed to every Bubble via renderItem and
  // must not churn when the mode or an edit save toggles. Assigned every render, reads always fresh.
  const composerModeStateRef = useRef<{ mode: ComposerModeValue; editPending: boolean }>({ mode: null, editPending: false })
  composerModeStateRef.current = { mode: composerMode, editPending }
  // The pre-edit composer draft, parked when edit mode opens and restored when it ends (cancel or save).
  const savedDraftRef = useRef<{ draft: string; mentioned: UserSearchResultDTO[] } | null>(null)

  // The pure view of the active mode for resolveComposerSubmit (shared by the press handler and the
  // submit button's disabled state).
  const submitMode = useMemo<ComposerSubmitMode | null>(
    () =>
      composerMode
        ? { kind: composerMode.kind, messageId: composerMode.message.id, originalBody: composerMode.message.body ?? "" }
        : null,
    [composerMode],
  )

  const restoreSavedDraft = useCallback(() => {
    const saved = savedDraftRef.current
    savedDraftRef.current = null
    setDraft(saved?.draft ?? "")
    setMentioned(saved?.mentioned ?? [])
  }, [])

  // Leave the composer mode without submitting (the mode bar's X, or Escape on web). Only EDIT parked
  // a draft to restore; cancelling a reply leaves the in-progress draft untouched (reply never parks -
  // the user types alongside the quote strip).
  const cancelComposerMode = useCallback(() => {
    if (editPending) return
    const wasEdit = composerMode?.kind === "edit"
    setComposerMode(null)
    if (wasEdit) restoreSavedDraft()
  }, [editPending, composerMode, restoreSavedDraft])

  const onSend = useCallback(() => {
    // Edits are text-only: staged attachments stay parked in `att` (strip hidden, attach disabled
    // while editing) and are never sent with an edit - they come back when the mode ends. Gated on
    // the EDIT kind specifically: P2's reply mode is a send with a reference, media and all.
    const media: ComposerMedia[] = submitMode?.kind === "edit"
      ? []
      : att.attachments
          .filter((a) => a.uploadId)
          .map((a) => ({ uploadId: a.uploadId!, kind: a.kind, localUri: a.uri, posterUri: a.posterUri ?? null }))
    const resolved = resolveComposerSubmit(submitMode, draft, media.length > 0)
    if (resolved.action === "noop") return
    // Same mention grammar the bubble renderer tints with (mentionMatch), so a mention that reads as
    // live to everyone is always delivered as a mention id - and a handle carrying regex
    // metacharacters can never blow up here.
    const mentionedUserIds = mentioned
      .filter((u) => bodyMentionsHandle(resolved.body, u.handle))
      .map((u) => u.id)
    if (resolved.action === "edit") {
      if (editPending) return
      setEditPending(true)
      edit(resolved.messageId, resolved.body, mentionedUserIds)
        .then(() => {
          setEditPending(false)
          setComposerMode(null)
          // The edit consumed the composer box; the parked pre-edit draft comes back.
          restoreSavedDraft()
        })
        .catch((err: unknown) => {
          // Keep the mode + edited text so the user can retry; surface the failure as a toast.
          setEditPending(false)
          toast.show(err instanceof Error ? err.message : t("composer.save_error"), { variant: "error" })
        })
      return
    }
    if (att.uploading) return
    // Reply is a plain send with a reference: pass the quoted message's id, fire-and-forget like any
    // send, and drop the mode with the rest of the composer state (no parked draft to restore).
    send(resolved.body, mentionedUserIds, media, submitMode?.kind === "reply" ? submitMode.messageId : undefined)
    setComposerMode(null)
    setDraft("")
    att.reset()
    setMentioned([])
    scrollToBottom()
  }, [submitMode, draft, mentioned, att, send, edit, editPending, restoreSavedDraft, toast, t, scrollToBottom])

  // ESCAPE, the field's half of the shell ladder (`conversationFieldEscape` - see shellKeyModel's header for
  // why this rung is the FIELD's and not `ESCAPE_BLURS_FIELD`'s). One press spends the composer's own state:
  // an active reply/edit mode is dropped, and with no mode left the field gives itself up so the SHELL's next
  // Escape - which its `editable` guard vetoes while anything is focused - pops the panel. Same clear/blur/
  // back shape the search field has, so the card's three text surfaces answer Escape identically.
  const onComposerKeyPress = useMemo(
    () =>
      Platform.OS === "web"
        ? (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
            if (isComposerCancelKey(e)) {
              if (conversationFieldEscape(composerMode !== null) === "cancel-mode") cancelComposerMode()
              else grow.ref.current?.blur()
              return
            }
            if (isComposerSendKey(e)) onSend()
          }
        : undefined,
    [onSend, composerMode, cancelComposerMode, grow.ref],
  )

  // Context-menu "Edit": flip the composer itself into edit mode (no modal). Park the in-progress
  // draft (cancel/save restores it), pre-fill the field with the original body, and seed the mention
  // list from the message's existing mentions so the submit-time re-filter keeps the ones the edited
  // text still contains. Reads live draft state through the mirror ref (stability, above).
  const onOpenEdit = useCallback((message: ChatMessageDTO) => {
    // Re-entrant guard: picking Edit on message B while already editing A must NOT re-park A's
    // in-progress edit text over the user's ORIGINAL draft - only the first entry parks.
    if (savedDraftRef.current === null) savedDraftRef.current = { ...draftStateRef.current }
    setComposerMode({ kind: "edit", message })
    setDraft((message.body ?? "").slice(0, MESSAGE_BODY_MAX))
    setMentioned(
      (message.mentions ?? []).map((m) => ({
        id: m.id,
        handle: m.handle,
        displayName: m.displayName,
        avatar: null,
        avatarUrl: null,
      })),
    )
    // Deferred: the context-menu Modal is dismissing right now, and its teardown can swallow a
    // synchronous focus on native - focus once it is gone.
    setTimeout(() => grow.ref.current?.focus(), 50)
  }, [grow.ref])

  // Context-menu "Reply": aim the composer at the quoted message. The draft is untouched - the user
  // types alongside the quote strip, and reply NEVER parks/restores drafts. Mutual exclusivity:
  // entering reply while editing cancels the edit first (parked pre-edit draft comes back, replacing
  // the abandoned edit text); entering edit while replying just replaces the mode (onOpenEdit above).
  const onOpenReply = useCallback((message: ChatMessageDTO) => {
    const { mode, editPending: pending } = composerModeStateRef.current
    // An in-flight edit save owns the composer; ignore Reply until it settles (mirrors cancel's guard).
    if (pending) return
    if (mode?.kind === "edit") restoreSavedDraft()
    setComposerMode({ kind: "reply", message })
    // Same deferred focus as edit: the context-menu Modal is tearing down right now.
    setTimeout(() => grow.ref.current?.focus(), 50)
  }, [restoreSavedDraft, grow.ref])

  const onChangeDraft = useCallback(
    (text: string) => {
      setDraft(text)
      sendTyping()
    },
    [sendTyping],
  )

  const onPickMention = useCallback((candidate: MentionCandidate, nextDraft: string) => {
    setDraft(nextDraft.slice(0, MESSAGE_BODY_MAX))
    if (candidate.kind === "jurisdiction") return
    const user = candidate as UserSearchResultDTO
    setMentioned((prev) => (prev.some((u) => u.id === user.id) ? prev : [...prev, user]))
  }, [])

  return {
    draft,
    composerMode,
    editPending,
    submitMode,
    att,
    grow,
    onChangeDraft,
    onPickMention,
    onOpenEdit,
    onOpenReply,
    cancelComposerMode,
    onSend,
    onComposerKeyPress,
  }
}
