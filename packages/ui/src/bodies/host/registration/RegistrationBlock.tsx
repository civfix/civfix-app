import React, { useCallback, useEffect, useMemo, useState } from "react"
import { View, StyleSheet } from "react-native"
import { TextInput } from "../../../primitives/TextInput"
import type { CleanupDTO, EventAnswerValue, EventQuestionDTO } from "@civfix/shared"
import { ACCESS_CODE_MAX, appErrorCode } from "@civfix/shared"
import {
  answerPayload,
  clampPartySize,
  hasEventEnded,
  missingRequired,
  registerOutcomeKey,
  sortedTicketTypes,
  visibleQuestions,
  type AnswerMap,
} from "@civfix/shared/host"
import { makeThemedStyles, useTheme, webInputReset } from "../../../theme"
import { Text, Icon, iconMap } from "../../../typography"
import { PrimaryButton } from "../../../primitives/PrimaryButton"
import { SecondaryButton } from "../../../primitives/SecondaryButton"
import {
  ModalCardSheet,
  modalSheetInputFocusedStyle as fieldFocusedStyle,
} from "../../../primitives/ModalCardSheet"
import { useToast } from "../../../primitives/toastContext"
import { joinParts } from "../../../primitives/joinParts"
import { useAuthState, useNow, useRequireAuth } from "../../../data"
import { randomId } from "../../../data/randomId"
import {
  useCancelEventRegistration,
  useEventQuestions,
  useJoinEventWaitlist,
  useRegisterForEvent,
} from "../../../data/hooks/host"
import { useT } from "../../../i18n"
import { useNavStore } from "../../../nav"
import { TicketTypePicker } from "./TicketTypePicker"
import { PartySizeStepper } from "./PartySizeStepper"
import { RegistrationQuestions } from "./RegistrationQuestions"
import { ConsentChecks } from "./ConsentChecks"
import {
  EMPTY_CONSENT,
  consentAccepted,
  consentPayload,
  type ConsentState,
} from "./consentModel"
import { WaitlistJoinCard } from "./WaitlistJoinCard"
import { INPUT_MIN_HEIGHT } from "../hostLayout"
import { seedAnswers } from "./questionModel"
import { registerErrorKey, registrationSurface, resolveTicketTypeId } from "./registrationModel"

const NO_QUESTIONS: readonly EventQuestionDTO[] = []

export interface RegistrationBlockProps {
  cleanup: CleanupDTO
  onGuestRegister?: (() => void) | undefined
}

