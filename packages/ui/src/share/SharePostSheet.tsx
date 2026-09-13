import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Platform, StyleSheet, View } from "react-native"
import type { PersonDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme, webInputReset } from "../theme"
import { iconMap } from "../typography"
import { useT } from "../i18n"
import {
  ModalCardSheet,
  modalSheetInputFocusedStyle,
  modalSheetInputStyle,
} from "../primitives/ModalCardSheet"
import { PrimaryButton } from "../primitives/PrimaryButton"
import { SecondaryButton } from "../primitives/SecondaryButton"
import { SignInPrompt } from "../primitives/StateView"
import { TextInput } from "../primitives/TextInput"
import { useToast } from "../primitives/toastContext"
import { absoluteUrl, shareLink } from "../primitives/share"
import { MemberPicker } from "../bodies/MemberPicker"
import { personToSearchResult } from "../bodies/memberSelect"
import { useAuthState, useRequireAuth } from "../data/context"
import { useThreads } from "../data/hooks/chat"
import {
  SHARE_DM_MAX_RECIPIENTS,
  applyRecipientChange,
  buildSharePlan,
  composeShareBody,
  dmThreadIdsByPeer,
  recentDmPeers,
  recipientNames,
  retryEntries,
  shareNoteMaxLength,
  toShareRecipient,
  type SharePlanEntry,
} from "./shareToDm"
import { newShareClientId, useShareToDm } from "./useShareToDm"
import type { SharePostTarget } from "./types"

export interface SharePostSheetProps {
  visible: boolean
  target: SharePostTarget
  onClose: () => void
}

const NO_SELECTION: PersonDTO[] = []
const EMPTY_EXCLUDE: readonly string[] = []

export function SharePostSheet({ visible, target, onClose }: SharePostSheetProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("share-post")
  const toast = useToast()
  const { isAuthenticated, user } = useAuthState()
  const requireAuth = useRequireAuth()
  const share = useShareToDm()
  const threads = useThreads()

  const [selected, setSelected] = useState<PersonDTO[]>(NO_SELECTION)
  const [note, setNote] = useState("")
  const [noteFocused, setNoteFocused] = useState(false)

  const url = useMemo(() => absoluteUrl(target.path), [target.path])
  const noteMax = shareNoteMaxLength(url)
  const suggested = useMemo(
    () => recentDmPeers(threads.data?.pages).map(personToSearchResult),
    [threads.data],
  )
  const knownRooms = useMemo(() => dmThreadIdsByPeer(threads.data?.pages), [threads.data])
  const excludeIds = useMemo(() => (user?.id ? [user.id] : EMPTY_EXCLUDE), [user?.id])

  const cancelledRef = useRef(false)
  const pendingAfterDismiss = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!visible) return
    cancelledRef.current = false
    setSelected(NO_SELECTION)
    setNote("")
  }, [visible])

  const runAfterDismiss = useCallback(
    (action: () => void) => {
      if (Platform.OS === "ios") {
        pendingAfterDismiss.current = action
        onClose()
        return
      }
      onClose()
      action()
    },
    [onClose],
  )
  const onModalDismiss = useCallback(() => {
    const action = pendingAfterDismiss.current
    pendingAfterDismiss.current = null
    if (action) action()
  }, [])

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
    try {
      const summary = await share.send({ entries, body, knownRooms })
      if (cancelledRef.current) {
        cancelledRef.current = false
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
    }
  }

  const onCancel = (): void => {
    if (pending) {
      cancelledRef.current = true
      share.abort()
    }
    onClose()
  }

  const onSend = (): void => {
    if (!canSend) return
    const entries = buildSharePlan(selected.map(toShareRecipient), newShareClientId)
    if (entries.length === 0) return
    void deliver(entries, composeShareBody(note, url))
  }

  const onShareAnotherWay = useCallback(() => {
    runAfterDismiss(() => {
      void shareLink({
        title: target.title,
        path: target.path,
        message: t("common-share:sheet.message", { title: target.title, url }),
      }).then((result) => {
        if (result === "copied") {
          toast.show(t("common-share:button.copied"), { variant: "success" })
        }
      })
    })
  }, [runAfterDismiss, target.title, target.path, url, t, toast])

  const onSignIn = useCallback(() => {
    runAfterDismiss(() => requireAuth(() => undefined, { next: target.path }))
  }, [runAfterDismiss, requireAuth, target.path])

  return (
    <ModalCardSheet
      visible={visible}
      onClose={onCancel}
      onCommit={canSend ? onSend : undefined}
      onDismiss={onModalDismiss}
      headerIcon="Share"
      title={t("title")}
      dismissLabel={t("backdrop.dismiss")}
      bodyLayout="fill"
      bodyContentStyle={styles.body}
      cardStyle={styles.card}
      actions={
        isAuthenticated ? (
          <>
            <SecondaryButton label={t("actions.cancel")} onPress={onCancel} size="sm" />
            <PrimaryButton
              label={
                selected.length > 0
                  ? t("actions.send_count", { count: selected.length })
                  : t("actions.send")
              }
              onPress={onSend}
              loading={pending}
              disabled={!canSend}
            />
          </>
        ) : (
          <SecondaryButton label={t("actions.close")} onPress={onCancel} size="sm" />
        )
      }
    >
      {isAuthenticated ? (
        <>
          <MemberPicker
            selected={selected}
            onChange={onChangeRecipients}
            excludeIds={excludeIds}
            emptyPromptBody={t("recipients.empty_prompt")}
            suggested={suggested}
            suggestedLabel={t("recipients.recent")}
          />
          <TextInput
            value={note}
            onChangeText={(next) => setNote(next.slice(0, noteMax))}
            editable={!pending}
            maxLength={noteMax}
            placeholder={t("note.placeholder")}
            placeholderTextColor={th.colors.textSubtle}
            accessibilityLabel={t("note.a11y")}
            onFocus={() => setNoteFocused(true)}
            onBlur={() => setNoteFocused(false)}
            style={[webInputReset, styles.note, noteFocused ? modalSheetInputFocusedStyle(th) : null]}
          />
        </>
      ) : (
        <View style={styles.signedOut}>
          <SignInPrompt
            icon={iconMap.MessageCircle}
            title={t("signed_out.title")}
            body={t("signed_out.body")}
            variant="detail"
            onSignIn={onSignIn}
          />
        </View>
      )}
      <View style={styles.divider} />
      <SecondaryButton
        label={t("actions.more")}
        icon={iconMap.Share}
        onPress={onShareAnotherWay}
        disabled={pending}
        style={styles.more}
      />
    </ModalCardSheet>
  )
}

const useStyles = makeThemedStyles((t) => ({
  card: {
    height: "85%",
  },
  body: {
    gap: t.space["3"],
  },
  signedOut: {
    flex: 1,
    justifyContent: "center",
  },
  note: {
    ...modalSheetInputStyle(t),
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.colors.border,
  },
  more: {
    alignSelf: "stretch",
  },
}))
