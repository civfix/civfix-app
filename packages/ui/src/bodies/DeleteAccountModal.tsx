import { useEffect, useRef, useState } from "react"
import {
  View,
  Pressable,
  StyleSheet,
  Platform,
  type TextInput as RNTextInput,
  type ViewStyle,
} from "react-native"
import { TextInput } from "../primitives/TextInput"
import { tokens } from "@civfix/shared/tokens"
import { makeThemedStyles, useTheme, webInputReset, focusRingProps } from "../theme"
import { Text } from "../typography"
import { ModalCardSheet, PrimaryButton, SecondaryButton } from "../primitives"
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
      headerIconColor={th.colors.brand.bloom}
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
              onPress={confirmDelete}
              loading={del.isPending}
              disabled={code.length !== 6}
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
            <Text style={styles.email}>{masked}</Text>
            {t("intro.sendPost")}
          </Text>
        ) : (
          <Text style={styles.body}>{t("noEmail.body")}</Text>
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
        </>
      )}
    </ModalCardSheet>
  )
}


const useStyles = makeThemedStyles((t) => ({
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
}))
