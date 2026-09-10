import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View, Pressable, KeyboardAvoidingView, Platform, AppState, useWindowDimensions } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import {
  REVIEWER_OTP_CODE_MAX_LENGTH,
  REVIEWER_OTP_CODE_MIN_LENGTH,
  REVIEWER_OTP_EMAIL,
} from "@civfix/shared"
import { makeThemedStyles, useTheme } from "@/theme"
import {
  PLAIN_SCROLL_HOST,
  PrimaryButton,
  SegmentedCodeInput,
  Text,
  TextField,
  makeKeyboardAwareScrollHost,
  type SegmentedCodeInputHandle,
} from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { ScreenHeader } from "@/components/ui/ScreenHeader"
import { requestEmailOtp, verifyEmailOtp } from "@/hooks/useAuthFlow"
import { errorMessage, friendlyError, isRateLimited } from "@/lib/errors"
import { HOME_HREF, goHome } from "@/lib/goHome"
import { toResumeHref } from "@/lib/links"
import {
  DEFAULT_RESEND_COOLDOWN_SEC,
  canResend,
  parseResendAfterSec,
  resendDeadline,
  resendSecondsLeft,
} from "@/lib/otpCooldown"

const { ScrollView: OtpScrollView } = makeKeyboardAwareScrollHost(PLAIN_SCROLL_HOST)

const MAX_ATTEMPTS = 3
const CODE_LENGTH = 6

