import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View, Pressable, StyleSheet } from "react-native"
import { makeThemedStyles, motion, useTheme, useLayoutMode, focusRingProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { KeyboardPinnedFooter, KeyboardPinnedSurface } from "../primitives"
import { PortraitMapPickStep } from "../map"
import { useNavStore } from "../nav"
import { useScrollHost } from "../shell/ScrollHost"
import {
  DETAIL_BACK_SIZE,
  DETAIL_BACK_RADIUS,
  DETAIL_BACK_ICON_SIZE,
  detailTitleStyle,
  tabRootTitleStyle,
} from "../shell/detailHeader"
import { showBackAffordance } from "../shell/backAffordance"
import { StepTransition } from "../shell/StepTransition"
import { WizardStepHeader } from "../shell/WizardStepHeader"
import { useStackDirection } from "../shell/useStackDirection"
import { announce } from "../announce"
import { HEADER_CONTROL_SIZE } from "../primitives/headerControls"
import { HeaderProfileButton } from "./HeaderProfileButton"
import { useCamera, useHaptics } from "../capabilities"
import type { CapturedMedia } from "../capabilities"
import { useDraftReportStore, captureSeedsNewReport } from "../report/draftStore"
import { usePostComposerStore } from "./postComposerStore"
import {
  type Step,
  stepOrderFor,
  resumeStep,
  stepAfterCapture,
  canAdvanceStep,
  showsCaptureCard,
  showsWizardFooter,
  wizardHeaderMode,
  rendersEmbeddedViewfinder,
  viewfinderResumeGraceEligible,
  viewfinderSessionActive,
} from "../report/wizardSteps"
import { useT } from "../i18n"
import { CaptureStep } from "./reportFlow/CaptureStep"
import { CategoryStep } from "./reportFlow/CategoryStep"
import { DetailsStep } from "./reportFlow/DetailsStep"
import { LocationStep } from "./reportFlow/LocationStep"
import { ReviewStep } from "./reportFlow/ReviewStep"
import { SubmitState } from "./reportFlow/SubmitState"
import { useFlowStyles } from "./reportFlow/flowStyles"
import { usePickLayer } from "./reportFlow/usePickLayer"
import { useReportRunClaim } from "./reportFlow/useReportRunClaim"
import { useReportSubmitFlow } from "./reportFlow/useReportSubmitFlow"

const VIEWFINDER_MOUNT_DELAY_MS = motion.pagePush.duration

export function ReportFlowBody() {
  const styles = useStyles()
  const flowStyles = useFlowStyles()
  const th = useTheme()
  const { t } = useT("report-wizard")
  const { ScrollView } = useScrollHost()
  const fromComposer = usePostComposerStore((s) => s.claimedCreate) === "report"
  const mode = useLayoutMode()
  const haptics = useHaptics()
  const Viewfinder = useCamera().Viewfinder ?? null
  const stackNonEmpty = useNavStore((s) => s.stack.length > 0)
  const runActive = useNavStore((s) => s.view === "report")

  useReportRunClaim(runActive)

  const [skipLocationStep] = useState(() => {
    const d = useDraftReportStore.getState().draft
    return d.locationPrefilled && d.lat != null && d.lng != null
  })
  const stepOrder = useMemo(
    () => stepOrderFor(mode, { skipLocation: skipLocationStep }),
    [mode, skipLocationStep],
  )

  const [step, setStep] = useState<Step>(() => resumeStep(useDraftReportStore.getState().draft, mode))
  const [viewfinderMountable, setViewfinderMountable] = useState(false)
  const { submitPhase, submitError, submitRecovery, result, shareSnapshot, runSubmit, editAfterFailure } =
    useReportSubmitFlow({ fromComposer, stepOrder, setStep })
  const scrollRef = useRef<{ scrollTo?: (opts: { y: number; animated?: boolean }) => void } | null>(null)
  const revealShareBlock = useCallback((y: number) => {
    scrollRef.current?.scrollTo?.({ y, animated: true })
  }, [])

  const hasMedia = useDraftReportStore((s) => s.draft.media.length > 0)
  const reportTypeId = useDraftReportStore((s) => s.draft.reportTypeId)
  const title = useDraftReportStore((s) => s.draft.title)
  const hasLocation = useDraftReportStore((s) => s.draft.lat != null && s.draft.lng != null)

  const orphaned = stepOrder.indexOf(step) < 0
  const resumedStep = useDraftReportStore((s) => resumeStep(s.draft, mode))
  const activeStep = orphaned ? resumedStep : step
  useEffect(() => {
    if (orphaned) setStep(activeStep)
  }, [orphaned, activeStep])

  const viewfinderVisible = rendersEmbeddedViewfinder(activeStep, hasMedia, Viewfinder != null, mode)
  const captureCardFills = mode === "expanded" && showsCaptureCard(activeStep, hasMedia, Viewfinder != null, mode)

  useEffect(() => {
    const handle = setTimeout(() => setViewfinderMountable(true), VIEWFINDER_MOUNT_DELAY_MS)
    return () => clearTimeout(handle)
  }, [])
  const viewfinderMounted = viewfinderVisible && viewfinderMountable

  const canAdvance = canAdvanceStep(activeStep, {
    hasMedia,
    hasLocation,
    hasReportType: reportTypeId !== null,
    hasTitle: title.trim().length > 0,
  })

  const stepIndex = Math.max(0, stepOrder.indexOf(activeStep))
  const stepDirection = useStackDirection(stepIndex)
  const stepTitle = t(`wizard.${activeStep}.title`)
  useEffect(() => {
    announce(
      t("wizard.announceStep", {
        current: stepIndex + 1,
        total: stepOrder.length,
        title: stepTitle,
      }),
    )
  }, [stepIndex, stepOrder.length, stepTitle, t])
  const isLast = activeStep === "review"
  const showBack = useNavStore((s) => showBackAffordance({ stack: s.stack, mode, stepIndex }))
  const atViewRoot = stepIndex === 0 && !stackNonEmpty
  const sessionActive = viewfinderSessionActive(activeStep, viewfinderMounted, stackNonEmpty, runActive)
  const sessionResumeGrace = viewfinderResumeGraceEligible(
    activeStep,
    viewfinderMounted,
    stackNonEmpty,
    runActive,
  )

  const onBack = useCallback(() => {
    if (stepIndex <= 0) {
      useNavStore.getState().leaveReportFlow()
      return
    }
    setStep(stepOrder[stepIndex - 1] as Step)
  }, [stepIndex, stepOrder])

  const advanceFromCapture = useCallback(() => {
    setStep(stepAfterCapture(useDraftReportStore.getState().draft, mode, stepOrder))
  }, [mode, stepOrder])

  const onNext = useCallback(() => {
    if (!canAdvance) return
    if (isLast) {
      runSubmit()
      return
    }
    haptics.selection()
    if (activeStep === "capture") {
      advanceFromCapture()
      return
    }
    setStep(stepOrder[stepIndex + 1] as Step)
  }, [activeStep, advanceFromCapture, canAdvance, haptics, isLast, runSubmit, stepIndex, stepOrder])

  const advanceFromLocation = useCallback(() => {
    setStep((s) => {
      const i = stepOrder.indexOf(s)
      return (stepOrder[i + 1] as Step) ?? s
    })
  }, [stepOrder])
  const cancelLocation = useCallback(() => {
    setStep((s) => {
      const i = stepOrder.indexOf(s)
      return (stepOrder[i - 1] as Step) ?? "capture"
    })
  }, [stepOrder])

  const onViewfinderCaptured = useCallback((media: CapturedMedia) => {
    const store = useDraftReportStore.getState()
    if (captureSeedsNewReport(store.draft)) store.startFromCapture(media)
    else store.addCapture(media)
  }, [])

  const { pickPoint, pickPin, pickCenter, openPicker, onPickConfirm, onPickCancel, pickLayerOpen, pickLayerMounted } =
    usePickLayer({
      activeStep,
      hasMedia,
      hasLocation,
      stackNonEmpty,
      runActive,
      advanceFromLocation,
      cancelLocation,
    })

  if (submitPhase !== "idle") {
    return (
      <View style={styles.root}>
        <SubmitState
          phase={submitPhase}
          error={submitError}
          retryable={submitRecovery?.retryable ?? true}
          result={result}
          share={shareSnapshot}
          onRetry={runSubmit}
          onEdit={editAfterFailure}
        />
      </View>
    )
  }

  return (
    <KeyboardPinnedSurface style={styles.root}>
      {wizardHeaderMode(mode, showBack, atViewRoot) === "tab-root" ? (
        <View style={[styles.headerRootRow, mode === "expanded" ? styles.headerRootRowExpanded : null]}>
          <Text style={styles.headerTitleRoot} numberOfLines={1} accessibilityRole="header">
            {t("header.title")}
          </Text>
          <HeaderProfileButton />
        </View>
      ) : (
        <View style={[styles.headerBase, mode === "expanded" ? styles.headerExpanded : styles.headerCompact]}>
          {showBack ? (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={t("header.back")}
              hitSlop={8}
              {...focusRingProps}
              style={({ pressed }) => [
                styles.backBase,
                mode === "expanded" ? styles.backExpanded : styles.backCompact,
                pressed ? flowStyles.pressed : null,
              ]}
            >
              <Icon icon={iconMap.ArrowLeft} size={DETAIL_BACK_ICON_SIZE} color={th.colors.text} />
            </Pressable>
          ) : null}
          <Text
            style={mode === "expanded" ? styles.headerTitleExpanded : styles.headerTitleCompact}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {t("header.title")}
          </Text>
        </View>
      )}

      <View style={styles.wizardHead}>
        <WizardStepHeader
          step={stepIndex + 1}
          total={stepOrder.length}
          title={stepTitle}
          help={t(`wizard.${activeStep}.help`)}
        />
      </View>

      {viewfinderVisible ? (
        <View style={styles.viewfinderLayer}>
          {viewfinderMounted && Viewfinder ? (
            <Viewfinder
              active={sessionActive}
              resumeGrace={sessionResumeGrace}
              onCaptured={onViewfinderCaptured}
            />
          ) : null}
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            captureCardFills ? styles.contentFill : null,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StepTransition
            transitionKey={activeStep}
            direction={stepDirection}
            style={captureCardFills ? styles.stepHostFill : null}
          >
            {activeStep === "capture" ? (
              <CaptureStep mode={mode} />
            ) : null}
            {activeStep === "location" ? (
              <LocationStep onOpenPicker={openPicker} />
            ) : null}
            {activeStep === "category" ? <CategoryStep /> : null}
            {activeStep === "details" ? <DetailsStep /> : null}
            {activeStep === "review" ? (
              <ReviewStep
                fromComposer={fromComposer}
                onRequestReveal={revealShareBlock}
                onOpenPicker={openPicker}
              />
            ) : null}
          </StepTransition>
        </ScrollView>
      )}

      {showsWizardFooter(activeStep, hasMedia) ? (
        <KeyboardPinnedFooter style={styles.footer}>
          <Pressable
            onPress={onNext}
            disabled={!canAdvance}
            accessibilityRole="button"
            accessibilityLabel={isLast ? t("footer.drop_pin") : t("footer.continue")}
            accessibilityState={{ disabled: !canAdvance }}
            {...focusRingProps}
            style={({ pressed }) => [
              styles.nextBtn,
              !canAdvance ? styles.nextDisabled : [styles.nextActive, th.shadows.pin],
              pressed && canAdvance ? flowStyles.pressed : null,
            ]}
          >
            <Text style={[styles.nextText, { color: canAdvance ? th.colors.onAccent : th.colors.textSubtle }]}>
              {isLast ? t("footer.drop_pin") : t("footer.continue")}
            </Text>
            <View style={styles.nextIcon}>
              <Icon
                icon={isLast ? iconMap.MapPin : iconMap.ChevronRight}
                size={16}
                color={canAdvance ? th.colors.onAccent : th.colors.textSubtle}
              />
            </View>
          </Pressable>
        </KeyboardPinnedFooter>
      ) : null}

      <PortraitMapPickStep
        visible={pickLayerMounted}
        inert={!pickLayerOpen}
        presentation="layer"
        value={pickPoint}
        initialCenter={pickCenter.center}
        centerSettled={pickCenter.settled}
        onConfirm={onPickConfirm}
        onCancel={onPickCancel}
        pin={pickPin}
      />
    </KeyboardPinnedSurface>
  )
}

const HEADER_PAD_COMPACT = { top: 6, bottom: 12 } as const
const HEADER_PAD_EXPANDED = { top: 14, bottom: 12 } as const
const ROOT_ROW_CONTENT_HEIGHT_EXPANDED = 44

const useStyles = makeThemedStyles((t) => ({
  root: { flex: 1 },
  headerBase: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerCompact: {
    gap: t.space["2"],
    paddingHorizontal: t.space["4"],
    paddingTop: HEADER_PAD_COMPACT.top,
    paddingBottom: HEADER_PAD_COMPACT.bottom,
    minHeight: HEADER_PAD_COMPACT.top + DETAIL_BACK_SIZE + HEADER_PAD_COMPACT.bottom,
  },
  headerExpanded: {
    gap: 10,
    paddingTop: HEADER_PAD_EXPANDED.top,
    paddingHorizontal: 18,
    paddingBottom: HEADER_PAD_EXPANDED.bottom,
    minHeight: HEADER_PAD_EXPANDED.top + DETAIL_BACK_SIZE + HEADER_PAD_EXPANDED.bottom,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  backBase: {
    width: DETAIL_BACK_SIZE,
    height: DETAIL_BACK_SIZE,
    borderRadius: DETAIL_BACK_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  backCompact: {
    marginLeft: -t.space["2"],
  },
  backExpanded: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceTint,
  },
  headerTitleCompact: { ...detailTitleStyle(t.fontSize["16"], t), flex: 1 },
  headerTitleExpanded: { ...detailTitleStyle(t.fontSize["18"], t), flex: 1 },
  headerRootRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: HEADER_CONTROL_SIZE,
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["1"],
  },
  headerRootRowExpanded: {
    paddingTop: HEADER_PAD_EXPANDED.top,
    minHeight: HEADER_PAD_EXPANDED.top + ROOT_ROW_CONTENT_HEIGHT_EXPANDED + t.space["1"],
  },
  headerTitleRoot: { ...tabRootTitleStyle(t), flex: 1 },
  scroll: { flex: 1 },
  wizardHead: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["2"],
  },
  viewfinderLayer: {
    flex: 1,
    marginTop: t.space["2"],
    backgroundColor: t.colors.bg,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["8"],
    gap: t.space["4"],
  },
  contentFill: { flexGrow: 1 },
  stepHostFill: { flexGrow: 1 },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["3"],
    paddingBottom: t.space["4"],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
    backgroundColor: t.colors.bg,
  },
  nextBtn: {
    flex: 1,
    height: 50,
    borderRadius: t.radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  nextActive: { backgroundColor: t.colors.brand.bloom },
  nextDisabled: { backgroundColor: t.colors.neutral.ink5 },
  nextText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["15"],
  },
  nextIcon: { marginLeft: 6 },
}))
