import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View, Pressable, StyleSheet, ActivityIndicator } from "react-native"
import {
  makeThemedStyles,
  useTheme,
  noShadow,
  focusRingProps,
  webCursor,
  webCursorPointer,
  webTransition,
  webHover,
} from "../theme"
import { Text, Icon, iconMap, type LucideIcon } from "../typography"
import { ipLocate, type LatLng } from "@civfix/shared/geocode"
import {
  SignInPrompt,
  SkeletonBlock,
  SkeletonGroup,
  SkeletonText,
  VerificationNotice,
  useToast,
} from "../primitives"
import {
  useCreateCleanup,
  useAuthState,
  useRequireAuth,
  useMyVerification,
  useReport,
  useReverseLabel,
  reverseLabelText,
} from "../data"
import { useCreatePost } from "../data/hooks/posts"
import { buildFeedShareInput, buildOptimisticFeedSharePost } from "./feedShare"
import { useGeolocation, useHaptics } from "../capabilities"
import { announce } from "../announce"
import { useNavStore } from "../nav"
import { PLAIN_SCROLL_HOST, ScrollHostProvider, useScrollHost } from "../shell/ScrollHost"
import { makeKeyboardAwareScrollHost } from "../shell/KeyboardAwareScroll"
import { StepTransition } from "../shell/StepTransition"
import { WizardStepHeader } from "../shell/WizardStepHeader"
import { useStackDirection } from "../shell/useStackDirection"
import { useLocale, useT } from "../i18n"
import { appErrorCode } from "./errorCode"
import { pushCleanup } from "./navHelpers"
import { useCleanupDraft } from "./cleanupDraftStore"
import {
  commitHostDraftMount,
  isGenuineHostExit,
  planHostDraftMount,
  type HostDraftMountPlan,
  type HostSeedPoint,
} from "./cleanupDraftExit"
import { hostFormNavEscape, stackAfterFlowPublished } from "./composerCreateFlow"
import { useDroppedPin } from "../map/droppedPinStore"
import {
  CleanupForm,
  emptyCleanupForm,
  isCleanupFormComplete,
  mergeDateTime,
  type CleanupFormSection,
  type CleanupFormValue,
} from "./CleanupForm"
import { isScheduleInFuture } from "./calendarModel"
import { buildSlotInputs } from "./eventSlotsForm"
import {
  EVENT_WIZARD_STEPS,
  eventStepIndex,
  eventStepSatisfied,
  firstIncompleteEventStep,
  isFinalEventStep,
  nextEventStep,
  prevEventStep,
  type EventWizardDraft,
  type EventWizardStep,
} from "./eventWizard"

let draftSeedReportId: string | undefined

const STANDALONE_SCROLL_HOST = makeKeyboardAwareScrollHost(PLAIN_SCROLL_HOST)

const STEP_SECTIONS: Record<EventWizardStep, readonly CleanupFormSection[]> = {
  basics: ["basics"],
  when: ["when"],
  where: ["where"],
  details: ["extras"],
  review: ["share"],
}

const STEP_ICONS: Record<Exclude<EventWizardStep, "review">, LucideIcon> = {
  basics: iconMap.Leaf,
  when: iconMap.Calendar,
  where: iconMap.MapPin,
  details: iconMap.Users,
}

function wizardDraftOf(value: CleanupFormValue): EventWizardDraft {
  return {
    title: value.title,
    date: value.date,
    time: value.time,
    coords: value.coords,
    slots: value.slots,
  }
}

function hostErrorMessage(err: unknown, t: (key: string) => string): string {
  switch (appErrorCode(err)) {
    case "VALIDATION":
      return t("error.validation")
    case "RATE_LIMITED":
      return t("error.rateLimited")
    case "UNAUTHORIZED":
    case "FORBIDDEN":
      return t("error.session")
    default:
      return t("error.generic")
  }
}