export default function OtpScreen() {
  const { t } = useT("mobile-auth-otp")
  const styles = useStyles()
  const th = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const landscape = width > height
  const params = useLocalSearchParams<{ email?: string; next?: string; resendAfterSec?: string }>()
  const email = params.email ?? ""
  const next = toResumeHref(params.next) ?? HOME_HREF
  const reviewer = email.trim().toLowerCase() === REVIEWER_OTP_EMAIL

  const initialCooldown = parseResendAfterSec(params.resendAfterSec)

  const [code, setCode] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [locked, setLocked] = useState(false)
  const [availableAt, setAvailableAt] = useState(() => resendDeadline(Date.now(), initialCooldown))
  const [cooldown, setCooldown] = useState(initialCooldown)
  const [refocusNonce, setRefocusNonce] = useState(0)

  const codeRef = useRef<SegmentedCodeInputHandle>(null)

  useEffect(() => {
    const sync = (): number => {
      const left = resendSecondsLeft(availableAt, Date.now())
      setCooldown(left)
      return left
    }
    if (sync() === 0) return

    const tick = setInterval(() => {
      if (sync() === 0) clearInterval(tick)
    }, 1000)
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync()
    })

    return () => {
      clearInterval(tick)
      subscription.remove()
    }
  }, [availableAt])

  useEffect(() => {
    if (refocusNonce === 0) return
    codeRef.current?.focus()
  }, [refocusNonce])

  const attemptsLeft = useMemo(() => Math.max(0, MAX_ATTEMPTS - attempts), [attempts])

  const onVerify = useCallback(
    async (submitted: string) => {
      if (locked || verifying) return
      const submittedCode = reviewer ? submitted.trim() : submitted
      const incomplete = reviewer
        ? submittedCode.length < REVIEWER_OTP_CODE_MIN_LENGTH
        : submittedCode.length !== CODE_LENGTH
      if (incomplete) {
        setError(t(reviewer ? "verify.too_short" : "verify.incomplete"))
        return
      }
      setError(null)
      setVerifying(true)
      try {
        await verifyEmailOtp({ email, code: submittedCode })
        goHome(router)
        if (next !== HOME_HREF) router.push(next)
      } catch (err) {
        if (isRateLimited(err)) {
          setLocked(true)
          setError(t("verify.rate_limited"))
          setCode("")
          return
        }
        const reason = errorMessage(err, t("verify.fallback_reason"))
        const nextAttempts = attempts + 1
        setAttempts(nextAttempts)
        setCode("")
        if (nextAttempts >= MAX_ATTEMPTS) {
          setLocked(true)
          setError(t("verify.locked", { reason }))
        } else {
          const remaining = MAX_ATTEMPTS - nextAttempts
          setError(t("verify.wrong_with_attempts", { reason, count: remaining }))
          setRefocusNonce((n) => n + 1)
        }
      } finally {
        setVerifying(false)
      }
    },
    [attempts, email, locked, next, reviewer, router, t, verifying],
  )

  const onResend = useCallback(async () => {
    if (!canResend(availableAt, Date.now()) || resending) return
    setError(null)
    setResending(true)
    try {
      const resendAfter = await requestEmailOtp({ email })
      setAttempts(0)
      setLocked(false)
      setCode("")
      setAvailableAt(
        resendDeadline(Date.now(), resendAfter > 0 ? resendAfter : DEFAULT_RESEND_COOLDOWN_SEC),
      )
      setRefocusNonce((n) => n + 1)
    } catch (err) {
      setError(friendlyError(t, err))
    } finally {
      setResending(false)
    }
  }, [availableAt, email, resending, t])

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader />
      <OtpScrollView
        contentContainerStyle={[
          styles.scroll,
          landscape && styles.scrollLandscape,
          { paddingBottom: insets.bottom + th.space["8"] },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={[styles.iconWrap, landscape && styles.iconWrapLandscape]}>
            <Ionicons name="mail-open-outline" size={28} color={th.colors.brand.bloom} />
          </View>

          <Text variant="display" style={styles.title}>
            {t("title")}
          </Text>
          <Text variant="body" color={th.colors.textMuted} style={styles.subtitle}>
            {reviewer ? t("reviewer.subtitle") : t("subtitle")}
          </Text>
          <Text variant="bodyStrong" style={styles.email}>
            {email}
          </Text>

          <View
            style={[
              styles.codeWrap,
              landscape && styles.codeWrapLandscape,
              reviewer && styles.codeWrapReviewer,
            ]}
          >
            {reviewer ? (
              <TextField
                label={t("reviewer.label")}
                placeholder={t("reviewer.placeholder")}
                helper={t("reviewer.helper")}
                value={code}
                onChangeText={(next) => {
                  setError(null)
                  setCode(next)
                }}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
                maxLength={REVIEWER_OTP_CODE_MAX_LENGTH}
                returnKeyType="go"
                onSubmitEditing={() => onVerify(code)}
                editable={!locked && !verifying}
                autoFocus
              />
            ) : (
              <SegmentedCodeInput
                ref={codeRef}
                value={code}
                onChangeText={(next) => {
                  setError(null)
                  setCode(next)
                }}
                length={CODE_LENGTH}
                onComplete={onVerify}
                editable={!locked && !verifying}
              />
            )}
          </View>

          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={16} color={th.colors.bloom["600"]} />
              <Text variant="caption" color={th.colors.bloom["700"]} style={styles.errorText}>
                {error}
              </Text>
            </View>
          ) : !locked && attempts > 0 ? (
            <Text variant="caption" style={styles.attemptsHint}>
              {t("attempts_left", { count: attemptsLeft })}
            </Text>
          ) : null}

          <PrimaryButton
            label={t("verify.label")}
            loading={verifying}
            disabled={
              locked ||
              (reviewer
                ? code.trim().length < REVIEWER_OTP_CODE_MIN_LENGTH
                : code.length !== CODE_LENGTH)
            }
            onPress={() => onVerify(code)}
            style={styles.verifyBtn}
          />

          <View style={styles.resendRow}>
            <Text variant="caption" color={th.colors.textSubtle}>
              {t("resend.prompt")}
            </Text>
            <Pressable onPress={onResend} disabled={cooldown > 0 || resending} hitSlop={8}>
              <Text
                variant="caption"
                color={cooldown > 0 ? th.colors.textSubtle : th.colors.brand.bloom}
                style={styles.resendText}
              >
                {cooldown > 0
                  ? t("resend.cooldown", { cooldown })
                  : resending
                    ? t("resend.sending")
                    : t("resend.action")}
              </Text>
            </Pressable>
          </View>
        </View>
      </OtpScrollView>
    </KeyboardAvoidingView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.bg },
  scroll: {
    paddingHorizontal: t.space["6"],
    paddingTop: t.space["4"],
    alignItems: "center",
    flexGrow: 1,
  },
  scrollLandscape: {
    justifyContent: "center",
  },
  content: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: t.colors.bloom["50"],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: t.space["5"],
  },
  iconWrapLandscape: {
    marginBottom: t.space["3"],
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    marginTop: t.space["3"],
    textAlign: "center",
  },
  email: {
    marginTop: 2,
    textAlign: "center",
  },
  codeWrap: {
    marginTop: t.space["8"],
    alignItems: "center",
  },
  codeWrapLandscape: {
    marginTop: t.space["5"],
  },
  codeWrapReviewer: {
    width: "100%",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: t.space["2"],
    marginTop: t.space["4"],
    paddingHorizontal: t.space["1"],
  },
  errorText: {
    flex: 1,
    lineHeight: 17,
  },
  attemptsHint: {
    marginTop: t.space["4"],
  },
  verifyBtn: {
    marginTop: t.space["6"],
    width: "100%",
  },
  resendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: t.space["5"],
  },
  resendText: {
    fontFamily: t.fontFamily.bodySemiBold,
  },
}))
