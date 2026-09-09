import React, { useCallback } from "react"
import { View, StyleSheet } from "react-native"
import { theme } from "../theme"
import { iconMap } from "../typography"
import {
  SettingsRow,
  SettingsSection,
  SignInPrompt,
  SkeletonGroup,
  SkeletonList,
  SkeletonText,
} from "../primitives"
import { useAuthState, useRequireAuth, useUpdatePrivacySettings } from "../data"
import { useNavStore } from "../nav"
import { useScrollHost } from "../shell/ScrollHost"
import { useT } from "../i18n"

export function SettingsPrivacyBody() {
  const { ScrollView } = useScrollHost()
  const { t } = useT("settings-privacy")
  const { isAuthenticated, isPending, user } = useAuthState()
  const requireAuth = useRequireAuth()
  const updatePrivacy = useUpdatePrivacySettings()

  const allowDms = user?.allowDirectMessages ?? true
  const showHours = user?.showVolunteerHours === true

  const openBlocked = useCallback(() => {
    useNavStore.getState().push({ kind: "blocked" })
  }, [])

  if (!isAuthenticated && !isPending) {
    return (
      <View style={styles.stateFill}>
        <SignInPrompt
          icon={iconMap.Lock}
          iconSize={32}
          variant="detail"
          title={t("signedOut.title")}
          body={t("signedOut.body")}
          onSignIn={() => requireAuth(() => {}, { next: "/settings/privacy" })}
        />
      </View>
    )
  }

  if (isPending) {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SkeletonGroup>
          <SkeletonText width="30%" height={11} style={styles.skeletonLabel} />
          <SkeletonList rows={2} kind="settings" />
        </SkeletonGroup>
        <SkeletonGroup style={styles.skeletonSection}>
          <SkeletonText width="26%" height={11} style={styles.skeletonLabel} />
          <SkeletonList rows={2} kind="settings" />
        </SkeletonGroup>
      </ScrollView>
    )
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SettingsSection label={t("section.visibility")}>
        <SettingsRow
          label={t("allowDms.label")}
          sub={t("allowDms.helper")}
          toggle={{ value: allowDms, onValueChange: (next) => updatePrivacy.mutate(next) }}
        />
        <SettingsRow
          label={t("showHours.label")}
          sub={t("showHours.helper")}
          toggle={{
            value: showHours,
            onValueChange: (next) => updatePrivacy.mutate({ showVolunteerHours: next }),
          }}
        />
      </SettingsSection>

      <SettingsSection label={t("section.safety")} style={styles.sectionGap}>
        <SettingsRow
          icon="Ban"
          label={t("blocked.label")}
          sub={t("blocked.sub")}
          onPress={openBlocked}
        />
      </SettingsSection>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.space["4"],
    paddingTop: theme.space["2"],
    paddingBottom: theme.space["10"],
  },
  stateFill: {
    flex: 1,
  },
  sectionGap: {
    marginTop: theme.space["6"],
  },
  skeletonLabel: {
    marginBottom: theme.space["3"],
  },
  skeletonSection: {
    marginTop: theme.space["6"],
  },
})
