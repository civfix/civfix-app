import React, { useCallback, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native"
import { Icon, Text, iconMap } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { focusRingProps, makeThemedStyles, useTheme } from "@/theme"
import { retrySessionRestore } from "@/hooks/useBootGate"
import { LAUNCH_SCHEME, launchTheme } from "@/boot/launchTheme"
import { useAuthStore } from "@/store/authStore"

const MIN_TOUCH_TARGET = 44
const NOTICE_TILE = 40

export function BootOfflineGate() {
  const { t } = useT("mobile-branding")
  const th = launchTheme
  const styles = useStyles.for(LAUNCH_SCHEME)
  const signOut = useAuthStore((s) => s.signOut)
  const [signingOut, setSigningOut] = useState(false)
  const onSignOut = useCallback(async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }, [signOut, signingOut])

  return (
    <View style={styles.gate}>
      <View style={styles.tile}>
        <Icon icon={iconMap.CloudOff} size={22} color={th.colors.textMuted} />
      </View>
      <Text variant="title" color={th.colors.text} style={styles.title}>
        {t("boot.offline_title")}
      </Text>
      <Text variant="body" color={th.colors.textMuted} style={styles.body}>
        {t("boot.offline_body")}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={retrySessionRestore}
        {...focusRingProps}
        style={({ pressed }) => [styles.primary, pressed ? styles.pressed : null]}
      >
        <Text style={styles.primaryLabel}>{t("boot.retry")}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("boot.sign_out")}
        accessibilityState={{ disabled: signingOut, busy: signingOut }}
        disabled={signingOut}
        onPress={onSignOut}
        {...focusRingProps}
        style={({ pressed }) => [styles.secondary, pressed ? styles.pressed : null]}
      >
        {signingOut ? (
          <ActivityIndicator color={th.colors.textMuted} />
        ) : (
          <Text style={styles.secondaryLabel}>{t("boot.sign_out")}</Text>
        )}
      </Pressable>
    </View>
  )
}

export function BootConnectivityNotice() {
  const { t } = useT("mobile-branding")
  const th = useTheme()
  const styles = useStyles()

  return (
    <View style={styles.notice}>
      <View style={styles.noticeIcon}>
        <Icon icon={iconMap.CloudOff} size={18} color={th.colors.textMuted} />
      </View>
      <View style={styles.noticeCopy}>
        <Text style={styles.noticeTitle}>{t("boot.offline_title")}</Text>
        <Text style={styles.noticeBody}>{t("boot.offline_body")}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={retrySessionRestore}
          {...focusRingProps}
          style={({ pressed }) => [styles.noticeAction, pressed ? styles.pressed : null]}
        >
          <Text style={styles.noticeActionLabel}>{t("boot.retry")}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  pressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
  gate: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: t.space["8"],
  },
  tile: {
    width: NOTICE_TILE,
    height: NOTICE_TILE,
    borderRadius: t.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
  },
  title: {
    marginTop: t.space["4"],
    textAlign: "center",
  },
  body: {
    marginTop: t.space["2"],
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  },
  primary: {
    marginTop: t.space["6"],
    alignSelf: "stretch",
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: t.space["5"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.accent,
  },
  primaryLabel: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["16"],
    color: t.colors.onAccent,
  },
  secondary: {
    marginTop: t.space["2"],
    alignSelf: "center",
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    paddingHorizontal: t.space["4"],
  },
  secondaryLabel: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    color: t.colors.textMuted,
  },
  notice: {
    flexDirection: "row",
    gap: t.space["3"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.neutral.card,
    padding: t.space["3"],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s1,
  },
  noticeIcon: {
    width: NOTICE_TILE,
    height: NOTICE_TILE,
    borderRadius: t.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
  },
  noticeCopy: { flex: 1, gap: t.space["1"] },
  noticeTitle: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
    lineHeight: 20,
    color: t.colors.text,
  },
  noticeBody: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    lineHeight: 16,
    color: t.colors.textMuted,
  },
  noticeAction: {
    alignSelf: "flex-start",
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    paddingHorizontal: t.space["3"],
    marginTop: t.space["2"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surfaceTint,
  },
  noticeActionLabel: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["12"],
    lineHeight: 16,
    color: t.colors.accentText,
  },
}))
