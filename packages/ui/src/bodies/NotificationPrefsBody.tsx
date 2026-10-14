import React, { useCallback } from "react"
import { View } from "react-native"
import type { NotificationPrefsDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme } from "../theme"
import { iconMap } from "../typography"
import {
  Toggle,
  EmptyState,
  SignInPrompt,
  SkeletonGroup,
  SkeletonList,
  SkeletonText,
  useToast,
} from "../primitives"
import {
  useNotificationPrefs,
  useUpdateNotificationPrefs,
  useAuthState,
  useRequireAuth,
} from "../data"
import { usePush } from "../capabilities"
import { useScrollHost } from "../shell/ScrollHost"
import { useT } from "../i18n"
import { SectionEyebrow } from "./profile/SectionHeadings"

function SectionLabel({ children }: { children: string }) {
  const styles = useStyles()
  return (
    <View style={styles.sectionLabelRow}>
      <SectionEyebrow inline>{children}</SectionEyebrow>
    </View>
  )
}

export function NotificationPrefsBody() {
  const styles = useStyles()
  const th = useTheme()
  const { ScrollView } = useScrollHost()
  const { t } = useT("notifications-prefs")
  const { isAuthenticated, isPending } = useAuthState()
  const requireAuth = useRequireAuth()
  const push = usePush()

  const query = useNotificationPrefs()
  const update = useUpdateNotificationPrefs()
  const toast = useToast()
  const prefs = query.data

  const onSaveError = useCallback(
    () => toast.show(t("save_error"), { variant: "error" }),
    [toast, t],
  )

  const onTogglePush = useCallback(
    (next: boolean) => {
      update.mutate({ push: next }, { onError: onSaveError })
      if (next && push.isAvailable()) void push.registerForToken()
    },
    [update, push, onSaveError],
  )

  const onToggle = useCallback(
    (key: keyof NotificationPrefsDTO, next: boolean) => {
      update.mutate({ [key]: next }, { onError: onSaveError })
    },
    [update, onSaveError],
  )

  if (!isAuthenticated && !isPending) {
    return (
      <View style={styles.stateFill}>
        <SignInPrompt
          icon={iconMap.Bell}
          iconSize={32}
          variant="detail"
          title={t("signedOut.title")}
          body={t("signedOut.body")}
          onSignIn={() => requireAuth(() => {}, { next: "/notifications/prefs" })}
        />
      </View>
    )
  }
  if (isPending || query.isLoading) {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SkeletonGroup>
          <SkeletonText width="18%" height={11} style={styles.skeletonLabel} />
          <SkeletonList rows={1} kind="settings" />
        </SkeletonGroup>
        <SkeletonGroup style={styles.sectionGap}>
          <SkeletonText width="28%" height={11} style={styles.skeletonLabel} />
          <SkeletonList rows={4} kind="settings" />
        </SkeletonGroup>
      </ScrollView>
    )
  }
  if (query.isError || !prefs) {
    return (
      <View style={styles.stateFill}>
        <EmptyState
          variant="detail"
          tone="neutral"
          icon={iconMap.CloudOff}
          iconColor={th.colors.textSubtle}
          iconSize={30}
          title={t("error.title")}
          body={t("error.body")}
        />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
        <SectionLabel>{t("push.section")}</SectionLabel>
        <Toggle
          label={t("push.label")}
          helper={t("push.helper")}
          value={prefs.push}
          onValueChange={onTogglePush}
        />

        <View style={styles.sectionGap}>
          <SectionLabel>{t("categories.section")}</SectionLabel>
          <View style={styles.group}>
            <Toggle
              label={t("categories.reportUpdates.label")}
              helper={t("categories.reportUpdates.helper")}
              value={prefs.reportUpdates}
              onValueChange={(v) => onToggle("reportUpdates", v)}
            />
            <Toggle
              label={t("categories.eventChat.label")}
              helper={t("categories.eventChat.helper")}
              value={prefs.cleanupChat}
              onValueChange={(v) => onToggle("cleanupChat", v)}
            />
            <Toggle
              label={t("categories.mentions.label")}
              helper={t("categories.mentions.helper")}
              value={prefs.mentions ?? true}
              onValueChange={(v) => onToggle("mentions", v)}
            />
            <Toggle
              label={t("categories.follows.label")}
              helper={t("categories.follows.helper")}
              value={prefs.follows}
              onValueChange={(v) => onToggle("follows", v)}
            />
          </View>
        </View>
      </ScrollView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
  },
  stateFill: {
    flex: 1,
  },

  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: t.space["3"],
  },
  sectionGap: {
    marginTop: t.space["6"],
  },
  skeletonLabel: {
    marginBottom: t.space["3"],
  },
  group: {
    gap: t.space["3"],
  },

}))
