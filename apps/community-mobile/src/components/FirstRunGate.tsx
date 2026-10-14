import React, { useCallback, useEffect, useMemo, useState } from "react"
import { View, StyleSheet, ActivityIndicator, Pressable } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Ionicons from "@expo/vector-icons/Ionicons"
import { HANDLE_MAX_LENGTH } from "@civfix/shared"
import { MIN_TOUCH_TARGET, makeThemedStyles, space, useTheme } from "@/theme"
import {
  AgeConfirmation,
  Avatar,
  IosKeyboardAvoidingView,
  KeyboardPinnedFooter,
  KeyboardPinnedSurface,
  PLAIN_SCROLL_HOST,
  PrimaryButton,
  TermsConfirmation,
  Text,
  TextField,
  announce,
  makeKeyboardAwareScrollHost,
} from "@civfix/ui"
import {
  FIRST_NAME_MAX,
  LAST_NAME_MAX,
  firstRunModel,
  splitName,
  stripHandlePrefix,
  useHandleAvailabilityCheck,
} from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"
import { api } from "@/api/client"
import { useAuthStore } from "@/store/authStore"
import { friendlyError } from "@/lib/errors"

const { ScrollView: FirstRunScrollView } = makeKeyboardAwareScrollHost(PLAIN_SCROLL_HOST)

export function FirstRunGate() {
  const status = useAuthStore((s) => s.status)
  const incomplete = useAuthStore((s) => s.user?.profileComplete === false)
  if (status !== "authed" || !incomplete) return null
  return <FirstRunForm />
}

function FirstRunForm() {
  const { t } = useT("mobile-auth-registration")
  const th = useTheme()
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const signOut = useAuthStore((s) => s.signOut)

  const seeded = useMemo(() => splitName(user?.displayName ?? ""), [user?.displayName])
  const [first, setFirst] = useState(seeded.first)
  const [last, setLast] = useState(seeded.last)
  const [handle, setHandle] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [termsConfirmed, setTermsConfirmed] = useState(false)

  const { availability, checkedHandle } = useHandleAvailabilityCheck(handle, null)
  const { refetch: recheckHandle } = availability
  const {
    trimmedHandle,
    handleValid,
    displayName,
    previewName,
    checking,
    available,
    taken,
    checkFailed,
    canSubmit,
  } = firstRunModel({
    first,
    last,
    handle,
    checkedHandle,
    availability,
    ageConfirmed,
    termsConfirmed,
    submitting,
  })

  const retryHandleCheck = useCallback(() => void recheckHandle(), [recheckHandle])

  useEffect(() => {
    if (error) announce(error)
  }, [error])

  useEffect(() => {
    if (checkFailed) announce(t("handle.check_failed"))
  }, [checkFailed, t])

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await api.updateProfile({ handle: trimmedHandle, displayName })
      setUser(res.user)
    } catch (err) {
      setError(friendlyError(t, err))
    } finally {
      setSubmitting(false)
    }
  }, [canSubmit, trimmedHandle, displayName, setUser, t])

  return (
    <View style={styles.overlay}>
      <IosKeyboardAvoidingView style={styles.root}>
        <KeyboardPinnedSurface>
          <FirstRunScrollView
            contentContainerStyle={[styles.scroll, { paddingTop: insets.top + space["6"] }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.head}>
              <Avatar name={previewName} seed={user?.id} photoUrl={user?.avatarUrl} size={76} />
              <Text variant="title" style={styles.title}>
                {t("title")}
              </Text>
              <Text variant="body" color={th.colors.textSubtle} style={styles.sub}>
                {t("subtitle")}
              </Text>
            </View>

            <View style={styles.row}>
              <View style={styles.col}>
                <TextField
                  label={t("field.first_name.label")}
                  placeholder={t("field.first_name.placeholder")}
                  value={first}
                  onChangeText={setFirst}
                  maxLength={FIRST_NAME_MAX}
                  autoComplete="given-name"
                />
              </View>
              <View style={styles.col}>
                <TextField
                  label={t("field.last_name.label")}
                  placeholder={t("field.last_name.placeholder")}
                  value={last}
                  onChangeText={setLast}
                  maxLength={LAST_NAME_MAX}
                  autoComplete="family-name"
                />
              </View>
            </View>

            <TextField
              label={t("field.username.label")}
              placeholder={t("field.username.placeholder")}
              value={handle}
              onChangeText={(text) => setHandle(stripHandlePrefix(text))}
              maxLength={HANDLE_MAX_LENGTH}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <HandleHint
              handle={trimmedHandle}
              valid={handleValid}
              checking={checking}
              available={available}
              taken={taken}
              checkFailed={checkFailed}
              onRetry={retryHandleCheck}
            />

            {error ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={16} color={th.colors.dangerInk} />
                <Text variant="caption" color={th.colors.dangerInk}>
                  {error}
                </Text>
              </View>
            ) : null}

            <View style={styles.ageGate}>
              <AgeConfirmation confirmed={ageConfirmed} onConfirmedChange={setAgeConfirmed} />
              <TermsConfirmation confirmed={termsConfirmed} onConfirmedChange={setTermsConfirmed} />
            </View>
          </FirstRunScrollView>

          <KeyboardPinnedFooter style={styles.footer} safeAreaBottom={insets.bottom}>
            <PrimaryButton label={t("continue")} loading={submitting} disabled={!canSubmit} onPress={() => void onSubmit()} />
            <Pressable
              onPress={() => void signOut()}
              accessibilityRole="button"
              accessibilityLabel={t("signout.action")}
              hitSlop={8}
              style={({ pressed }) => [styles.signOut, pressed ? styles.signOutPressed : null]}
            >
              <Text variant="caption" color={th.colors.textSubtle} style={styles.signOutText}>
                {t("signout.prompt")} {t("signout.action")}
              </Text>
            </Pressable>
          </KeyboardPinnedFooter>
        </KeyboardPinnedSurface>
      </IosKeyboardAvoidingView>
    </View>
  )
}

