import React, { useCallback } from "react"
import { View, StyleSheet } from "react-native"
import { theme, useAppearancePreference } from "../theme"
import { iconMap } from "../typography"
import {
  SettingsRow,
  SettingsSection,
  SignInPrompt,
  DONATE_URL,
  PRIVACY_URL,
  TERMS_URL,
} from "../primitives"
import { useAuthState, useLogout, useRequireAuth } from "../data"
import { useOpenExternal } from "../capabilities"
import { useNavStore, type DetailKind } from "../nav"
import { useScrollHost } from "../shell/ScrollHost"
import { useLocale, useT, supportedLocales } from "../i18n"
import { useOnboardingTourPresenter } from "./onboardingTour"

export function SettingsBody() {
  const { ScrollView } = useScrollHost()
  const { t } = useT("settings")
  const { isAuthenticated, isPending } = useAuthState()
  const requireAuth = useRequireAuth()
  const logout = useLogout()
  const openExternal = useOpenExternal()
  const { locale } = useLocale()
  const appearance = useAppearancePreference()
  const { t: tAppearance } = useT("appearance-settings")
  const presentTour = useOnboardingTourPresenter()

  const pushKind = useCallback((kind: DetailKind) => {
    useNavStore.getState().push({ kind })
  }, [])

  const openUrl = useCallback(
    (url: string) => {
      void openExternal?.open(url)
    },
    [openExternal],
  )

  const localeName =
    supportedLocales.find((entry) => entry.code === locale)?.nativeName ?? locale
  const appearanceName = tAppearance(`option.${appearance}`)
  const signedOut = !isAuthenticated && !isPending

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {signedOut ? (
        <View style={styles.promptBox}>
          <SignInPrompt
            icon={iconMap.Settings}
            iconSize={32}
            variant="detail"
            title={t("signedOut.title")}
            body={t("signedOut.body")}
            onSignIn={() => requireAuth(() => {}, { next: "/settings" })}
          />
        </View>
      ) : null}

      {signedOut ? null : (
        <SettingsSection label={t("section.account")}>
          <SettingsRow
            icon="AtSign"
            label={t("account.label")}
            sub={t("account.sub")}
            onPress={() => pushKind("settings-account")}
          />
          <SettingsRow
            icon="Bell"
            label={t("notifications.label")}
            sub={t("notifications.sub")}
            onPress={() => pushKind("notification-prefs")}
          />
          <SettingsRow
            icon="ShieldCheck"
            label={t("privacy.label")}
            sub={t("privacy.sub")}
            onPress={() => pushKind("settings-privacy")}
          />
          <SettingsRow
            icon="ReceiptText"
            label={t("donations.label")}
            sub={t("donations.sub")}
            onPress={() => pushKind("my-donations")}
          />
        </SettingsSection>
      )}

      <SettingsSection label={t("section.app")} style={signedOut ? undefined : styles.sectionGap}>
        <SettingsRow
          icon="Languages"
          label={t("language.label")}
          value={localeName}
          onPress={() => pushKind("language-settings")}
        />
        <SettingsRow
          icon="SunMoon"
          label={t("appearance.label")}
          value={appearanceName}
          onPress={() => pushKind("appearance-settings")}
        />
        {presentTour ? (
          <SettingsRow
            icon="Compass"
            label={t("tour.label")}
            sub={t("tour.sub")}
            onPress={presentTour}
          />
        ) : null}
      </SettingsSection>

      <SettingsSection label={t("section.about")} style={styles.sectionGap}>
        <SettingsRow icon="Heart" label={t("support_civfix")} onPress={() => openUrl(DONATE_URL)} />
        <SettingsRow icon="FileText" label={t("terms")} onPress={() => openUrl(TERMS_URL)} />
        <SettingsRow icon="Lock" label={t("privacy_policy")} onPress={() => openUrl(PRIVACY_URL)} />
      </SettingsSection>

      {signedOut ? null : (
        <SettingsSection style={styles.sectionGap}>
          <SettingsRow
            icon="LogOut"
            label={t("sign_out")}
            variant="destructive"
            onPress={() => void logout()}
          />
        </SettingsSection>
      )}
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
  promptBox: {
    minHeight: 300,
    marginBottom: theme.space["6"],
  },
  sectionGap: {
    marginTop: theme.space["6"],
  },
})