export function RegistrationBlock({ cleanup, onGuestRegister }: RegistrationBlockProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-ticket")
  const toast = useToast()
  const requireAuth = useRequireAuth()
  const { isAuthenticated, isPending: authPending } = useAuthState()

  const now = useNow()
  const ticketTypes = useMemo(() => sortedTicketTypes(cleanup.ticketTypes), [cleanup.ticketTypes])
  const surface = registrationSurface({
    status: cleanup.status,
    ended: hasEventEnded(cleanup, now),
    ticketTypes,
    registrationState: cleanup.registrationState,
    myRegistration: cleanup.myRegistration,
  })

  const [pickedTypeId, setPickedTypeId] = useState<string | null>(null)
  const [partySize, setPartySize] = useState(1)
  const [accessCode, setAccessCode] = useState("")
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [consent, setConsent] = useState<ConsentState>(EMPTY_CONSENT)
  const [invalidQuestions, setInvalidQuestions] = useState<ReadonlySet<string>>(() => new Set())
  const [idempotencyKey, setIdempotencyKey] = useState(() => randomId())
  const [errorText, setErrorText] = useState<string | null>(null)
  const [codeFocused, setCodeFocused] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const ticketTypeId = resolveTicketTypeId(ticketTypes, pickedTypeId)
  const selectedType = useMemo(
    () => ticketTypes.find((type) => type.id === ticketTypeId) ?? null,
    [ticketTypes, ticketTypeId],
  )

  const showsForm = surface === "form" || surface === "cancelled"
  const questions = useEventQuestions(cleanup.id, { enabled: showsForm })
  const questionList = questions.data ?? NO_QUESTIONS
  const shown = useMemo(
    () => visibleQuestions(questionList, ticketTypeId, answers),
    [questionList, ticketTypeId, answers],
  )

  const register = useRegisterForEvent(cleanup.id)
  const cancel = useCancelEventRegistration(cleanup.id)
  const joinWaitlist = useJoinEventWaitlist(cleanup.id)

  const onAnswerChange = useCallback((questionId: string, value: EventAnswerValue) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
    setInvalidQuestions((prev) => {
      if (!prev.has(questionId)) return prev
      const next = new Set(prev)
      next.delete(questionId)
      return next
    })
  }, [])

  const onSelectType = useCallback(
    (nextId: string) => {
      setPickedTypeId(nextId)
      setInvalidQuestions(new Set())
      setErrorText(null)
      const next = ticketTypes.find((type) => type.id === nextId)
      if (next) setPartySize((size) => clampPartySize(size, next.maxPartySize))
    },
    [ticketTypes],
  )

  useEffect(() => {
    setAnswers((prev) => seedAnswers(prev, questionList))
  }, [questionList])

  const submit = useCallback(() => {
    if (!selectedType) return
    setErrorText(null)
    const missing = missingRequired(shown, answers)
    if (missing.length > 0) {
      setInvalidQuestions(new Set(missing))
      setErrorText(t("questions.required_summary"))
      return
    }
    if (!consentAccepted(consent)) {
      setErrorText(t("consent.required_error"))
      return
    }
    const needsCode = selectedType.visibility === "access_code"
    if (needsCode && accessCode.trim().length === 0) {
      setErrorText(t("outcome.access_code_required"))
      return
    }
    register.mutate(
      {
        idempotencyKey,
        ticketTypeId: selectedType.id,
        partySize: clampPartySize(partySize, selectedType.maxPartySize),
        ...(needsCode ? { accessCode: accessCode.trim() } : {}),
        ...(shown.length > 0 ? { answers: answerPayload(shown, answers) } : {}),
        consent: consentPayload(consent),
        joinWaitlistIfFull: selectedType.waitlistEnabled,
      },
      {
        onSuccess: (res) => {
          const key = registerOutcomeKey(res.outcome)
          if (key) {
            setErrorText(t(key))
            if (res.outcome === "answers_invalid" && res.fields) {
              setInvalidQuestions(new Set(Object.keys(res.fields)))
            }
            return
          }
          setIdempotencyKey(randomId())
          toast.show(
            res.outcome === "waitlisted" ? t("toast.waitlisted") : t("toast.registered"),
            { variant: "success" },
          )
        },
        onError: (err) => setErrorText(t(registerErrorKey(appErrorCode(err)))),
      },
    )
  }, [
    accessCode,
    answers,
    consent,
    idempotencyKey,
    partySize,
    register,
    selectedType,
    shown,
    t,
    toast,
  ])

  const onPressRegister = useCallback(() => {
    if (!isAuthenticated && !authPending && onGuestRegister) {
      onGuestRegister()
      return
    }
    requireAuth(submit, { next: `/cleanups/${cleanup.id}` })
  }, [authPending, cleanup.id, isAuthenticated, onGuestRegister, requireAuth, submit])

  const openTicket = useCallback(() => {
    useNavStore.getState().push({ kind: "my-ticket", id: cleanup.id, title: cleanup.title })
  }, [cleanup.id, cleanup.title])

  const onCancelSeat = useCallback(() => {
    const registrationId = cleanup.myRegistration?.id
    if (!registrationId) return
    cancel.mutate(
      { registrationId },
      {
        onSuccess: () => {
          setConfirmingCancel(false)
          toast.show(t("toast.cancelled"), { variant: "success" })
        },
        onError: (err) => {
          setConfirmingCancel(false)
          setErrorText(t(registerErrorKey(appErrorCode(err))))
        },
      },
    )
  }, [cancel, cleanup.myRegistration?.id, t, toast])

  if (surface === "hidden") return null

  if (surface === "registered" || surface === "waitlisted") {
    const mine = cleanup.myRegistration
    const waitlisted = surface === "waitlisted"
    return (
      <View style={styles.card}>
        <View style={styles.head}>
          <Icon
            icon={waitlisted ? iconMap.Hourglass : iconMap.TicketCheck}
            size={18}
            color={waitlisted ? th.colors.sun["700"] : th.colors.moss["700"]}
          />
          <Text style={styles.headText}>
            {waitlisted ? t("mine.waitlisted_title") : t("mine.title")}
          </Text>
        </View>
        <Text style={styles.mineMeta}>
          {joinParts([
            mine?.ticketTypeName ?? null,
            mine ? t("mine.seats", { count: mine.seatCount }) : null,
            waitlisted && mine?.waitlistPosition != null
              ? t("mine.position", { position: mine.waitlistPosition })
              : null,
          ])}
        </Text>
        {errorText ? (
          <Text style={styles.error} accessibilityRole="alert">
            {errorText}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {waitlisted ? null : (
            <PrimaryButton label={t("mine.view_ticket")} onPress={openTicket} icon={iconMap.QrCode} />
          )}
          {mine?.canCancel === false ? null : (
            <SecondaryButton
              label={t("mine.cancel")}
              onPress={() => setConfirmingCancel(true)}
              size="sm"
              disabled={cancel.isPending}
            />
          )}
        </View>
        <CancelRegistrationSheet
          visible={confirmingCancel}
          waitlisted={waitlisted}
          pending={cancel.isPending}
          onConfirm={onCancelSeat}
          onClose={() => setConfirmingCancel(false)}
        />
      </View>
    )
  }

  if (surface === "closed" || surface === "not_yet_open") {
    return (
      <View style={styles.card}>
        <Text style={styles.headText}>
          {surface === "closed" ? t("state.closed_title") : t("state.not_yet_open_title")}
        </Text>
        <Text style={styles.mineMeta}>
          {surface === "closed" ? t("state.closed_body") : t("state.not_yet_open_body")}
        </Text>
      </View>
    )
  }

  if (surface === "waitlist") {
    const waitlistType = ticketTypes.find((type) => type.waitlistEnabled) ?? null
    return (
      <WaitlistJoinCard
        pending={joinWaitlist.isPending}
        error={errorText}
        onJoin={() => {
          if (!waitlistType) return
          requireAuth(
            () =>
              joinWaitlist.mutate(
                { ticketTypeId: waitlistType.id, partySize },
                {
                  onSuccess: () => toast.show(t("toast.waitlisted"), { variant: "success" }),
                  onError: (err) => setErrorText(t(registerErrorKey(appErrorCode(err)))),
                },
              ),
            { next: `/cleanups/${cleanup.id}` },
          )
        }}
      />
    )
  }

  return (
    <View style={styles.card}>
      <Text style={styles.headText}>
        {surface === "cancelled" ? t("mine.cancelled_title") : t("form.heading")}
      </Text>
      {surface === "cancelled" ? (
        <Text style={styles.mineMeta}>{t("mine.cancelled_body")}</Text>
      ) : null}

      <TicketTypePicker
        ticketTypes={ticketTypes}
        selectedId={ticketTypeId}
        onSelect={onSelectType}
        disabled={register.isPending}
      />

      {selectedType && selectedType.visibility === "access_code" ? (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t("form.access_code_label")}</Text>
          <TextInput
            value={accessCode}
            onChangeText={setAccessCode}
            editable={!register.isPending}
            maxLength={ACCESS_CODE_MAX}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={t("form.access_code_placeholder")}
            placeholderTextColor={th.colors.textSubtle}
            accessibilityLabel={t("form.access_code_label")}
            onFocus={() => setCodeFocused(true)}
            onBlur={() => setCodeFocused(false)}
            style={[webInputReset, styles.input, codeFocused ? fieldFocusedStyle(th) : null]}
          />
        </View>
      ) : null}

      {selectedType ? (
        <PartySizeStepper
          value={partySize}
          max={selectedType.maxPartySize}
          onChange={setPartySize}
          disabled={register.isPending}
        />
      ) : null}

      {questions.isLoading ? (
        <Text style={styles.mineMeta}>{t("questions.loading")}</Text>
      ) : questions.isError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {t("questions.error")}
        </Text>
      ) : (
        <RegistrationQuestions
          questions={shown}
          answers={answers}
          onChange={onAnswerChange}
          invalid={invalidQuestions}
          disabled={register.isPending}
        />
      )}

      <ConsentChecks value={consent} onChange={setConsent} disabled={register.isPending} />

      {errorText ? (
        <Text style={styles.error} accessibilityRole="alert">
          {errorText}
        </Text>
      ) : null}

      <PrimaryButton
        label={t("form.submit")}
        onPress={onPressRegister}
        loading={register.isPending}
        disabled={selectedType === null}
      />
    </View>
  )
}

