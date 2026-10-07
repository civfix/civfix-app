import { useEffect } from "react"
import { useNavStore } from "../../nav"
import { usePostComposerStore } from "../postComposerStore"
import {
  deferReportRunRelease,
  reportRunSurvivesView,
  type ReportRunExitHost,
} from "../postComposerExit"

const REPORT_RUN_EXIT_HOST: ReportRunExitHost = {
  readView: () => useNavStore.getState().view,
  release: () => usePostComposerStore.getState().releaseClaimedCreate("report"),
  watchView: (onNavChange) => useNavStore.subscribe(onNavChange),
}

/**
 * The claim binds the composer's pending create to one live run, so an abandoned run cannot route a later
 * report into the composer.
 */
export function useReportRunClaim(runActive: boolean): void {
  const runSurvives = useNavStore((s) => reportRunSurvivesView(s.view))

  useEffect(() => {
    const composer = usePostComposerStore.getState()
    if (runActive) composer.claimPendingCreate("report")
    else if (!runSurvives) composer.releaseClaimedCreate("report")
    return () => deferReportRunRelease(REPORT_RUN_EXIT_HOST)
  }, [runActive, runSurvives])
}
