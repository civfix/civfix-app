import { useEffect, useRef, useState } from "react"
import { View, Pressable, StyleSheet, type TextInput as RNTextInput } from "react-native"
import { TextInput } from "../primitives/TextInput"
import { makeThemedStyles, useTheme, webInputReset, focusRingProps, inputFocusedStyle } from "../theme"
import { Text } from "../typography"
import { ModalCardSheet, PrimaryButton, SecondaryButton } from "../primitives"
import { MODAL_DISMISS_FOCUS_DELAY_MS } from "./modalFocusDelay"
import { useRequestEmailCode, useDeleteAccount } from "../data"
import { ErrorCode, errorCopyKey, type ErrorCodeTable } from "@civfix/shared"
import { useT } from "../i18n"

type TFn = (key: string, opts?: Record<string, unknown>) => string

const EMAIL_OTP_LENGTH = 6

export interface DeleteAccountModalProps {
  visible: boolean
  email: string | null | undefined
  onClose: () => void
}

const SEND_ERROR_KEYS: ErrorCodeTable<string> = {
  [ErrorCode.RATE_LIMITED]: "sendError.rateLimited",
  [ErrorCode.VALIDATION]: "sendError.validation",
}

const DELETE_ERROR_KEYS: ErrorCodeTable<string> = {
  [ErrorCode.UNAUTHORIZED]: "deleteError.unauthorized",
  [ErrorCode.RATE_LIMITED]: "deleteError.rateLimited",
  [ErrorCode.VALIDATION]: "deleteError.validation",
}

function sendErrorMessage(err: unknown, t: TFn): string {
  return t(errorCopyKey(err, SEND_ERROR_KEYS, "sendError.generic"))
}

function deleteErrorMessage(err: unknown, t: TFn): string {
  return t(errorCopyKey(err, DELETE_ERROR_KEYS, "deleteError.generic"))
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
  const [codeFocusRequest, setCodeFocusRequest] = useState(0)
  const codeRef = useRef<RNTextInput>(null)

  useEffect(() => {
    if (visible) {
      setStep("intro")
      setCode("")
      setError(null)
    }
  }, [visible])

  useEffect(() => {
    if (!visible || codeFocusRequest === 0) return
    const timer = setTimeout(() => codeRef.current?.focus(), MODAL_DISMISS_FOCUS_DELAY_MS)
    return () => clearTimeout(timer)
  }, [visible, codeFocusRequest])

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
          setCodeFocusRequest((n) => n + 1)
        },
        onError: (e) => setError(sendErrorMessage(e, t)),
      },
    )
  }

  const confirmDelete = () => {
    if (code.length !== EMAIL_OTP_LENGTH || del.isPending) return
    setError(null)
    del.mutate(
      { emailOtp: code },
      {
        onError: (e) => setError(deleteErrorMessage(e, t)),
      },
    )
  }

  const emailLabel = email ?? t("emailFallback")

  const introActions = hasEmail ? (
    <>
      <SecondaryButton label={t("actions.cancel")} onPress={onClose} size="sm" />
      <PrimaryButton
        label={t("actions.emailCode")}
        onPress={sendCode}
        loading={requestCode.isPending}
        accessibilityLabel={t("a11y.emailCode")}
      />
    </>
  ) : (
    <SecondaryButton label={t("actions.close")} onPress={onClose} size="sm" />
  )

  return (
    <ModalCardSheet
      visible={visible}
      onClose={onClose}
      headerIcon="Trash2"
      tone="danger"
      title={t("title")}
      dismissLabel={t("a11y.dismiss")}
      error={error}
      actions={
        step === "intro" ? (
          introActions
        ) : (
          <>
            <SecondaryButton label={t("actions.cancel")} onPress={onClose} size="sm" />
            <PrimaryButton
              label={t("actions.deleteConfirm")}
              variant="destructive"
              onPress={confirmDelete}
              loading={del.isPending}
              disabled={code.length !== EMAIL_OTP_LENGTH}
              accessibilityLabel={t("a11y.deleteConfirm")}
            />
          </>
        )
      }
    >
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
          <Text style={styles.body}>
            {t("intro.sendPre")}
            <Text style={styles.email}>{emailLabel}</Text>
            {t("intro.sendPost")}
          </Text>
        ) : (
          <Text style={styles.body}>{t("noEmail.body")}</Text>
        )
      ) : (
        <>
          <Text style={styles.body}>
            {t("verify.enterPre")}
            <Text style={styles.email}>{emailLabel}</Text>
            {t("verify.enterPost")}
          </Text>
          <TextInput
            ref={codeRef}
            value={code}
            onChangeText={(txt) => setCode(txt.replace(/[^0-9]/g, "").slice(0, EMAIL_OTP_LENGTH))}
            editable={!del.isPending}
            keyboardType="number-pad"
            inputMode="numeric"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={EMAIL_OTP_LENGTH}
            placeholder="000000"
            placeholderTextColor={th.colors.textSubtle}
            accessibilityLabel={t("a11y.verificationCode")}
            onFocus={() => setCodeFocused(true)}
            onBlur={() => setCodeFocused(false)}
            style={[webInputReset, styles.codeInput, codeFocused ? styles.codeInputFocused : null]}
          />
          <Pressable
            onPress={sendCode}
            disabled={requestCode.isPending}
            accessibilityRole="button"
            accessibilityLabel={t("actions.resend")}
            accessibilityState={{ disabled: requestCode.isPending, busy: requestCode.isPending }}
            {...focusRingProps}
            style={styles.resend}
          >
            <Text style={[styles.resendText, requestCode.isPending ? styles.resendDisabled : null]}>
              {requestCode.isPending ? t("actions.sending") : t("actions.resend")}
            </Text>
          </Pressable>
        </>
      )}
    </ModalCardSheet>
  )
}

const useStyles = makeThemedStyles((t) => ({
  warnBox: {
    gap: t.space["1"],
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.bloom["50"],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.bloom["100"],
  },
  warnText: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    lineHeight: 18,
    color: t.colors.dangerInk,
  },
  warnStrong: {
    fontFamily: t.fontFamily.bodyExtraBold,
    color: t.colors.dangerInk,
  },
  warnSub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    lineHeight: 16,
    color: t.colors.dangerInk,
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
  codeInputFocused: inputFocusedStyle(t),
  resend: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  resendText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 12.5,
    color: t.colors.accentText,
  },
  resendDisabled: {
    color: t.colors.textSubtle,
  },
}))
