import React, { useCallback, useEffect, useMemo, useState } from "react"
import { View, Pressable } from "react-native"
import { TextInput } from "../../../primitives/TextInput"
import {
  MAX_GUEST_NAME,
  type EventAnswerValue,
  type EventQuestionDTO,
  type GuestContactChannel,
  type TicketTypeDTO,
} from "@civfix/shared"
import { makeThemedStyles, useTheme, webInputReset, focusRingProps } from "../../../theme"
import { Text, Icon, iconMap } from "../../../typography"
import { useT } from "../../../i18n"
import {
  useAuthState,
  useRequireAuth,
  useGetTurnstileToken,
  useGuestRsvpRequest,
  useGuestRsvpVerify,
} from "../../../data"
import { appErrorCode, appErrorFields } from "../../../data/errorCode"
import { TicketTypePicker } from "./TicketTypePicker"
import { PartySizeStepper, clampPartySize } from "./PartySizeStepper"
import { RegistrationQuestions } from "./RegistrationQuestions"
import { ConsentChecks } from "./ConsentChecks"
import {
  EMPTY_CONSENT,
  consentAccepted,
  consentPayload,
  type ConsentState,
} from "./consentModel"
import {
  answerPayload,
  missingRequired,
  visibleQuestions,
  type AnswerMap,
} from "./questionModel"
import { selectableTicketTypes } from "./registrationModel"
import { PrimaryButton } from "../../../primitives/PrimaryButton"
import { SecondaryButton } from "../../../primitives/SecondaryButton"
import { SegmentedCodeInput } from "../../../primitives/SegmentedCodeInput"
import { ModalCardSheet, modalSheetInputStyle, modalSheetInputFocusedStyle } from "../../../primitives/ModalCardSheet"
import {
  GUEST_EMAIL_MAX,
  GUEST_RSVP_CODE_LENGTH,
  GUEST_RSVP_TURNSTILE_ACTION,
  RESEND_COUNTDOWN_TICK_MS,
  answersWithDefaults,
  canSubmitGuestForm,
  effectiveTicketTypeId,
  emptyGuestRsvpForm,
  formatGuestPhone,
  guestAttemptsExhausted,
  guestContactPayload,
  guestNameValue,
  guestRequestErrorKey,
  guestResendReadyAt,
  guestResendSecondsLeft,
  guestRsvpCommitFor,
  guestSmsUnavailable,
  guestVerifyErrorKey,
  type GuestContactPayload,
  type GuestRsvpCommit,
  type GuestRsvpFormState,
  type GuestRsvpStep,
} from "./guestRsvpModel"

const CHANNELS: readonly GuestContactChannel[] = ["email", "sms"]

const NO_TICKET_TYPES: readonly TicketTypeDTO[] = []
const NO_QUESTIONS: readonly EventQuestionDTO[] = []

export interface GuestRsvpSheetProps {
  visible: boolean
  cleanupId: string
  nextPath: string
  onClose: () => void
  ticketTypes?: readonly TicketTypeDTO[]
  questions?: readonly EventQuestionDTO[]
}

