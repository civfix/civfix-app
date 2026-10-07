import React, { useCallback, useState } from "react"
import { StyleSheet, View } from "react-native"
import { makeThemedStyles } from "../theme"
import { iconMap } from "../typography"
import { useT } from "../i18n"
import { ModalCardSheet, modalSheetInputStyle } from "../primitives/ModalCardSheet"
import { PrimaryButton } from "../primitives/PrimaryButton"
import { SecondaryButton } from "../primitives/SecondaryButton"
import { useDeferredOverlayAction } from "../primitives/useDeferredOverlayAction"
import { MemberPicker } from "../bodies/MemberPicker"
import { useSharePostSession } from "./useSharePostSession"
import type { SharePostSheetProps } from "./SharePostSheet.types"
import { ShareNoteInput, ShareSignedOut } from "./ShareSheetParts"

export function SharePostSheet({ visible, target, onClose, onClosed }: SharePostSheetProps) {
  const styles = useStyles()
  const { t } = useT("share-post")
  const session = useSharePostSession({ visible, target, onClose })
  const { isAuthenticated, selected, pending, canSend, onSend, onCancel } = session
  const { run, settled } = useDeferredOverlayAction(visible, onCancel, onClosed)
  const [noteFocused, setNoteFocused] = useState(false)

  const onShareAnotherWay = useCallback(() => run(session.shareElsewhere), [run, session.shareElsewhere])
  const onSignIn = useCallback(() => run(session.signIn), [run, session.signIn])

  return (
    <ModalCardSheet
      visible={visible}
      onClose={onCancel}
      onClosed={settled}
      onCommit={canSend ? onSend : undefined}
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
            onChange={session.onChangeRecipients}
            excludeIds={session.excludeIds}
            emptyPromptBody={t("recipients.empty_prompt")}
            suggested={session.suggested}
            suggestedLabel={t("recipients.recent")}
          />
          <ShareNoteInput
            value={session.note}
            onChangeText={session.setNote}
            editable={!pending}
            maxLength={session.noteMax}
            focused={noteFocused}
            onFocusedChange={setNoteFocused}
            style={styles.note}
          />
        </>
      ) : (
        <ShareSignedOut onSignIn={onSignIn} style={styles.signedOut} />
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
