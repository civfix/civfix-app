import { useEffect, useRef, useState } from "react"
import {
  Modal,
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  type TextInput as RNTextInput,
  type ViewStyle,
} from "react-native"
import { tokens } from "@civfix/shared/tokens"
import { makeThemedStyles, useTheme, webInputReset, focusRingProps, webScrimProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { PrimaryButton, SecondaryButton } from "../primitives"
import { useKeyboardReserve } from "../shell/useKeyboardReserve"
import { useRequestEmailCode, useDeleteAccount } from "../data"
import { appErrorCode } from "./errorCode"
import { useT } from "../i18n"

type TFn = (key: string, opts?: Record<string, unknown>) => string

export interface DeleteAccountModalProps {
  visible: boolean
  email: string | null | undefined
  onClose: () => void
}

function sendErrorMessage(err: unknown, t: TFn): string {
  switch (appErrorCode(err)) {
    case "RATE_LIMITED":
      return t("sendError.rateLimited")
    case "VALIDATION":
      return t("sendError.validation")
    default:
      return t("sendError.generic")
  }
}

function deleteErrorMessage(err: unknown, t: TFn): string {
  switch (appErrorCode(err)) {
    case "UNAUTHORIZED":
      return t("deleteError.unauthorized")
    case "RATE_LIMITED":
      return t("deleteError.rateLimited")
    case "VALIDATION":
      return t("deleteError.validation")
    default:
      return t("deleteError.generic")
  }
}

export function DeleteAccountModal({ visible, email, onClose }: DeleteAccountModalProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("account-delete")
  const requestCode = useRequestEmailCode()
  const del = useDeleteAccount()
  const [step, setStep] = useState<"intro" | "verify">("intro")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [codeFocused, setCodeFocused] = useState(false)
  const codeRef = useRef<RNTextInput>(null)
  const kbReserve = useKeyboardReserve({ enabled: visible })

  useEffect(() => {
    if (visible) {
      setStep("intro")
      setCode("")
      setError(null)
    }
  }, [visible])

  const hasEmail = !!email

  const sendCode = () => {
    if (!email || requestCode.isPending) return
    setError(null)
    requestCode.mutate(
      { email },
      {
        onSuccess: () => {
          setStep("verify")
          setCode("")
          setTimeout(() => codeRef.current?.focus(), 50)
        },
        onError: (e) => setError(sendErrorMessage(e, t)),
      },
    )
  }

  const confirmDelete = () => {
    if (code.length !== 6 || del.isPending) return
    setError(null)
    del.mutate(
      { emailOtp: code },
      {
        onError: (e) => setError(deleteErrorMessage(e, t)),
      },
    )
  }

  const masked = email ?? t("emailFallback")

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.dismiss")}
          onPress={onClose}
          {...webScrimProps}
        />
        <KeyboardAvoidingView
          style={[styles.avoider, kbReserve > 0 ? { paddingBottom: th.space["4"] + kbReserve } : null]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.card}>
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Icon icon={iconMap.Trash2} size={16} color={th.colors.brand.bloom} />
              </View>
              <Text variant="bodyStrong" color={th.colors.text} style={styles.title}>
                {t("title")}
              </Text>
            </View>

            <View style={styles.warnBox}>
              <Text style={styles.warnText}>
                {t("warn.permanentPre")}
                <Text style={styles.warnStrong}>{t("warn.permanentEmphasis")}</Text>
                {t("warn.permanentPost")}
              </Text>
              <Text style={styles.warnSub}>{t("warn.contentRemains")}</Text>
            </View>

            {step === "intro" ? (
              hasEmail ? (
                <>
                  <Text style={styles.body}>
                    {t("intro.sendPre")}
                    <Text style={styles.email}>{masked}</Text>
                    {t("intro.sendPost")}
                  </Text>
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <View style={styles.actions}>
                    <SecondaryButton label={t("actions.cancel")} onPress={onClose} size="sm" />
                    <PrimaryButton
                      label={t("actions.emailCode")}
                      onPress={sendCode}
                      loading={requestCode.isPending}
                      accessibilityLabel={t("a11y.emailCode")}
                    />
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.body}>{t("noEmail.body")}</Text>
                  <View style={styles.actions}>
                    <SecondaryButton label={t("actions.close")} onPress={onClose} size="sm" />
                  </View>
                </>
              )
            ) : (
              <>
                <Text style={styles.body}>
                  {t("verify.enterPre")}
                  <Text style={styles.email}>{masked}</Text>
                  {t("verify.enterPost")}
                </Text>
                <TextInput
                  ref={codeRef}
                  value={code}
                  onChangeText={(txt) => setCode(txt.replace(/[^0-9]/g, "").slice(0, 6))}
                  editable={!del.isPending}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor={th.colors.textSubtle}
                  accessibilityLabel={t("a11y.verificationCode")}
                  onFocus={() => setCodeFocused(true)}
                  onBlur={() => setCodeFocused(false)}
                  style={[webInputReset, styles.codeInput, codeFocused ? styles.codeInputFocused : null]}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Pressable
                  onPress={sendCode}
                  disabled={requestCode.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={t("actions.resend")}
                  hitSlop={6}
                  {...focusRingProps}
                  style={styles.resend}
                >
                  <Text style={[styles.resendText, requestCode.isPending ? styles.resendDisabled : null]}>
                    {requestCode.isPending ? t("actions.sending") : t("actions.resend")}
                  </Text>
                </Pressable>
                <View style={styles.actions}>
                  <SecondaryButton label={t("actions.cancel")} onPress={onClose} size="sm" />
                  <PrimaryButton
                    label={t("actions.deleteConfirm")}
                    variant="destructive"
                    onPress={confirmDelete}
                    loading={del.isPending}
                    disabled={code.length !== 6}
                    accessibilityLabel={t("a11y.deleteConfirm")}
                  />
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    flex: 1,
  },
  avoider: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: t.space["4"],
    pointerEvents: "box-none",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.scrimModal,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    gap: t.space["3"],
    padding: t.space["4"],
    borderRadius: t.radius.xl,
    backgroundColor: t.colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: t.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bloom["50"],
  },
  title: {
    flex: 1,
  },
  warnBox: {
    gap: 4,
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.bloom["50"],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.bloom["100"],
  },
  warnText: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    color: t.colors.bloom["700"],
  },
  warnStrong: {
    fontFamily: t.fontFamily.bodyExtraBold,
    color: t.colors.bloom["700"],
  },
  warnSub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.bloom["600"],
  },
  body: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13.5,
    lineHeight: 19,
    color: t.colors.textMuted,
  },
  email: {
    fontFamily: t.fontFamily.bodyBold,
    color: t.colors.text,
  },
  codeInput: {
    height: 52,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surfaceTint,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    textAlign: "center",
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 22,
    letterSpacing: 8,
    color: t.colors.text,
  },
  codeInputFocused:
    Platform.OS === "web"
      ? ({ boxShadow: tokens.shadow.ring, borderColor: t.colors.accent } as ViewStyle)
      : { borderColor: t.colors.accent },
  resend: {
    alignSelf: "flex-start",
    paddingVertical: 2,
  },
  resendText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 12.5,
    color: t.colors.accentText,
  },
  resendDisabled: {
    color: t.colors.textSubtle,
  },
  error: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: t.colors.bloom["700"],
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: t.space["2"],
    marginTop: t.space["1"],
  },
}))
