import { useCallback, useEffect, useRef, useState } from "react"
import type { ReportType as SharedReportType } from "@civfix/shared"
import { useNavStore } from "../../nav"
import { appErrorCode, appErrorFields } from "@civfix/shared"
import { useHaptics } from "../../capabilities"
import { useDraftReportStore } from "../../report/draftStore"
import {
  useReportSubmit,
  createSubmitRunSlot,
  SubmitRunDiscarded,
  type ReportSubmitOutcome,
} from "../../report/submit"
import { submitErrorMessage } from "../../report/submitErrors"
import { submitErrorRecovery, type Step, type SubmitRecovery } from "../../report/wizardSteps"
import { useViewerDraftGeneration } from "../../viewerScope"
import { useT } from "../../i18n"
import { usePostComposerStore } from "../postComposerStore"
import { shareSnapshotOf, type ShareSnapshot, type SubmitPhase, type SubmitSettled } from "./submitFlowModel"

const submitRuns = createSubmitRunSlot<SubmitSettled>({
  claimsItself: (settled) => settled.kind === "composer",
})

export interface ReportSubmitFlow {
  submitPhase: SubmitPhase
  submitError: string | null
  submitRecovery: SubmitRecovery | null
  result: ReportSubmitOutcome | null
  shareSnapshot: ShareSnapshot | null
  runSubmit: () => void
  editAfterFailure: () => void
}

export function useReportSubmitFlow({
  fromComposer,
  stepOrder,
  setStep,
}: {
  fromComposer: boolean
  stepOrder: Step[]
  setStep: (step: Step) => void
}): ReportSubmitFlow {
  const { t } = useT("report-wizard")
  const submit = useReportSubmit({ forComposer: fromComposer })
  const reset = useDraftReportStore((s) => s.reset)
  const haptics = useHaptics()

  const [submitPhase, setSubmitPhase] = useState<"idle" | "submitting" | "error" | "done">(() =>
    submitRuns.unclaimed() ? "submitting" : "idle",
  )
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitRecovery, setSubmitRecovery] = useState<SubmitRecovery | null>(null)
  const [result, setResult] = useState<ReportSubmitOutcome | null>(null)
  const [shareSnapshot, setShareSnapshot] = useState<ShareSnapshot | null>(null)
  // A wipe for a new viewer drops the slot's run; a body still on screen must drop what it showed of it too.
  const draftGeneration = useViewerDraftGeneration()
  const [submitGeneration, setSubmitGeneration] = useState(draftGeneration)
  if (submitGeneration !== draftGeneration) {
    setSubmitGeneration(draftGeneration)
    setSubmitPhase("idle")
    setSubmitError(null)
    setSubmitRecovery(null)
    setResult(null)
    setShareSnapshot(null)
  }

  const bodyMounted = useRef(true)
  useEffect(() => {
    bodyMounted.current = true
    return () => {
      bodyMounted.current = false
    }
  }, [])

  const followRun = useCallback(
    (run: Promise<SubmitSettled>) => {
      setSubmitPhase("submitting")
      setSubmitError(null)
      setSubmitRecovery(null)
      void run.then((settled) => {
        if (!bodyMounted.current) return
        if (!submitRuns.claim(run) || settled.kind === "discarded") {
          setSubmitPhase("idle")
          return
        }
        if (settled.kind === "composer") {
          setSubmitPhase("idle")
          return
        }
        if (settled.kind === "error") {
          setSubmitError(submitErrorMessage(settled.error, t))
          setSubmitRecovery(
            submitErrorRecovery(appErrorCode(settled.error), appErrorFields(settled.error), stepOrder),
          )
          setSubmitPhase("error")
          return
        }
        setShareSnapshot(settled.share)
        setResult(settled.result)
        setSubmitPhase("done")
      })
    },
    [t, stepOrder],
  )

  useEffect(() => {
    const pending = submitRuns.unclaimed()
    if (pending) followRun(pending)
  }, [followRun])

  const performSubmit = useCallback(async (isCurrent: () => boolean): Promise<SubmitSettled> => {
    try {
      const res = await submit(isCurrent)
      if (!isCurrent()) return { kind: "discarded" }
      const d = useDraftReportStore.getState().draft
      const share = shareSnapshotOf(d, t("review.untitled"))

      haptics.success()
      if (fromComposer) {
        const composer = usePostComposerStore.getState()
        composer.setAttachedReport({
          id: res.reportId,
          category: res.category ?? share.category ?? "other",
          type: (d.reportTypeId as SharedReportType | undefined) ?? undefined,
          title: share.title,
          status: res.status ?? "published",
          lat: res.lat,
          lng: res.lng,
          addr: share.addr,
          thumbUrl: share.thumbUrl,
          linkedAt: new Date().toISOString(),
        })
        composer.releaseClaimedCreate("report")
        reset()
        useNavStore.getState().finishReportFlow({ kind: "composer" })
        return { kind: "composer" }
      }

      reset()
      return { kind: "done", result: res, share }
    } catch (err) {
      if (err instanceof SubmitRunDiscarded || !isCurrent()) return { kind: "discarded" }
      haptics.error()
      return { kind: "error", error: err }
    }
  }, [fromComposer, submit, reset, t, haptics])

  const runSubmit = useCallback(() => {
    const run = submitRuns.start(performSubmit)
    if (run) followRun(run)
  }, [performSubmit, followRun])

  const editAfterFailure = useCallback(() => {
    const target = submitRecovery?.editStep ?? "review"
    setSubmitPhase("idle")
    setSubmitError(null)
    setSubmitRecovery(null)
    setStep(target)
  }, [setStep, submitRecovery])

  return { submitPhase, submitError, submitRecovery, result, shareSnapshot, runSubmit, editAfterFailure }
}