export interface CancelRegistrationSheetProps {
  visible: boolean
  waitlisted: boolean
  pending: boolean
  onConfirm: () => void
  onClose: () => void
}

export function CancelRegistrationSheet({
  visible,
  waitlisted,
  pending,
  onConfirm,
  onClose,
}: CancelRegistrationSheetProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-ticket")

  const dismiss = useCallback(() => {
    if (!pending) onClose()
  }, [onClose, pending])

  const confirm = useCallback(() => {
    if (!pending) onConfirm()
  }, [onConfirm, pending])

  return (
    <ModalCardSheet
      visible={visible}
      onClose={dismiss}
      onCommit={confirm}
      headerIcon="Ticket"
      headerIconColor={th.colors.dangerInk}
      title={waitlisted ? t("mine.cancel_waitlist_title") : t("mine.cancel_title")}
      dismissLabel={t("common:dismiss")}
      backdropDismissDisabled={pending}
      actions={
        <>
          <SecondaryButton
            label={t("mine.cancel_keep")}
            size="sm"
            disabled={pending}
            onPress={dismiss}
          />
          <PrimaryButton
            label={t("mine.cancel")}
            variant="destructive"
            onPress={confirm}
            loading={pending}
            disabled={pending}
          />
        </>
      }
    >
      <Text style={styles.mineMeta}>
        {waitlisted ? t("mine.cancel_waitlist_body") : t("mine.cancel_body")}
      </Text>
    </ModalCardSheet>
  )
}

const useStyles = makeThemedStyles((t) => ({
  card: {
    gap: t.space["3"],
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  headText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  mineMeta: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    flexWrap: "wrap",
  },
  field: {
    gap: t.space["1"],
  },
  fieldLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.text,
  },
  input: {
    minHeight: INPUT_MIN_HEIGHT,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.bg,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  error: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.bloom["700"],
  },
}))
