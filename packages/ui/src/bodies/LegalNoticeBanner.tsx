import React, { useContext, useRef } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import type { LegalDocumentMetaDTO, LegalDocumentType } from "@civfix/contract"
import { MIN_TOUCH_TARGET, focusRingProps, makeThemedStyles, useTheme, webCursor } from "../theme"
import { Text } from "../typography"
import { noticeAcknowledgement, useAcceptLegal, useAuthState, useMyLegalStatus } from "../data"
import { useT } from "../i18n"
import { openLegalDocumentInPlace } from "../primitives/legalDocumentNav"

// Over the shell and its map controls (50), under the sign-in overlay (70).
const BANNER_Z_INDEX = 60

// As wide as a phone, so on a desktop it reads as a notice rather than a page header.
const BANNER_MAX_WIDTH = 560

const NOTICE_KEYS = {
  terms: "notice.terms",
  privacy: "notice.privacy",
  cookies: "notice.cookies",
  subprocessors: "notice.subprocessors",
} as const satisfies Record<LegalDocumentType, string>

/** A newer legal version nobody has to accept: one notice at a time, in the server's order, until Got it. */
export function LegalNoticeBanner() {
  const { isAuthenticated, user } = useAuthState()
  const status = useMyLegalStatus()
  if (!isAuthenticated || user?.profileComplete === false || !status.data) return null
  // While something is owed the update prompt is up, and its Accept and continue acknowledges these too.
  if (status.data.required.length > 0) return null
  const notice = status.data.notices[0]
  if (!notice) return null
  return <NoticeBanner key={`${notice.type}:${notice.version}`} notice={notice} />
}

function NoticeBanner({ notice }: { notice: LegalDocumentMetaDTO }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("legal")
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 }
  const acknowledge = useAcceptLegal()
  const sentence = t(NOTICE_KEYS[notice.type])

  // isPending reaches the button a render later, after a quick second press has already landed.
  const sending = useRef(false)
  const onDismiss = () => {
    if (sending.current) return
    sending.current = true
    acknowledge.mutate(noticeAcknowledgement(notice), {
      onSettled: () => {
        sending.current = false
      },
    })
  }

  return (
    <View
      style={[
        styles.layer,
        {
          paddingTop: insets.top + th.space["3"],
          paddingLeft: insets.left + th.space["3"],
          paddingRight: insets.right + th.space["3"],
        },
      ]}
    >
      <View style={styles.banner}>
        <Text style={styles.text}>{notice.summary ? `${sentence} ${notice.summary}` : sentence}</Text>
        {acknowledge.isError ? (
          <Text style={styles.error} accessibilityRole="alert">
            {t("accept_error")}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            onPress={() => openLegalDocumentInPlace(notice.type)}
            accessibilityRole="button"
            accessibilityLabel={t("notice.read")}
            {...focusRingProps}
            style={({ pressed }) => [styles.action, webCursor(false), pressed ? styles.pressed : null]}
          >
            <Text style={styles.actionText}>{t("notice.read")}</Text>
          </Pressable>
          <Pressable
            onPress={onDismiss}
            disabled={acknowledge.isPending}
            accessibilityRole="button"
            accessibilityLabel={t("notice.dismiss")}
            accessibilityState={{ disabled: acknowledge.isPending, busy: acknowledge.isPending }}
            {...focusRingProps}
            style={({ pressed }) => [
              styles.action,
              webCursor(acknowledge.isPending),
              pressed ? styles.pressed : null,
              acknowledge.isPending ? styles.disabled : null,
            ]}
          >
            <Text style={styles.actionText}>{t("notice.dismiss")}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: BANNER_Z_INDEX,
    pointerEvents: "box-none",
  },
  banner: {
    width: "100%",
    maxWidth: BANNER_MAX_WIDTH,
    gap: t.space["2"],
    padding: t.space["4"],
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    ...t.shadows.s2,
  },
  text: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    lineHeight: t.fontSize["14"] * t.lineHeight.base,
    color: t.colors.text,
  },
  error: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    lineHeight: t.fontSize["14"] * t.lineHeight.base,
    color: t.colors.dangerInk,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: t.space["2"],
  },
  action: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    paddingHorizontal: t.space["4"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surfaceTint,
  },
  actionText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    lineHeight: t.fontSize["14"] * t.lineHeight.base,
    color: t.colors.accentText,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.5,
  },
}))
