import { useEffect, useMemo, useState } from "react"
import { LayoutAnimation, Platform } from "react-native"
import type { CleanupDTO, LinkedEventRef } from "@civfix/shared"
import { useAttendingCleanups, useMyReports } from "../data"
import { attachableEvents, attachableReports } from "../data/composerAttachable"
import {
  buildComposerEventRef,
  buildPostComposerAttachPlan,
  postComposerSectionVisible,
  resolveComposerEvent,
  resolveComposerReport,
  shouldClearStaleAttachedEvent,
  shouldClearStaleAttachedReport,
  togglePostComposerAttachmentPanel,
  type PostComposerAttachmentPanel,
} from "./postComposerModel"
import type { PostComposerDraft, PostComposerMode } from "./postComposerStore"

function softenLayoutChange() {
  if (Platform.OS === "ios") LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
}

export interface PostComposerAttachInput {
  mode: PostComposerMode
  signedIn: boolean
  draft: PostComposerDraft
  setAttachedEvent: (event: LinkedEventRef | null) => void
  setAttachedReportId: (id: string | null) => void
}

/**
 * The event and report candidates the composer can attach, the draft's attached pair resolved against
 * them, and the section / pill-panel state that lists them.
 */
export function usePostComposerAttach({
  mode,
  signedIn,
  draft,
  setAttachedEvent,
  setAttachedReportId,
}: PostComposerAttachInput) {
  const events = useAttendingCleanups()
  const reports = useMyReports()
  const [attachmentPanel, setAttachmentPanel] = useState<PostComposerAttachmentPanel>(null)
  const [eventsExpanded, setEventsExpanded] = useState(false)
  const [reportsExpanded, setReportsExpanded] = useState(false)

  const eventItems = useMemo(() => events.data ?? [], [events.data])
  const attachedEvent = useMemo(
    () => resolveComposerEvent(draft.attachedEventId, draft.attachedEvent, eventItems),
    [draft.attachedEvent, draft.attachedEventId, eventItems],
  )
  const attachedCleanup = eventItems.find((event) => event.id === attachedEvent?.id)
  const reportItems = useMemo(
    () => reports.data?.pages.flatMap((page) => page.items) ?? [],
    [reports.data],
  )
  const attachedReport = useMemo(
    () => resolveComposerReport(draft.attachedReportId, draft.attachedReport, reportItems),
    [draft.attachedReportId, draft.attachedReport, reportItems],
  )
  const eventCandidates = useMemo(() => attachableEvents(eventItems, Date.now()), [eventItems])
  const reportCandidates = useMemo(() => attachableReports(reportItems), [reportItems])

  useEffect(() => {
    if (
      shouldClearStaleAttachedEvent({
        attachedEventId: draft.attachedEventId,
        resolved: attachedEvent != null,
        loaded: events.isSuccess,
      })
    ) {
      setAttachedEvent(null)
    }
  }, [attachedEvent, draft.attachedEventId, events.isSuccess, setAttachedEvent])
  useEffect(() => {
    if (
      shouldClearStaleAttachedReport({
        attachedReportId: draft.attachedReportId,
        resolved: attachedReport != null,
        loaded: reports.isSuccess,
        hasNextPage: reports.hasNextPage === true,
        hasSnapshot: draft.attachedReport != null,
      })
    ) {
      setAttachedReportId(null)
    }
  }, [
    attachedReport,
    draft.attachedReport,
    draft.attachedReportId,
    reports.hasNextPage,
    reports.isSuccess,
    setAttachedReportId,
  ])

  const attachPlan = buildPostComposerAttachPlan({
    mode,
    signedIn,
    attachmentPanel,
    events: {
      loaded: events.isSuccess || events.isError,
      count: eventCandidates.length,
      expanded: eventsExpanded,
      attached: attachedEvent != null,
    },
    reports: {
      loaded: reports.isSuccess || reports.isError,
      count: reportCandidates.length,
      expanded: reportsExpanded,
      hasNextPage: reports.hasNextPage === true,
      attached: attachedReport != null,
    },
  })
  const eventsSectionVisible =
    attachPlan.variant === "sections" && postComposerSectionVisible(attachPlan.events.state)
  const reportsSectionVisible =
    attachPlan.variant === "sections" && postComposerSectionVisible(attachPlan.reports.state)

  const attachEvent = (event: CleanupDTO) => {
    softenLayoutChange()
    setAttachedEvent(buildComposerEventRef(event, new Date().toISOString()))
    setEventsExpanded(false)
    setAttachmentPanel(null)
  }
  const detachEvent = () => {
    softenLayoutChange()
    setAttachedEvent(null)
    setEventsExpanded(false)
  }
  const attachReport = (id: string) => {
    softenLayoutChange()
    setAttachedReportId(id)
    setReportsExpanded(false)
    setAttachmentPanel(null)
  }
  const detachReport = () => {
    softenLayoutChange()
    setAttachedReportId(null)
    setReportsExpanded(false)
  }
  const showMoreEvents = () => {
    softenLayoutChange()
    setEventsExpanded(true)
  }
  const showFewerEvents = () => {
    softenLayoutChange()
    setEventsExpanded(false)
  }
  const showMoreReports = () => {
    const revealsLoaded = reportCandidates.length > attachPlan.reports.visibleCount
    if (!reportsExpanded) {
      softenLayoutChange()
      setReportsExpanded(true)
    }
    if (!revealsLoaded && reports.hasNextPage && !reports.isFetchingNextPage) void reports.fetchNextPage()
  }
  const showFewerReports = () => {
    softenLayoutChange()
    setReportsExpanded(false)
  }
  const fetchMoreReports = () => {
    if (reports.hasNextPage && !reports.isFetchingNextPage) void reports.fetchNextPage()
  }
  const togglePanel = (panel: Exclude<PostComposerAttachmentPanel, null>) =>
    setAttachmentPanel((current) => togglePostComposerAttachmentPanel(current, panel))
  const resetAttachUi = () => {
    setAttachmentPanel(null)
    setEventsExpanded(false)
    setReportsExpanded(false)
  }

  return {
    attachPlan,
    attachedEvent,
    attachedCleanup,
    attachedReport,
    eventCandidates,
    reportCandidates,
    eventsExpanded,
    reportsExpanded,
    eventsSectionVisible,
    reportsSectionVisible,
    fetchingMoreReports: reports.isFetchingNextPage,
    attachEvent,
    detachEvent,
    attachReport,
    detachReport,
    showMoreEvents,
    showFewerEvents,
    showMoreReports,
    showFewerReports,
    fetchMoreReports,
    togglePanel,
    resetAttachUi,
  }
}

export type PostComposerAttach = ReturnType<typeof usePostComposerAttach>