export function GuestRsvpSheet({
  visible,
  cleanupId,
  nextPath,
  onClose,
  ticketTypes = NO_TICKET_TYPES,
  questions = NO_QUESTIONS,
}: GuestRsvpSheetProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-guest-rsvp")
  const requireAuth = useRequireAuth()
  const { guestSmsEnabled } = useAuthState()
  const getTurnstileToken = useGetTurnstileToken()
  const request = useGuestRsvpRequest(cleanupId)
  const verify = useGuestRsvpVerify(cleanupId)

  const [step, setStep] = useState<GuestRsvpStep>("choice")
  const [form, setForm] = useState<GuestRsvpFormState>(() => emptyGuestRsvpForm())
  const [focusedField, setFocusedField] = useState<"name" | "contact" | null>(null)
  const [sentTo, setSentTo] = useState<GuestContactPayload | null>(null)
  const [code, setCode] = useState("")
  const [resendReadyAt, setResendReadyAt] = useState<number | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [smsBlocked, setSmsBlocked] = useState(false)
  const [exhausted, setExhausted] = useState(false)
  const [localErrorKey, setLocalErrorKey] = useState<string | null>(null)
  const [sendingCode, setSendingCode] = useState(false)

  const types = useMemo(() => selectableTicketTypes(ticketTypes), [ticketTypes])
  const hasTypes = types.length > 0
  const [chosenTicketTypeId, setTicketTypeId] = useState<string | null>(null)
  const ticketTypeId = effectiveTicketTypeId(types, chosenTicketTypeId)
  const [partySize, setPartySize] = useState(1)
  const [typedAnswers, setAnswers] = useState<AnswerMap>({})
  const answers = useMemo(() => answersWithDefaults(questions, typedAnswers), [questions, typedAnswers])
  const [consent, setConsent] = useState<ConsentState>(EMPTY_CONSENT)
  const [invalidQuestions, setInvalidQuestions] = useState<ReadonlySet<string>>(() => new Set())
  const selectedType = useMemo(
    () => types.find((type) => type.id === ticketTypeId) ?? null,
    [types, ticketTypeId],
  )
  const shownQuestions = useMemo(
    () => visibleQuestions(questions, ticketTypeId, answers),
    [questions, ticketTypeId, answers],
  )

  const smsOffered = guestSmsEnabled === true && !smsBlocked
  const sendPending = sendingCode || request.isPending

  const sendingRef = React.useRef(false)
  const sendSeqRef = React.useRef(0)
  const abortSend = useCallback(() => {
    sendSeqRef.current += 1
    sendingRef.current = false
  }, [])
  const settleSend = useCallback(() => {
    abortSend()
    setSendingCode(false)
  }, [abortSend])

  const resetAll = useCallback(() => {
    setStep("choice")
    setForm(emptyGuestRsvpForm())
    setTicketTypeId(null)
    setPartySize(1)
    setAnswers({})
    setConsent(EMPTY_CONSENT)
    setInvalidQuestions(new Set())
    setFocusedField(null)
    setSentTo(null)
    setCode("")
    setResendReadyAt(null)
    setSmsBlocked(false)
    setExhausted(false)
    setLocalErrorKey(null)
    settleSend()
    request.reset()
    verify.reset()
  }, [request, settleSend, verify])

  const resetRef = React.useRef(resetAll)
  resetRef.current = resetAll
  useEffect(() => {
    resetRef.current()
    return abortSend
  }, [visible, abortSend])

  useEffect(() => {
    if (!visible || step !== "code") return
    const id = setInterval(() => setNowMs(Date.now()), RESEND_COUNTDOWN_TICK_MS)
    return () => clearInterval(id)
  }, [visible, step])

  const secondsLeft = guestResendSecondsLeft(resendReadyAt, nowMs)

  const registrationExtras = useMemo(() => {
    if (!hasTypes || !selectedType) return {}
    return {
      ticketTypeId: selectedType.id,
      partySize: clampPartySize(partySize, selectedType.maxPartySize),
      ...(shownQuestions.length > 0 ? { answers: answerPayload(shownQuestions, answers) } : {}),
      consent: consentPayload(consent),
    }
  }, [answers, consent, hasTypes, partySize, selectedType, shownQuestions])

  const sendCode = useCallback(
    (name: string, contact: GuestContactPayload) => {
      if (sendingRef.current) return
      sendingRef.current = true
      setSendingCode(true)
      setLocalErrorKey(null)
      const seq = sendSeqRef.current
      const stale = () => sendSeqRef.current !== seq
      verify.reset()
      void (async () => {
        try {
          let token = ""
          try {
            token = getTurnstileToken
              ? await getTurnstileToken(GUEST_RSVP_TURNSTILE_ACTION)
              : ""
          } catch {
            token = ""
          }
          if (stale()) return
          if (token.length === 0) {
            setLocalErrorKey("error.turnstile")
            return
          }
          try {
            const res = await request.mutateAsync({
              name,
              ...contact,
              ...registrationExtras,
              turnstileToken: token,
              website: "",
            })
            if (stale()) return
            setSentTo(contact)
            setCode("")
            setExhausted(false)
            setSmsBlocked(false)
            const sentAt = Date.now()
            setNowMs(sentAt)
            setResendReadyAt(guestResendReadyAt(sentAt, res.resendAfterSec))
            setStep("code")
          } catch (err) {
            if (stale()) return
            if (guestSmsUnavailable(contact.channel, appErrorFields(err))) {
              setSmsBlocked(true)
              setForm((prev) => ({ ...prev, channel: "email", phone: "" }))
            }
          }
        } finally {
          if (!stale()) settleSend()
        }
      })()
    },
    [getTurnstileToken, registrationExtras, request, settleSend, verify],
  )

  const submitForm = useCallback(() => {
    const name = guestNameValue(form.name)
    const contact = guestContactPayload(form)
    if (name === null || contact === null || sendPending) return
    if (hasTypes) {
      const missing = missingRequired(shownQuestions, answers)
      if (missing.length > 0) {
        setInvalidQuestions(new Set(missing))
        setLocalErrorKey("error.questions_required")
        return
      }
      if (!consentAccepted(consent)) {
        setLocalErrorKey("error.consent_required")
        return
      }
    }
    setLocalErrorKey(null)
    sendCode(name, contact)
  }, [answers, consent, form, hasTypes, sendPending, sendCode, shownQuestions])

  const onResend = useCallback(() => {
    const name = guestNameValue(form.name)
    if (name === null || sentTo === null || sendPending || secondsLeft > 0) return
    sendCode(name, sentTo)
  }, [form.name, sentTo, sendPending, secondsLeft, sendCode])

  const runVerify = useCallback(
    (value: string) => {
      if (sentTo === null || value.length !== GUEST_RSVP_CODE_LENGTH || verify.isPending) return
      setLocalErrorKey(null)
      settleSend()
      request.reset()
      verify.mutate(
        { ...sentTo, ...registrationExtras, code: value },
        {
          onSuccess: () => setStep("success"),
          onError: (err) => {
            if (guestAttemptsExhausted(appErrorFields(err))) setExhausted(true)
          },
        },
      )
    },
    [sentTo, verify, request, registrationExtras, settleSend],
  )

  const submitCode = useCallback(() => runVerify(code), [runVerify, code])

  const startOver = useCallback(() => {
    setStep("form")
    setCode("")
    setExhausted(false)
    setResendReadyAt(null)
    setLocalErrorKey(null)
    verify.reset()
  }, [verify])

  const onSignIn = useCallback(() => {
    onClose()
    requireAuth(() => {}, { next: nextPath })
  }, [onClose, requireAuth, nextPath])

  const errorText = (() => {
    if (localErrorKey !== null) return t(localErrorKey)
    if (step === "form" && request.isError && !smsBlocked) {
      return t(guestRequestErrorKey(appErrorCode(request.error), appErrorFields(request.error)))
    }
    if (step === "code") {
      if (request.isError) return t(guestRequestErrorKey(appErrorCode(request.error), appErrorFields(request.error)))
      if (verify.isError) {
        return t(guestVerifyErrorKey(appErrorCode(verify.error), appErrorFields(verify.error)))
      }
    }
    return null
  })()

  const commitHandlers: Record<GuestRsvpCommit, () => void> = {
    submitForm,
    submitCode,
    startOver,
    close: onClose,
  }
  const commitKind = guestRsvpCommitFor(step, exhausted)
  const commit = commitKind === null ? undefined : commitHandlers[commitKind]

  const contactLabel =
    sentTo === null
      ? ""
      : sentTo.channel === "email"
        ? sentTo.email
        : formatGuestPhone(sentTo.phone)

  const actions = ((): React.ReactNode => {
    if (step === "choice") {
      return <SecondaryButton label={t("form.cancel")} onPress={onClose} size="sm" />
    }
    if (step === "form") {
      return (
        <>
          <SecondaryButton label={t("form.cancel")} onPress={onClose} size="sm" />
          <PrimaryButton
            label={t("form.submit")}
            onPress={submitForm}
            loading={sendPending}
            disabled={!canSubmitGuestForm(form, sendPending)}
          />
        </>
      )
    }
    if (step === "code") {
      return (
        <>
          <SecondaryButton label={t("code.back")} onPress={startOver} size="sm" />
          {exhausted ? (
            <PrimaryButton label={t("code.start_over")} onPress={startOver} />
          ) : (
            <PrimaryButton
              label={t("code.submit")}
              onPress={submitCode}
              loading={verify.isPending}
              disabled={code.length !== GUEST_RSVP_CODE_LENGTH || verify.isPending}
            />
          )}
        </>
      )
    }
    return <PrimaryButton label={t("success.done")} onPress={onClose} />
  })()

  return (
    <ModalCardSheet
      visible={visible}
      onClose={onClose}
      onCommit={commit}
      headerIcon="Calendar"
      headerIconColor={th.colors.moss["700"]}
      title={t("title")}
      dismissLabel={t("dismiss_a11y")}
      backdropDismissDisabled={sendPending}
      error={errorText}
      actions={actions}
    >
      {step === "choice" ? (
        <>
          <Text variant="caption" color={th.colors.textSubtle}>
            {t("choice.caption")}
          </Text>
          <PrimaryButton
            label={t("choice.sign_in")}
            onPress={onSignIn}
            accessibilityLabel={t("choice.sign_in")}
            style={styles.stacked}
          />
          <SecondaryButton
            label={t("choice.guest")}
            onPress={() => setStep("form")}
            accessibilityLabel={t("choice.guest")}
            style={styles.stacked}
          />
        </>
      ) : null}

      {step === "form" ? (
        <>
          <Text variant="caption" color={th.colors.textSubtle}>
            {t("form.caption")}
          </Text>

          {hasTypes ? (
            <>
              <Text variant="label">{t("form.ticket_label")}</Text>
              <TicketTypePicker
                ticketTypes={types}
                selectedId={ticketTypeId}
                onSelect={(next) => {
                  setTicketTypeId(next)
                  setInvalidQuestions(new Set())
                  setLocalErrorKey(null)
                }}
                disabled={sendPending}
              />
              {selectedType ? (
                <PartySizeStepper
                  value={partySize}
                  max={selectedType.maxPartySize}
                  onChange={setPartySize}
                  disabled={sendPending}
                />
              ) : null}
            </>
          ) : null}

          <Text variant="label">{t("form.name_label")}</Text>
          <TextInput
            value={form.name}
            onChangeText={(next) =>
              setForm((prev) => ({ ...prev, name: next.slice(0, MAX_GUEST_NAME) }))
            }
            editable={!sendPending}
            maxLength={MAX_GUEST_NAME}
            placeholder={t("form.name_placeholder")}
            placeholderTextColor={th.colors.textSubtle}
            accessibilityLabel={t("form.name_a11y")}
            autoCapitalize="words"
            autoCorrect={false}
            onFocus={() => setFocusedField("name")}
            onBlur={() => setFocusedField(null)}
            style={[
              webInputReset,
              styles.input,
              focusedField === "name" ? modalSheetInputFocusedStyle(th) : null,
            ]}
          />

          {guestSmsEnabled === true ? (
            <>
              <Text variant="label">{t("form.channel_label")}</Text>
              <View
                style={styles.seg}
                accessibilityRole="radiogroup"
                accessibilityLabel={t("form.channel_label")}
              >
                {CHANNELS.map((channel) => {
                  const selected = form.channel === channel
                  const disabled = channel === "sms" && !smsOffered
                  return (
                    <Pressable
                      key={channel}
                      onPress={() => setForm((prev) => ({ ...prev, channel }))}
                      disabled={disabled || sendPending}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, disabled }}
                      accessibilityLabel={
                        channel === "email" ? t("form.channel_email") : t("form.channel_sms")
                      }
                      hitSlop={5}
                      {...focusRingProps}
                      style={({ pressed }) => [
                        styles.segBtn,
                        selected ? styles.segBtnOn : null,
                        disabled ? styles.segBtnOff : null,
                        pressed && !disabled ? styles.pressedFeedback : null,
                      ]}
                    >
                      <Text style={[styles.segText, selected ? styles.segTextOn : null]}>
                        {channel === "email" ? t("form.channel_email") : t("form.channel_sms")}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </>
          ) : null}

          {smsBlocked ? (
            <View style={styles.notice} accessibilityRole="alert">
              <Icon icon={iconMap.Info} size={14} color={th.colors.sky["700"]} />
              <Text style={styles.noticeText}>{t("form.sms_unavailable")}</Text>
            </View>
          ) : null}

          <Text variant="label">
            {form.channel === "email" ? t("form.email_label") : t("form.phone_label")}
          </Text>
          {form.channel === "email" ? (
            <TextInput
              value={form.email}
              onChangeText={(next) =>
                setForm((prev) => ({ ...prev, email: next.slice(0, GUEST_EMAIL_MAX) }))
              }
              editable={!sendPending}
              maxLength={GUEST_EMAIL_MAX}
              placeholder={t("form.email_placeholder")}
              placeholderTextColor={th.colors.textSubtle}
              accessibilityLabel={t("form.email_label")}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setFocusedField("contact")}
              onBlur={() => setFocusedField(null)}
              style={[
                webInputReset,
                styles.input,
                focusedField === "contact" ? modalSheetInputFocusedStyle(th) : null,
              ]}
            />
          ) : (
            <>
              <TextInput
                value={formatGuestPhone(form.phone)}
                onChangeText={(next) => setForm((prev) => ({ ...prev, phone: next }))}
                editable={!sendPending}
                placeholder={t("form.phone_placeholder")}
                placeholderTextColor={th.colors.textSubtle}
                accessibilityLabel={t("form.phone_label")}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoCorrect={false}
                onFocus={() => setFocusedField("contact")}
                onBlur={() => setFocusedField(null)}
                style={[
                  webInputReset,
                  styles.input,
                  focusedField === "contact" ? modalSheetInputFocusedStyle(th) : null,
                ]}
              />
              <Text variant="caption" color={th.colors.textSubtle}>
                {t("form.sms_consent")}
              </Text>
            </>
          )}

          {hasTypes ? (
            <>
              <RegistrationQuestions
                questions={shownQuestions}
                answers={answers}
                onChange={(questionId, value: EventAnswerValue) => {
                  setAnswers((prev) => ({ ...prev, [questionId]: value }))
                  setInvalidQuestions((prev) => {
                    if (!prev.has(questionId)) return prev
                    const nextSet = new Set(prev)
                    nextSet.delete(questionId)
                    return nextSet
                  })
                }}
                invalid={invalidQuestions}
                disabled={sendPending}
              />
              <ConsentChecks
                value={consent}
                onChange={setConsent}
                showSms={form.channel === "sms"}
                disabled={sendPending}
              />
            </>
          ) : null}
        </>
      ) : null}

      {step === "code" ? (
        <>
          <Text variant="caption" color={th.colors.textSubtle}>
            {sentTo?.channel === "sms"
              ? t("code.caption_sms", { contact: contactLabel })
              : t("code.caption_email", { contact: contactLabel })}
          </Text>
          <SegmentedCodeInput
            value={code}
            onChangeText={setCode}
            length={GUEST_RSVP_CODE_LENGTH}
            editable={!verify.isPending && !exhausted}
            onComplete={runVerify}
          />
          <Pressable
            onPress={onResend}
            disabled={secondsLeft > 0 || sendPending}
            accessibilityRole="button"
            accessibilityState={{ disabled: secondsLeft > 0 || sendPending }}
            accessibilityLabel={t("code.resend_a11y")}
            hitSlop={10}
            {...focusRingProps}
            style={({ pressed }) => [styles.resend, pressed ? styles.pressedFeedback : null]}
          >
            <Text style={[styles.resendText, secondsLeft > 0 ? styles.resendTextOff : null]}>
              {secondsLeft > 0 ? t("code.resend_wait", { seconds: secondsLeft }) : t("code.resend")}
            </Text>
          </Pressable>
        </>
      ) : null}

      {step === "success" ? (
        <>
          <Text variant="bodyStrong">{t("success.title")}</Text>
          <Text variant="caption" color={th.colors.textSubtle}>
            {sentTo?.channel === "sms"
              ? t("success.body_sms", { contact: contactLabel })
              : t("success.body_email", { contact: contactLabel })}
          </Text>
        </>
      ) : null}
    </ModalCardSheet>
  )
}

const useStyles = makeThemedStyles((t) => ({
  input: {
    ...modalSheetInputStyle(t),
    minHeight: 42,
  },
  stacked: {
    alignSelf: "stretch",
  },
  seg: {
    flexDirection: "row",
    gap: t.space["1"],
    padding: t.space["1"],
    backgroundColor: t.colors.bgAlt,
    borderRadius: t.radius.pill,
  },
  segBtn: {
    flex: 1,
    height: 34,
    borderRadius: t.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  segBtnOn: {
    backgroundColor: t.colors.surface,
    ...t.shadows.s1,
  },
  segBtnOff: {
    opacity: 0.5,
  },
  segText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13.5,
    color: t.colors.textSubtle,
  },
  segTextOn: {
    color: t.colors.text,
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: t.space["2"],
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.sky["50"],
  },
  noticeText: {
    flex: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12.5,
    lineHeight: 17,
    color: t.colors.sky["700"],
  },
  resend: {
    alignSelf: "flex-start",
    paddingVertical: t.space["1"],
    borderRadius: t.radius.sm,
  },
  pressedFeedback: {
    opacity: 0.6,
  },
  resendText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["13"],
    color: t.colors.accentText,
  },
  resendTextOff: {
    color: t.colors.textSubtle,
  },
}))
