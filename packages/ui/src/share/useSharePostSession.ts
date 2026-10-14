import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { PersonDTO } from "@civfix/shared"
import { useT } from "../i18n"
import { useToast } from "../primitives/toastContext"
import { absoluteUrl, shareLink } from "../primitives/share"
import { personToSearchResult } from "../bodies/memberSelect"
import { useAuthState, useRequireAuth } from "../data/context"
import { useThreads } from "../data/hooks/chat"
import {
  SHARE_DM_MAX_RECIPIENTS,
  applyRecipientChange,
  buildSharePlan,
  clampShareNote,
  composeShareBody,
  dmThreadIdsByPeer,
  recentDmPeers,
  recipientNames,
  retryEntries,
  shareNoteMaxLength,
  toShareRecipient,
  type SharePlanEntry,
} from "./shareToDm"
import { useShareToDm } from "./useShareToDm"
import { randomId } from "../data/randomId"
import type { SharePostTarget } from "./types"

const NO_SELECTION: PersonDTO[] = []
const EMPTY_EXCLUDE: readonly string[] = []

export interface SharePostSessionInput {
  visible: boolean
  target: SharePostTarget
  onClose: () => void
}

export function useSharePostSession({ visible, target, onClose }: SharePostSessionInput) {
  const { t } = useT("share-post")
  const toast = useToast()
  const { isAuthenticated, user } = useAuthState()
  const requireAuth = useRequireAuth()
  const share = useShareToDm()
  const threads = useThreads()

  const [selected, setSelected] = useState<PersonDTO[]>(NO_SELECTION)
  const [note, setNoteRaw] = useState("")

  const url = useMemo(() => absoluteUrl(target.path), [target.path])
  const noteMax = shareNoteMaxLength(url)
  const suggested = useMemo(
    () => recentDmPeers(threads.data?.pages).map(personToSearchResult),
    [threads.data],
  )
  const knownRooms = useMemo(() => dmThreadIdsByPeer(threads.data?.pages), [threads.data])
  const excludeIds = useMemo(() => (user?.id ? [user.id] : EMPTY_EXCLUDE), [user?.id])

  // A run answers to the sheet only while it is the live run. Cancelling detaches it, and reopening the
  // sheet must not re-attach it, so completion is keyed to the run rather than to one shared flag.
  const runSeq = useRef(0)
  const liveRun = useRef(0)
  const sending = useRef(false)

  useEffect(() => {
    if (!visible) return
    setSelected(NO_SELECTION)
    setNoteRaw("")
  }, [visible])

  const setNote = useCallback((next: string) => setNoteRaw(clampShareNote(next, noteMax)), [noteMax])

  const onChangeRecipients = useCallback(
    (next: PersonDTO[]) => {
      const change = applyRecipientChange(selected, next)
      if (change.rejected) {
        toast.show(t("recipients.cap", { count: SHARE_DM_MAX_RECIPIENTS }), { variant: "info" })
        return
      }
      setSelected(change.recipients)
    },
    [selected, toast, t],
  )

  const pending = share.isPending
  const canSend = isAuthenticated && selected.length > 0 && !pending

  const deliver = async (entries: SharePlanEntry[], body: string): Promise<void> => {
    if (sending.current) return
    sending.current = true
    const runId = ++runSeq.current
    liveRun.current = runId
    try {
      const summary = await share.send({ entries, body, knownRooms })
      if (liveRun.current !== runId) {
        if (summary.sent.length > 0) {
          toast.show(t("toast.sent", { count: summary.sent.length }), { variant: "success" })
        }
        return
      }
      if (summary.status === "all") {
        toast.show(t("toast.sent", { count: summary.sent.length }), { variant: "success" })
        onClose()
        return
      }
      const retry = {
        label: t("toast.retry"),
        onPress: () => {
          void deliver(retryEntries(entries, summary.failed), body)
        },
      }
      if (summary.status === "none") {
        toast.show(t("toast.none_sent"), { variant: "error", action: retry })
        return
      }
      const failedIds = new Set(summary.failed.map((recipient) => recipient.id))
      setSelected((prev) => prev.filter((person) => failedIds.has(person.id)))
      toast.show(t("toast.partial", { names: recipientNames(summary.failed) }), {
        variant: "error",
        action: retry,
      })
    } catch {
      toast.show(t("toast.none_sent"), { variant: "error" })
    } finally {
      sending.current = false
    }
  }

  const onCancel = useCallback((): void => {
    if (sending.current) {
      liveRun.current = 0
      share.abort()
    }
    onClose()
  }, [share, onClose])

  const onSend = (): void => {
    if (!canSend) return
    const entries = buildSharePlan(selected.map(toShareRecipient), randomId)
    if (entries.length === 0) return
    void deliver(entries, composeShareBody(note, url))
  }

  const shareElsewhere = useCallback(() => {
    void shareLink({
      title: target.title,
      path: target.path,
      message: t("os_share.message"),
    }).then((result) => {
      if (result === "copied") {
        toast.show(t("common-share:button.copied"), { variant: "success" })
      }
    })
  }, [target.title, target.path, t, toast])

  const signIn = useCallback(
    () => requireAuth(() => undefined, { next: target.path }),
    [requireAuth, target.path],
  )

  return {
    isAuthenticated,
    url,
    note,
    setNote,
    noteMax,
    selected,
    suggested,
    excludeIds,
    pending,
    canSend,
    onChangeRecipients,
    onSend,
    onCancel,
    shareElsewhere,
    signIn,
  }
}
