import React, { useCallback, useEffect, useMemo, useState } from "react"
import { View, StyleSheet, ActivityIndicator, Pressable } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { isValidHandle } from "@civfix/shared"
import { makeThemedStyles, space, useTheme } from "@/theme"
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
  makeKeyboardAwareScrollHost,
} from "@civfix/ui"
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

function splitName(displayName: string): { first: string; last: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: "", last: "" }
  return { first: parts[0]!, last: parts.slice(1).join(" ") }
}

type Availability = { checking: boolean; available: boolean | null; reason: string | null }

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
  const [avail, setAvail] = useState<Availability>({ checking: false, available: null, reason: null })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [termsConfirmed, setTermsConfirmed] = useState(false)

  const trimmedHandle = handle.trim()
  const handleValid = isValidHandle(trimmedHandle)
  const displayName = `${first.trim()} ${last.trim()}`.trim()
  const available = handleValid && avail.available === true
  const canSubmit =
    available && displayName.length > 0 && ageConfirmed && termsConfirmed && !submitting

  useEffect(() => {
    if (!handleValid) {
      setAvail({ checking: false, available: null, reason: null })
      return
    }
    let cancelled = false
    setAvail({ checking: true, available: null, reason: null })
    const t = setTimeout(async () => {
      try {
        const res = await api.checkHandle({ handle: trimmedHandle })
        if (!cancelled) setAvail({ checking: false, available: res.available, reason: res.reason ?? null })
      } catch {
        if (!cancelled) setAvail({ checking: false, available: null, reason: null })
      }
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [trimmedHandle, handleValid])

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await api.updateProfile({ handle: trimmedHandle, displayName })
      setUser(res.user)
    } catch (err) {
      setError(friendlyError(t, err))
      setSubmitting(false)
    }
  }, [canSubmit, trimmedHandle, displayName, setUser, t])

  const previewName = trimmedHandle || displayName || "?"

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
                  maxLength={40}
                  autoComplete="given-name"
                />
              </View>
              <View style={styles.col}>
                <TextField
                  label={t("field.last_name.label")}
                  placeholder={t("field.last_name.placeholder")}
                  value={last}
                  onChangeText={setLast}
                  maxLength={40}
                  autoComplete="family-name"
                />
              </View>
            </View>

            <TextField
              label={t("field.username.label")}
              placeholder={t("field.username.placeholder")}
              value={handle}
              onChangeText={(t) => setHandle(t.replace(/^@+/, ""))}
              maxLength={20}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <HandleHint
              handle={trimmedHandle}
              valid={handleValid}
              checking={avail.checking}
              available={available}
              taken={handleValid && avail.available === false}
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
}: {
  handle: string
  valid: boolean
  checking: boolean
  available: boolean
  taken: boolean
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
  }
  return (
    <View style={styles.hintRow}>
      {checking ? <ActivityIndicator size="small" color={th.colors.textSubtle} /> : null}
      <Text variant="caption" color={color}>
        {content}
      </Text>
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
}))