function SeedLocationFromReport({ reportId }: { reportId: string }) {
  const query = useReport(reportId)
  const seededRef = useRef(false)
  useEffect(() => {
    if (seededRef.current) return
    const report = query.data
    if (!report) return
    seededRef.current = true
    const draft = useCleanupDraft.getState()
    const v = draft.value
    if (!v || v.coords) return
    const addr = report.addr?.trim() ?? ""
    draft.patch({
      ...v,
      coords: { lat: report.lat, lng: report.lng },
      spot: v.spot.trim().length > 0 ? v.spot : addr,
      addrQuery: v.addrQuery.trim().length > 0 ? v.addrQuery : addr,
    })
  }, [query.data])
  return null
}

function SummaryRow({
  icon,
  label,
  value,
  sub,
  onEdit,
}: {
  icon: LucideIcon
  label: string
  value: string
  sub?: string | null
  onEdit: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-create")
  return (
    <View style={styles.summaryRow}>
      <Icon icon={icon} size={16} color={th.colors.textMuted} />
      <View style={styles.summaryMeta}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={styles.summaryValue} numberOfLines={2}>
          {value}
        </Text>
        {sub ? (
          <Text style={styles.summarySub} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={t("wizard.editA11y", { section: label })}
        hitSlop={10}
        {...focusRingProps}
        style={(state) => [
          styles.editBtn,
          webCursorPointer,
          webTransition,
          webHover(state) ? styles.editBtnHovered : null,
          state.pressed ? styles.pressed : null,
        ]}
      >
        <Text style={styles.editText}>{t("wizard.edit")}</Text>
      </Pressable>
    </View>
  )
}

function ReviewSummary({
  value,
  onEdit,
}: {
  value: CleanupFormValue
  onEdit: (step: EventWizardStep) => void
}) {
  const styles = useStyles()
  const { t } = useT("event-create")
  const { t: tForm } = useT("event-form")
  const { t: tEnums } = useT("enums")
  const { locale } = useLocale()
  const label = useReverseLabel(value.coords)

  const empty = t("wizard.empty")
  const whenText =
    value.date && value.time
      ? mergeDateTime(value.date, value.time).toLocaleString(locale, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : empty
  const addr = value.coords ? reverseLabelText(label.data, value.coords) : null
  const spot = value.spot.trim()
  const bring = value.bring.join(", ")
  const slots = value.slots
    .map((slot) => slot.title.trim())
    .filter((title) => title.length > 0)
    .join(", ")
  const extras = [bring, slots].filter((part) => part.length > 0).join(" · ")

  return (
    <View style={styles.summaryCard}>
      <SummaryRow
        icon={STEP_ICONS.basics}
        label={t("wizard.summary.what")}
        value={value.title.trim() || empty}
        sub={tEnums(`eventKind.${value.eventKind}`)}
        onEdit={() => onEdit("basics")}
      />
      <SummaryRow
        icon={STEP_ICONS.when}
        label={t("wizard.summary.when")}
        value={whenText}
        onEdit={() => onEdit("when")}
      />
      <SummaryRow
        icon={STEP_ICONS.where}
        label={tForm("field.meetLocation")}
        value={addr ?? empty}
        sub={spot.length > 0 ? spot : null}
        onEdit={() => onEdit("where")}
      />
      <SummaryRow
        icon={STEP_ICONS.details}
        label={t("wizard.summary.extras")}
        value={extras.length > 0 ? extras : t("wizard.summary.noExtras")}
        onEdit={() => onEdit("details")}
      />
    </View>
  )
}

function HostForm({
  seedReportId,
  seedPoint,
  standalone,
}: {
  seedReportId?: string
  seedPoint?: HostSeedPoint
  standalone?: CreateCleanupStandaloneHost
}) {
  const { ScrollView } = useScrollHost()
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-create")
  const { t: tShare } = useT("event-form")
  const create = useCreateCleanup()
  const createPostAsync = useCreatePost().mutateAsync
  const toast = useToast()
  const geo = useGeolocation()
  const haptics = useHaptics()
  const verification = useMyVerification()
  const verificationStatus = verification.data?.verification.status

  const [initialCenter, setInitialCenter] = useState<LatLng | null>(
    seedPoint ? { lat: seedPoint.lat, lng: seedPoint.lng } : null,
  )
  useEffect(() => {
    if (seedPoint) return undefined
    let cancelled = false
    void (async () => {
      let point: LatLng | null = null
      try {
        if (geo.isAvailable()) {
          const pos = await geo.getCurrentPosition()
          point = { lat: pos.latitude, lng: pos.longitude }
        }
      } catch {
        point = null
      }
      if (!point) point = await ipLocate()
      if (!cancelled && point) setInitialCenter(point)
    })()
    return () => {
      cancelled = true
    }
  }, [geo])

  const [mountPlan] = useState<HostDraftMountPlan>(() => {
    const initial: CleanupFormValue = seedPoint
      ? { ...emptyCleanupForm(seedReportId), coords: { lat: seedPoint.lat, lng: seedPoint.lng } }
      : emptyCleanupForm(seedReportId)
    const { active, value } = useCleanupDraft.getState()
    return planHostDraftMount({ active, value }, seedReportId, draftSeedReportId, initial, seedPoint)
  })
  const startedFresh = mountPlan.startedFresh
  const [draftCommitted, setDraftCommitted] = useState(false)
  useEffect(() => {
    commitHostDraftMount(useCleanupDraft.getState(), mountPlan)
    draftSeedReportId = mountPlan.seedReportId
    setDraftCommitted(true)
  }, [mountPlan])
  const liveDraft = useCleanupDraft((s) => s.value)
  const form = (draftCommitted ? liveDraft : mountPlan.value) ?? emptyCleanupForm(seedReportId)
  const setForm = (next: CleanupFormValue) => useCleanupDraft.getState().patch(next)

  useEffect(() => {
    return () => {
      if (isGenuineHostExit(useNavStore.getState().stack)) {
        useCleanupDraft.getState().clear()
        draftSeedReportId = undefined
      }
    }
  }, [])

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [step, setStep] = useState<EventWizardStep>(() =>
    firstIncompleteEventStep(wizardDraftOf(mountPlan.value)),
  )
  const stepIndex = eventStepIndex(step)
  const stepDirection = useStackDirection(stepIndex)
  const isReview = isFinalEventStep(step)
  const [editingFromReview, setEditingFromReview] = useState(false)
  const canAdvance = eventStepSatisfied(step, wizardDraftOf(form))
  const showWizardBack =
    editingFromReview || prevEventStep(step) !== null || standalone === undefined

  const scrollRef = useRef<{ scrollTo?: (opts: { y: number; animated?: boolean }) => void } | null>(null)
  const revealShareBlock = useCallback((y: number) => {
    scrollRef.current?.scrollTo?.({ y, animated: true })
  }, [])

  useEffect(() => {
    if (submitError) announce(t("announce.publishFailed", { error: submitError }))
  }, [submitError, t])

  useEffect(() => {
    announce(
      t("wizard.announceStep", {
        current: stepIndex + 1,
        total: EVENT_WIZARD_STEPS.length,
        title: t(`wizard.${step}.title`),
      }),
    )
  }, [step, stepIndex, t])

  const editStep = useCallback((target: EventWizardStep) => {
    setEditingFromReview(true)
    setStep(target)
  }, [])

  const goNext = useCallback(() => {
    if (!canAdvance) return
    haptics.selection()
    if (editingFromReview) {
      setEditingFromReview(false)
      setStep("review")
      return
    }
    const next = nextEventStep(step)
    if (next) setStep(next)
  }, [canAdvance, editingFromReview, haptics, step])

  const goBack = useCallback(() => {
    haptics.selection()
    if (editingFromReview) {
      setEditingFromReview(false)
      setStep("review")
      return
    }
    const previous = prevEventStep(step)
    if (previous) {
      setStep(previous)
      return
    }
    if (!standalone) useNavStore.getState().back()
  }, [editingFromReview, haptics, standalone, step])

  const canPublish =
    isCleanupFormComplete(form) &&
    form.date != null &&
    form.time != null &&
    isScheduleInFuture(form.date, form.time) &&
    !create.isPending

  const scheduledAt = useMemo(() => {
    if (!form.date || !form.time) return null
    return mergeDateTime(form.date, form.time)
  }, [form.date, form.time])

  const onPublish = useCallback(() => {
    if (!canPublish || !form.coords || !scheduledAt) return
    setSubmitError(null)
    const spotLine = form.spot.trim().slice(0, 200)
    const linkedReportIds =
      form.eventKind === "cleanup" && form.linkedReportIds.length > 0 ? form.linkedReportIds : undefined
    const slots = buildSlotInputs(form.slots)
    create.mutate(
      {
        title: form.title.trim(),
        type: "site",
        eventKind: form.eventKind,
        lat: form.coords.lat,
        lng: form.coords.lng,
        scheduledAt: scheduledAt.toISOString(),
        ...(spotLine.length > 0 ? { address: spotLine } : {}),
        ...(form.description.trim().length > 0 ? { description: form.description.trim() } : {}),
        ...(form.bring.length > 0 ? { bring: form.bring } : {}),
        ...(linkedReportIds ? { linkedReportIds } : {}),
        ...(slots.length > 0 ? { slots } : {}),
      },
      {
        onSuccess: (cleanup) => {
          haptics.success()
          const shareInput = form.shareToFeed
            ? buildFeedShareInput({ enabled: true, caption: form.feedCaption }, { eventId: cleanup.id })
            : null
          if (shareInput) {
            void createPostAsync({
              input: shareInput,
              optimistic: buildOptimisticFeedSharePost({
                author: cleanup.organizer,
                caption: form.feedCaption,
                event: {
                  id: cleanup.id,
                  title: cleanup.title,
                  eventKind: cleanup.eventKind,
                  status: cleanup.status,
                  scheduledAt: cleanup.scheduledAt,
                  lat: cleanup.lat,
                  lng: cleanup.lng,
                  going: cleanup.going,
                  organizer: cleanup.organizer,
                  linkedAt: new Date().toISOString(),
                },
              }),
            }).catch(() => toast.show(tShare("share.event_failed"), { variant: "error" }))
          }
          useCleanupDraft.getState().clear()
          draftSeedReportId = undefined
          useDroppedPin.getState().clear()
          if (standalone) {
            standalone.onComposerReturn()
            return
          }
          const nav = useNavStore.getState()
          const published = stackAfterFlowPublished(nav.stack, {
            kind: "cleanup",
            id: cleanup.id,
            title: cleanup.title,
            lat: cleanup.lat,
            lng: cleanup.lng,
          })
          if (published) nav.setStack(published)
          else pushCleanup(cleanup)
        },
        onError: (err) => {
          haptics.error()
          setSubmitError(hostErrorMessage(err, t))
        },
      },
    )
  }, [canPublish, create, createPostAsync, form, haptics, scheduledAt, standalone, t, tShare, toast])

  const hostGetVerified = standalone?.onGetVerified
  const verifyEscape = hostFormNavEscape({
    standalone: standalone !== undefined,
    hasHostCallback: hostGetVerified !== undefined,
  })
  const pushVerifyEntry = useCallback(() => {
    useNavStore.getState().push({ kind: "verify" })
  }, [])
  const onGetVerified =
    verifyEscape === "nav-store" ? pushVerifyEntry : verifyEscape === "host" ? hostGetVerified : undefined

  let verificationBanner: React.ReactNode = null
  if (verificationStatus === "verified") {
    verificationBanner = (
      <VerificationNotice verified message={t("verification.verified")} />
    )
  } else if (verificationStatus === "pending") {
    verificationBanner = (
      <VerificationNotice verified={false} message={t("verification.pending")} />
    )
  } else if (verificationStatus === "unverified" || verificationStatus === "rejected") {
    verificationBanner = (
      <VerificationNotice
        verified={false}
        message={t("verification.unverified")}
        onPress={onGetVerified}
        accessibilityLabel={t("verification.getVerified")}
      />
    )
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {seedReportId && startedFresh && draftCommitted ? (
        <SeedLocationFromReport reportId={seedReportId} />
      ) : null}

      <WizardStepHeader
        step={stepIndex + 1}
        total={EVENT_WIZARD_STEPS.length}
        title={t(`wizard.${step}.title`)}
        help={t(`wizard.${step}.help`)}
      />

      <StepTransition transitionKey={step} direction={stepDirection} style={styles.stepHost}>
        {isReview ? (
          <>
            {verificationBanner}

            <ReviewSummary value={form} onEdit={editStep} />

            <CleanupForm
              value={form}
              onChange={setForm}
              initialCenter={initialCenter}
              sections={STEP_SECTIONS.review}
              showFeedShare
              feedShareBusy={create.isPending}
              onRequestFeedShareReveal={revealShareBlock}
            />

            <View style={styles.note}>
              <Icon icon={iconMap.Users} size={16} color={th.colors.moss["700"]} />
              <Text style={styles.noteText}>{t("followersNote")}</Text>
            </View>
          </>
        ) : (
          <CleanupForm
            value={form}
            onChange={setForm}
            initialCenter={initialCenter}
            sections={STEP_SECTIONS[step]}
            showFeedShare={false}
          />
        )}
      </StepTransition>

      {submitError ? (
        <View style={styles.validationRow}>
          <Icon icon={iconMap.AlertCircle} size={15} color={th.colors.brand.bloom} />
          <Text style={styles.errorText}>{submitError}</Text>
        </View>
      ) : !canAdvance && !create.isPending ? (
        <View style={styles.validationRow}>
          <Icon icon={iconMap.Info} size={15} color={th.colors.textSubtle} />
          <Text style={styles.hintText}>{t(`wizard.${step}.error`)}</Text>
        </View>
      ) : null}

      <View style={styles.wizardFooter}>
        {showWizardBack ? (
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel={t("wizard.back")}
            {...focusRingProps}
            style={(state) => [
              styles.backBtn,
              webCursorPointer,
              webTransition,
              webHover(state) ? styles.backBtnHovered : null,
              state.pressed ? styles.pressed : null,
            ]}
          >
            <Icon icon={iconMap.ArrowLeft} size={16} color={th.colors.textMuted} />
            <Text style={styles.backText}>{t("wizard.back")}</Text>
          </Pressable>
        ) : null}

        {isReview ? (
          <Pressable
            onPress={onPublish}
            disabled={!canPublish}
            accessibilityRole="button"
            accessibilityLabel={t("publish.label")}
            accessibilityState={{ disabled: !canPublish }}
            {...focusRingProps}
            style={(state) => [
              styles.publishBtn,
              webCursor(!canPublish),
              webTransition,
              !canPublish ? styles.publishDisabled : null,
              webHover(state) && canPublish ? styles.publishHovered : null,
              state.pressed && canPublish ? styles.pressed : null,
            ]}
          >
            {create.isPending ? (
              <ActivityIndicator size="small" color={th.colors.onAccent} />
            ) : (
              <Icon icon={iconMap.Megaphone} size={17} color={th.colors.onAccent} />
            )}
            <Text style={styles.publishText}>
              {create.isPending ? t("publish.pending") : t("publish.label")}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={goNext}
            disabled={!canAdvance}
            accessibilityRole="button"
            accessibilityLabel={t("wizard.next")}
            accessibilityState={{ disabled: !canAdvance }}
            {...focusRingProps}
            style={(state) => [
              styles.publishBtn,
              webCursor(!canAdvance),
              webTransition,
              !canAdvance ? styles.publishDisabled : null,
              webHover(state) && canAdvance ? styles.publishHovered : null,
              state.pressed && canAdvance ? styles.pressed : null,
            ]}
          >
            <Text style={styles.publishText}>{t("wizard.next")}</Text>
            <Icon icon={iconMap.ChevronRight} size={17} color={th.colors.onAccent} />
          </Pressable>
        )}
      </View>
    </ScrollView>
  )
}

export interface CreateCleanupStandaloneHost {
  onComposerReturn: () => void
  onGetVerified?: () => void
}

export interface CreateCleanupBodyProps {
  standalone?: CreateCleanupStandaloneHost
}

export function CreateCleanupBody({ standalone }: CreateCleanupBodyProps = {}) {
  const styles = useStyles()
  const { t } = useT("event-create")
  const { isAuthenticated, isPending } = useAuthState()
  const requireAuth = useRequireAuth()
  const navSeedReportId = useNavStore((s) => s.active?.reportId)
  const navSeedLat = useNavStore((s) => s.active?.lat)
  const navSeedLng = useNavStore((s) => s.active?.lng)
  const isStandalone = standalone !== undefined
  const seedReportId = isStandalone ? undefined : navSeedReportId
  const seedPoint = useMemo<HostSeedPoint | undefined>(
    () =>
      !isStandalone && navSeedLat != null && navSeedLng != null
        ? { lat: navSeedLat, lng: navSeedLng }
        : undefined,
    [isStandalone, navSeedLat, navSeedLng],
  )
  const inheritedScrollHost = useScrollHost()
  const scrollHost = isStandalone ? STANDALONE_SCROLL_HOST : inheritedScrollHost

  if (isPending) {
    return (
      <ScrollHostProvider value={scrollHost}>
        <HostFormSkeleton />
      </ScrollHostProvider>
    )
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.stateFill}>
        <SignInPrompt
          icon={iconMap.Leaf}
          tone="moss"
          variant="detail"
          title={t("signIn.title")}
          body={t("signIn.body")}
          onSignIn={() => requireAuth(() => {}, { next: "/host" })}
        />
      </View>
    )
  }

  return (
    <ScrollHostProvider value={scrollHost}>
      <HostForm
        {...(standalone ? { standalone } : {})}
        {...(seedReportId ? { seedReportId } : {})}
        {...(seedPoint ? { seedPoint } : {})}
      />
    </ScrollHostProvider>
  )
}

function HostFormSkeleton() {
  const { ScrollView } = useScrollHost()
  const styles = useStyles()
  const th = useTheme()
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {HOST_SKELETON_FIELDS.map((height, index) => (
        <SkeletonGroup key={index} style={styles.skeletonField}>
          <SkeletonText width="34%" height={11} />
          <SkeletonBlock width="100%" height={height} radius={th.radius.lg} />
        </SkeletonGroup>
      ))}
      <SkeletonBlock width="100%" height={44} radius={th.radius.pill} />
    </ScrollView>
  )
}

const HOST_SKELETON_FIELDS = [44, 88, 44, 44, 44] as const

const useStyles = makeThemedStyles((t) => ({
  skeletonField: { gap: t.space["2"] },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
    gap: t.space["4"],
  },
  stateFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    backgroundColor: t.colors.moss["50"],
    borderRadius: t.radius.md,
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["3"],
  },
  noteText: {
    flex: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 13,
    color: t.colors.moss["700"],
  },
  validationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
  },
  errorText: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.accentText,
  },
  hintText: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  stepHost: {
    gap: t.space["4"],
  },
  summaryCard: {
    gap: t.space["3"],
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["4"],
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: t.space["3"],
  },
  summaryMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  summaryLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  summaryValue: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 15,
    color: t.colors.text,
  },
  summarySub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textMuted,
  },
  editBtn: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: t.space["2"],
    borderRadius: t.radius.pill,
  },
  editBtnHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  editText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["13"],
    color: t.colors.accentText,
  },
  wizardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 52,
    paddingHorizontal: t.space["4"],
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  backBtnHovered: {
    backgroundColor: t.colors.surfaceTint,
    borderColor: t.colors.borderStrong,
  },
  backText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.textMuted,
  },
  publishBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["2"],
    height: 52,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.brand.bloom,
    ...t.shadows.pin,
  },
  publishHovered: {
    backgroundColor: t.colors.bloom["700"],
  },
  publishDisabled: {
    backgroundColor: t.colors.borderStrong,
    ...noShadow,
  },
  publishText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 15,
    color: t.colors.onAccent,
  },
  pressed: {
    opacity: 0.9,
  },
}))
