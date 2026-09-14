import React, { useCallback, useEffect, useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import type { UserSearchResultDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme, webInputReset } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { modalSheetInputFocusedStyle, modalSheetInputStyle } from "../primitives/ModalCardSheet"
import { PrimaryButton } from "../primitives/PrimaryButton"
import { SignInPrompt } from "../primitives/StateView"
import { SlideUpSheet } from "../primitives/SlideUpSheet"
import { TextInput } from "../primitives/TextInput"
import { useDeferredOverlayAction } from "../primitives/useDeferredOverlayAction"
import { useToast } from "../primitives/toastContext"
import { useClipboard, useHaptics } from "../capabilities"
import { normalizeUserSearchTerm, useUserSearch } from "../data/hooks/direct"
import { searchResultToPerson, toggleMember } from "../bodies/memberSelect"
import { ShareActionTile } from "./ShareActionTile"
import { SharePeople } from "./SharePeople"
import { sharePeopleView, shareSheetFooter } from "./shareSheetModel"
import { useSharePostSession } from "./useSharePostSession"
import type { SharePostSheetProps } from "./SharePostSheet.types"

const NO_RESULTS: readonly UserSearchResultDTO[] = []

export function SharePostSheet({ visible, target, onClose, onClosed }: SharePostSheetProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("share-post")
  const toast = useToast()
  const clipboard = useClipboard()
  const haptics = useHaptics()
  const session = useSharePostSession({ visible, target, onClose })
  const { isAuthenticated, selected, pending, canSend, onSend, onCancel, excludeIds } = session
  const { run, settled } = useDeferredOverlayAction(visible, onCancel, onClosed)

  const [query, setQuery] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)
  const [noteFocused, setNoteFocused] = useState(false)
  useEffect(() => {
    if (visible) setQuery("")
  }, [visible])

  const search = useUserSearch(query)
  const typed = normalizeUserSearchTerm(query)
  const people = useMemo(
    () =>
      sharePeopleView({
        query: typed,
        suggested: session.suggested,
        results: search.data?.results ?? NO_RESULTS,
        excludeIds,
      }),
    [typed, session.suggested, search.data, excludeIds],
  )
  const searchPending = search.isLoading || search.term !== typed
  const footer = shareSheetFooter(isAuthenticated, selected.length)

  const onToggle = useCallback(
    (person: UserSearchResultDTO) => {
      haptics.selection()
      session.onChangeRecipients(toggleMember(selected, searchResultToPerson(person), excludeIds))
    },
    [haptics, session, selected, excludeIds],
  )

  const onCopyLink = useCallback(() => {
    if (!clipboard) return
    clipboard
      .setString(session.url)
      .then(() => toast.show(t("common-share:button.copied"), { variant: "success" }))
      .catch(() => toast.show(t("toast.copy_failed"), { variant: "error" }))
  }, [clipboard, session.url, t, toast])
  const onShareAnotherWay = useCallback(() => run(session.shareElsewhere), [run, session.shareElsewhere])
  const onSignIn = useCallback(() => run(session.signIn), [run, session.signIn])

  return (
    <SlideUpSheet
      visible={visible}
      onClose={onCancel}
      onClosed={settled}
      dismissLabel={t("backdrop.dismiss")}
      accessibilityLabel={t("title")}
    >
      <Text variant="bodyStrong" style={styles.title}>
        {t("title")}
      </Text>

      {isAuthenticated ? (
        <>
          <View style={[styles.search, searchFocused ? modalSheetInputFocusedStyle(th) : null]}>
            <Icon icon={iconMap.Search} size={16} color={th.colors.textSubtle} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              editable={!pending}
              placeholder={t("recipients.search_placeholder")}
              placeholderTextColor={th.colors.textSubtle}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t("recipients.search_placeholder")}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={[webInputReset, styles.searchInput]}
            />
          </View>
          <SharePeople
            view={people}
            selected={selected}
            query={typed}
            searchPending={searchPending}
            searchFailed={search.isError}
            onToggle={onToggle}
          />
        </>
      ) : (
        <SignInPrompt
          icon={iconMap.MessageCircle}
          title={t("signed_out.title")}
          body={t("signed_out.body")}
          variant="detail"
          onSignIn={onSignIn}
        />
      )}

      <View style={styles.divider} />

      {footer === "compose" ? (
        <View style={styles.compose}>
          <TextInput
            value={session.note}
            onChangeText={session.setNote}
            editable={!pending}
            maxLength={session.noteMax}
            placeholder={t("note.placeholder")}
            placeholderTextColor={th.colors.textSubtle}
            accessibilityLabel={t("note.a11y")}
            onFocus={() => setNoteFocused(true)}
            onBlur={() => setNoteFocused(false)}
            style={[webInputReset, styles.note, noteFocused ? modalSheetInputFocusedStyle(th) : null]}
          />
          <PrimaryButton
            label={t("actions.send_count", { count: selected.length })}
            onPress={onSend}
            loading={pending}
            disabled={!canSend}
          />
        </View>
      ) : (
        <View style={styles.actions}>
          {clipboard ? (
            <ShareActionTile icon="Copy" label={t("actions.copy_link")} onPress={onCopyLink} disabled={pending} />
          ) : null}
          <ShareActionTile icon="Share" label={t("actions.more")} onPress={onShareAnotherWay} disabled={pending} />
        </View>
      )}
    </SlideUpSheet>
  )
}

const useStyles = makeThemedStyles((t) => ({
  title: {
    textAlign: "center",
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surfaceTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: t.space["2"],
    fontFamily: t.fontFamily.bodyMedium,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.colors.border,
  },
  compose: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  note: {
    ...modalSheetInputStyle(t),
    flex: 1,
    minWidth: 0,
  },
  actions: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: t.space["2"],
  },
}))