function HandleHint({
  handle,
  valid,
  checking,
  available,
  taken,
  checkFailed,
  onRetry,
}: {
  handle: string
  valid: boolean
  checking: boolean
  available: boolean
  taken: boolean
  checkFailed: boolean
  onRetry: () => void
}) {
  const { t } = useT("mobile-auth-registration")
  const th = useTheme()
  const styles = useStyles()
  let content: React.ReactNode = t("handle.rule")
  let color: string = th.colors.textSubtle
  if (handle && !valid) {
    content = t("handle.rule_invalid")
    color = th.colors.brand.bloom
  } else if (checking) {
    content = t("handle.checking")
  } else if (available) {
    content = t("handle.available", { handle })
    color = th.colors.successInk
  } else if (taken) {
    content = t("handle.taken", { handle })
    color = th.colors.brand.bloom
  } else if (checkFailed) {
    content = t("handle.check_failed")
    color = th.colors.dangerInk
  }
  return (
    <View style={styles.hintRow}>
      {checking ? <ActivityIndicator size="small" color={th.colors.textSubtle} /> : null}
      <Text variant="caption" color={color}>
        {content}
      </Text>
      {checkFailed && !checking ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          style={({ pressed }) => [styles.retryTarget, pressed ? styles.retryPressed : null]}
        >
          <Text variant="caption" color={th.colors.accentText} style={styles.retryText}>
            {t("handle.retry")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.bg,
    zIndex: 50,
    elevation: 50,
  },
  root: { flex: 1, backgroundColor: t.colors.bg },
  scroll: {
    paddingHorizontal: t.space["5"],
    paddingBottom: t.space["8"],
    gap: t.space["4"],
  },
  head: { alignItems: "center", gap: t.space["2"], marginBottom: t.space["2"] },
  title: { textAlign: "center", marginTop: t.space["2"] },
  sub: { textAlign: "center" },
  row: { flexDirection: "row", gap: t.space["3"] },
  col: { flex: 1 },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: -t.space["2"] },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ageGate: { marginTop: t.space["2"], gap: t.space["2"] },
  footer: {
    paddingHorizontal: t.space["5"],
    paddingTop: t.space["3"],
    paddingBottom: t.space["3"],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
    backgroundColor: t.colors.bg,
  },
  signOut: { alignSelf: "center", marginTop: t.space["3"] },
  signOutPressed: { opacity: 0.6 },
  signOutText: { textAlign: "center" },
  retryTarget: { minHeight: MIN_TOUCH_TARGET, justifyContent: "center", paddingHorizontal: t.space["2"] },
  retryText: { fontFamily: t.fontFamily.bodySemiBold },
  retryPressed: { opacity: 0.6 },
}))
