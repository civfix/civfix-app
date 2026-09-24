import React, { useCallback } from "react"
import { ActivityIndicator, Pressable, View } from "react-native"
import { useGlobalSearchParams, usePathname } from "expo-router"
import { PRESSED_OPACITY, makeThemedStyles, useTheme } from "@/theme"
import {
  Text,
  Icon,
  iconMap,
  PrimaryButton,
  SecondaryButton,
  TERMS_URL,
  PRIVACY_URL,
  type IconName,
} from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { useHaptics, useOpenExternal } from "@civfix/ui/capabilities"
import { AuthOptions } from "@/components/AuthOptions"
import { hrefFromRoute } from "@/lib/authResume"
import { useSignInProviders } from "@/hooks/useAuthFlow"
import { useAuthStore } from "@/store/authStore"
import { ReadyStage } from "@/components/onboarding/stages/ReadyStage"
import {
  OnboardingPageFrame,
  type OnboardingPageProps,
} from "@/components/onboarding/pages/OnboardingPageFrame"

const LINK_HIT_SLOP = 6

const TRUST_ROWS: readonly { icon: IconName; key: string }[] = [
  { icon: "ShieldCheck", key: "ready.trust.nonprofit" },
  { icon: "Lock", key: "ready.trust.tracking" },
  { icon: "Image", key: "ready.trust.photos" },
]

function SignInOptions({ onHandoff }: { onHandoff: () => void }) {
  const th = useTheme()
  const styles = useStyles()
  const { ready, enabled } = useSignInProviders()
  const pathname = usePathname()
  const params = useGlobalSearchParams()
  const resumeHref = hrefFromRoute(pathname, params)
  if (!ready) {
    return (
      <View style={styles.optionsLoading}>
        <ActivityIndicator color={th.colors.brand.bloom} />
      </View>
    )
  }
  return (
    <AuthOptions
      enabled={enabled}
      onHandoff={onHandoff}
      next={resumeHref}
    />
  )
}

function TrustStrip() {
  const { t } = useT("mobile-onboarding")
  const th = useTheme()
  const styles = useStyles()
  return (
    <View style={styles.trust}>
      {TRUST_ROWS.map((row) => (
        <View key={row.key} style={styles.trustRow}>
          <Icon icon={iconMap[row.icon]} size={14} color={th.colors.textSubtle} />
          <Text variant="caption" color={th.colors.textSubtle} style={styles.trustLabel}>
            {t(row.key)}
          </Text>
        </View>
      ))}
    </View>
  )
}

function LegalLinks() {
  const { t } = useT("mobile-onboarding")
  const th = useTheme()
  const styles = useStyles()
  const { t: tLegal } = useT("onboarding-terms")
  const openExternal = useOpenExternal()
  const open = useCallback(
    (url: string) => {
      void openExternal?.open(url)
    },
    [openExternal],
  )
  return (
    <View style={styles.legal}>
      <Pressable
        onPress={() => open(TERMS_URL)}
        accessibilityRole="link"
        accessibilityLabel={tLegal("a11y.terms_link")}
        hitSlop={LINK_HIT_SLOP}
        style={({ pressed }) => [styles.legalLink, pressed ? styles.legalLinkPressed : null]}
      >
        <Text variant="caption" color={th.colors.accentText}>
          {t("ready.legal.terms")}
        </Text>
      </Pressable>
      <Text variant="caption" color={th.colors.textSubtle}>
        {t("ready.legal.separator")}
      </Text>
      <Pressable
        onPress={() => open(PRIVACY_URL)}
        accessibilityRole="link"
        accessibilityLabel={tLegal("a11y.privacy_link")}
        hitSlop={LINK_HIT_SLOP}
        style={({ pressed }) => [styles.legalLink, pressed ? styles.legalLinkPressed : null]}
      >
        <Text variant="caption" color={th.colors.accentText}>
          {t("ready.legal.privacy")}
        </Text>
      </Pressable>
    </View>
  )
}

export function ReadyPage({
  onComplete,
  ...props
}: OnboardingPageProps & { onComplete: () => void }) {
  const { t } = useT("mobile-onboarding")
  const styles = useStyles()
  const haptics = useHaptics()
  const authed = useAuthStore((s) => s.status) === "authed"

  const finish = useCallback(() => {
    haptics.success()
    onComplete()
  }, [haptics, onComplete])

  return (
    <OnboardingPageFrame
      {...props}
      stage={<ReadyStage active={props.active} reduceMotion={props.reduceMotion} />}
      title={authed ? t("ready.title_authed") : t("ready.title")}
      body={authed ? t("ready.body_authed") : t("ready.body")}
      avoidKeyboard
    >
      <View style={styles.actions}>
        {authed ? (
          <PrimaryButton label={t("nav.done")} onPress={finish} />
        ) : (
          <>
            <SignInOptions onHandoff={onComplete} />
            <SecondaryButton label={t("ready.guest")} size="lg" onPress={finish} />
          </>
        )}
      </View>
      <TrustStrip />
      <LegalLinks />
    </OnboardingPageFrame>
  )
}

const useStyles = makeThemedStyles((t) => ({
  actions: {
    alignSelf: "stretch",
    gap: t.space["3"],
    marginTop: t.space["2"],
  },
  optionsLoading: {
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  trust: {
    alignSelf: "stretch",
    gap: t.space["2"],
    marginTop: t.space["2"],
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: t.space["2"],
  },
  trustLabel: {
    flex: 1,
  },
  legal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  legalLink: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: t.space["2"],
  },
  legalLinkPressed: {
    opacity: PRESSED_OPACITY,
  },
}))
