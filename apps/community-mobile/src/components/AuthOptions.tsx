import React, { useCallback, useEffect, useState } from "react"
import { View, Platform } from "react-native"
import { useRouter, useLocalSearchParams, usePathname } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { Apple, Globe, Mail } from "lucide-react-native/icons"
import * as AppleAuthentication from "expo-apple-authentication"
import {
  GoogleSignin,
  isSuccessResponse,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin"
import type { OAuthProvider } from "@civfix/shared"
import { makeThemedStyles, useTheme } from "@/theme"
import { KeyboardRevealGroup, Text, PrimaryButton, TextField, announce } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { signInWithApple, signInWithGoogle, requestEmailOtp } from "@/auth/signIn"
import { friendlyError, oauthError } from "@/lib/errors"
import { HOME_HREF } from "@/lib/goHome"
import { shouldReplaceOnSignIn } from "@/lib/authResume"
import { toResumeHref } from "@/lib/links"
import { GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID } from "@/config"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Busy = "apple" | "google" | "email" | null

function isAppleCancel(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code?: string }).code === "ERR_REQUEST_CANCELED"
  )
}

function isGoogleCancel(err: unknown): boolean {
  return isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED
}

export function AuthOptions({
  enabled,
  onHandoff,
  next: nextProp,
}: {
  enabled: readonly OAuthProvider[]
  onHandoff?: () => void
  next?: string
}) {
  const { t } = useT("mobile-auth-signin")
  const th = useTheme()
  const styles = useStyles()
  const router = useRouter()
  const pathname = usePathname()
  const params = useLocalSearchParams<{ next?: string }>()
  const next = toResumeHref(nextProp ?? params.next) ?? HOME_HREF

  const [email, setEmail] = useState("")
  const [emailMode, setEmailMode] = useState(false)
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (error) announce(error)
  }, [error])

  const goNext = useCallback(() => {
    if (!shouldReplaceOnSignIn(pathname, next)) return
    router.replace(next)
  }, [router, next, pathname])

  const runProviderSignIn = useCallback(
    async (
      provider: Exclude<Busy, "email" | null>,
      label: "Apple" | "Google",
      signIn: () => Promise<boolean>,
      isCancel: (err: unknown) => boolean,
    ) => {
      setError(null)
      setBusy(provider)
      try {
        if (await signIn()) goNext()
      } catch (err) {
        if (!isCancel(err)) setError(oauthError(t, label, err))
      } finally {
        setBusy(null)
      }
    },
    [goNext, t],
  )

  const onApple = useCallback(
    () =>
      runProviderSignIn(
        "apple",
        "Apple",
        async () => {
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          })
          if (!credential.identityToken) {
            throw new Error("Apple did not return an identity token.")
          }
          const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
            .filter(Boolean)
            .join(" ")
          await signInWithApple({
            identityToken: credential.identityToken,
            ...(fullName ? { fullName } : {}),
          })
          return true
        },
        isAppleCancel,
      ),
    [runProviderSignIn],
  )

  const onGoogle = useCallback(
    () =>
      runProviderSignIn(
        "google",
        "Google",
        async () => {
          GoogleSignin.configure({
            ...(GOOGLE_WEB_CLIENT_ID ? { webClientId: GOOGLE_WEB_CLIENT_ID } : {}),
            ...(Platform.OS === "ios" && GOOGLE_IOS_CLIENT_ID
              ? { iosClientId: GOOGLE_IOS_CLIENT_ID }
              : {}),
          })
          await GoogleSignin.hasPlayServices()
          const response = await GoogleSignin.signIn()
          if (!isSuccessResponse(response)) return false
          const idToken = response.data.idToken
          if (!idToken) {
            throw new Error("Google did not return an id token.")
          }
          await signInWithGoogle({ idToken })
          return true
        },
        isGoogleCancel,
      ),
    [runProviderSignIn],
  )

  const onEmail = useCallback(async () => {
    setError(null)
    const trimmed = email.trim().toLowerCase()
    if (!EMAIL_RE.test(trimmed)) {
      setError(t("email.invalid"))
      return
    }
    setBusy("email")
    try {
      const resendAfterSec = await requestEmailOtp({ email: trimmed })
      onHandoff?.()
      router.push({
        pathname: "/auth/otp",
        params: { email: trimmed, next: String(next), resendAfterSec: String(resendAfterSec) },
      })
    } catch (err) {
      setError(friendlyError(t, err))
    } finally {
      setBusy(null)
    }
  }, [email, router, next, onHandoff, t])

  const showApple = enabled.includes("apple") && Platform.OS === "ios"
  const showGoogle = enabled.includes("google") && !!GOOGLE_WEB_CLIENT_ID
  const showEmail = enabled.includes("email")

  return (
    <View style={styles.actions}>
      {showApple ? (
        <PrimaryButton
          label={t("button.apple")}
          variant="dark"
          icon={Apple}
          loading={busy === "apple"}
          disabled={busy !== null && busy !== "apple"}
          onPress={onApple}
        />
      ) : null}

      {showGoogle ? (
        <PrimaryButton
          label={t("button.google")}
          variant="outline"
          icon={Globe}
          loading={busy === "google"}
          disabled={busy !== null && busy !== "google"}
          onPress={onGoogle}
        />
      ) : null}

      {showEmail && !emailMode ? (
        <PrimaryButton
          label={t("button.email")}
          variant="outline"
          icon={Mail}
          disabled={busy !== null}
          onPress={() => {
            setError(null)
            setEmailMode(true)
          }}
        />
      ) : null}

      {showEmail && emailMode ? (
        <KeyboardRevealGroup style={styles.emailBlock}>
          <TextField
            label={t("email.label")}
            placeholder={t("email.placeholder")}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="go"
            autoFocus
            onSubmitEditing={onEmail}
          />
          <PrimaryButton
            label={t("email.send_code")}
            loading={busy === "email"}
            onPress={onEmail}
            style={styles.sendBtn}
          />
        </KeyboardRevealGroup>
      ) : null}

      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={16} color={th.colors.dangerInk} />
          <Text variant="caption" color={th.colors.dangerInk} style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}

      <View style={styles.privacyRow}>
        <Ionicons name="lock-closed-outline" size={13} color={th.colors.textSubtle} />
        <Text variant="caption" style={styles.privacy}>
          {t("privacy.disclaimer")}
        </Text>
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  actions: {
    gap: t.space["3"],
  },
  emailBlock: {
    gap: t.space["3"],
  },
  sendBtn: {
    marginTop: t.space["1"],
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: t.space["2"],
    paddingHorizontal: t.space["1"],
  },
  errorText: {
    flex: 1,
    lineHeight: 17,
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: t.space["2"],
  },
  privacy: {
    textAlign: "center",
  },
}))
