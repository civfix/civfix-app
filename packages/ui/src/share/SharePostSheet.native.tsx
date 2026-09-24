import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { StyleSheet, View } from "react-native"
import type { UserSearchResultDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme, webInputReset, inputFocusedStyle } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { modalSheetInputStyle } from "../primitives/ModalCardSheet"
import { PrimaryButton } from "../primitives/PrimaryButton"
import { SlideUpSheet } from "../primitives/SlideUpSheet"
import { TextInput } from "../primitives/TextInput"
import { useDeferredOverlayAction } from "../primitives/useDeferredOverlayAction"
import { TOAST_QUIET_MS } from "../primitives/toastModel"
import { useClipboard, useHaptics } from "../capabilities"
import { normalizeUserSearchTerm, useUserSearch } from "../data/hooks/direct"
import { searchResultToPerson, toggleMember } from "../bodies/memberSelect"
import { ShareActionTile } from "./ShareActionTile"
import { SharePeople } from "./SharePeople"
import { shareCopyTileFace, sharePeopleView, shareSheetFooter, type ShareCopyState } from "./shareSheetModel"
import { useSharePostSession } from "./useSharePostSession"
import type { SharePostSheetProps } from "./SharePostSheet.types"
import { ShareNoteInput, ShareSignedOut } from "./ShareSheetParts"

const NO_RESULTS: readonly UserSearchResultDTO[] = []

const SEARCH_ICON_SIZE = 16

export function SharePostSheet({ visible, target, onClose, onClosed }: SharePostSheetProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("share-post")
  const clipboard = useClipboard()
  const haptics = useHaptics()
  const session = useSharePostSession({ visible, target, onClose })
  const { isAuthenticated, selected, pending, canSend, onSend, onCancel, excludeIds } = session
  const { run, settled } = useDeferredOverlayAction(visible, onCancel, onClosed)

  const [query, setQuery] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)
  const [noteFocused, setNoteFocused] = useState(false)
  const [copyState, setCopyState] = useState<ShareCopyState>("idle")
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearCopyReset = useCallback(() => {
    if (copyResetRef.current === null) return
    clearTimeout(copyResetRef.current)
    copyResetRef.current = null
  }, [])
  useEffect(() => clearCopyReset, [clearCopyReset])
  useEffect(() => {
    if (!visible) return
    setQuery("")
    clearCopyReset()
    setCopyState("idle")
  }, [visible, clearCopyReset])

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

  const showCopyState = useCallback(
    (next: ShareCopyState) => {
      clearCopyReset()
      setCopyState(next)
      copyResetRef.current = setTimeout(() => {
        copyResetRef.current = null
        setCopyState("idle")
      }, TOAST_QUIET_MS)
    },
    [clearCopyReset],
  )
  const onCopyLink = useCallback(() => {
    if (!clipboard) return
    clipboard
      .setString(session.url)
      .then(() => {
        haptics.success()
        showCopyState("copied")
      })
      .catch(() => {
        haptics.error()
        showCopyState("failed")
      })
  }, [clipboard, haptics, session.url, showCopyState])
  const copyTile = shareCopyTileFace(copyState, {
    idle: t("actions.copy_link"),
    copied: t("common-share:button.copied"),
    failed: t("actions.copy_failed"),
  })
  const onShareAnotherWay = useCallback(() => run(session.shareElsewhere), [run, session.shareElsewhere])
  const onSignIn = useCallback(() => run(session.signIn), [run, session.signIn])

  return (
    <SlideUpSheet
      visible={visible}
      onClose={onCancel}
      onClosed={settled}
      dismissLabel={t("backdrop.dismiss")}
      accessibilityLabel={t("title")}
      bodyLayout="fill"
    >
      <Text variant="bodyStrong" style={styles.title}>
        {t("title")}
      </Text>

      {isAuthenticated ? (
        <>
          <View style={[styles.search, searchFocused ? inputFocusedStyle(th) : null]}>
            <Icon icon={iconMap.Search} size={SEARCH_ICON_SIZE} color={th.colors.textSubtle} />
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
        <ShareSignedOut onSignIn={onSignIn} style={styles.signedOut} />
      )}

      <View style={styles.divider} />

      {footer === "compose" ? (
        <View style={styles.compose}>
          <ShareNoteInput
            value={session.note}
            onChangeText={session.setNote}
            editable={!pending}
            maxLength={session.noteMax}
            focused={noteFocused}
            onFocusedChange={setNoteFocused}
            style={styles.note}
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
            <ShareActionTile
              icon={copyTile.icon}
              label={copyTile.label}
              name={t("actions.copy_link")}
              status={copyState === "idle" ? undefined : copyTile.label}
              tone={copyTile.tone}
              onPress={onCopyLink}
              disabled={pending}
            />
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
  signedOut: {
    flexDirection: "row",
    paddingVertical: t.space["2"],
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
