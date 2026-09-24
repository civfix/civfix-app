/**
 * The decisions around the persistent host-event draft's lifetime, kept out of CreateCleanupBody so
 * they unit-test without mounting the form (which pulls the map + geocoder in). Type-only imports keep
 * this module RN-free.
 */
import type { DetailEntry } from "../nav"
import type { DraftReport } from "../report/draftStore"
import type { CleanupFormValue } from "./cleanupFormModel"

/** Two coordinates this close are the same long-press point, not a float round-trip apart. */
const SAME_POINT_EPSILON_DEG = 1e-9

/**
 * Whether unmounting the host form is a GENUINE EXIT (clear the draft) rather than a forward drill-down
 * that will come back to it ("View details" on a linked report, then "Back to your event").
 *
 * Read the nav STACK, not just its top: a forward push leaves the create-cleanup entry on the stack
 * below the new top, while backing out pops it off entirely. Checking only the top would keep the draft
 * on a back-exit that lands on a parent detail (the report the flow was launched from), and the stale
 * draft would hijack the next "Host an event".
 */
export function isGenuineHostExit(stack: readonly DetailEntry[]): boolean {
  return !stack.some((entry) => entry.kind === "create-cleanup")
}

/**
 * Whether this mount's seed report is a NEW one for an already-active draft, i.e. the user tapped
 * "Host an event" from report B while a draft launched from report A (or an unseeded draft) is still in
 * progress. `begin()` no-ops while a draft is active, so without this the form would silently resume A's
 * draft and ignore seed B. Resuming via "Back to your event" pushes no reportId at all, so it never
 * trips this.
 *
 * The answer is MERGE, never discard: the caller links the new report into the surviving draft and keeps
 * every typed field (title/description/bring/slots/location). Clearing here instead would trade a wrong-link
 * bug for silent loss of everything the host had written - a draft is only ever dropped on a genuine
 * exit (isGenuineHostExit) or a successful publish.
 */
export function shouldMergeSeedIntoDraft(
  draftActive: boolean,
  draftSeedReportId: string | undefined,
  seedReportId: string | undefined,
): boolean {
  return draftActive && seedReportId != null && seedReportId !== draftSeedReportId
}

/** What the host form's mount step READS off the draft store - see {@link planHostDraftMount}. */
export interface HostDraftSnapshot {
  active: boolean
  value: CleanupFormValue | null
}

/** What the host form's mount step WRITES to the draft store - see {@link commitHostDraftMount}. */
export interface HostDraftTarget extends HostSeedPointTarget {
  isLinked: (id: string) => boolean
  toggleLinkedReport: (id: string) => void
  begin: (initial: CleanupFormValue) => void
}

export interface HostDraftMountPlan {
  /** This mount BEGINS the draft (the store was idle) - gates the launched-from-report location seed. */
  startedFresh: boolean
  /** The report the draft is attributed to once committed (the caller's `draftSeedReportId`'s next value). */
  seedReportId: string | undefined
  /** A report id to LINK into the RESUMED draft, or undefined. A fresh draft carries its seed in `value`. */
  linkReportId: string | undefined
  /** The point to land on the RESUMED draft, or undefined. A fresh draft carries it in `value`. */
  movePointTo: HostSeedPoint | undefined
  /**
   * The draft value as of the END of this mount's step - i.e. exactly what the store holds once
   * {@link commitHostDraftMount} has run. THE FORM RENDERS THIS until the commit lands, so the first paint
   * shows the merged draft (the newly linked report, the pressed point) rather than the pre-merge one.
   */
  value: CleanupFormValue
}

/**
 * The PURE half of the host form's ONE mount-time draft step: decide whether this mount begins a fresh
 * draft or resumes the live one - merging this mount's seed report into it when the flow was re-entered
 * through a different report - and compute the value that leaves. WRITES NOTHING.
 *
 * Plan in render, write in an effect: a store write during render makes React refuse to update the
 * store's other subscribers, and the launching report's body is one ("Back to your event", "Add to
 * event") that `shell/PageStack.native` keeps mounted under the host page. Planning purely keeps the first
 * render identical.
 *
 * Merging (rather than clearing and starting over) is the whole point: everything the host typed
 * (title, description, bring list, SIGNUP SLOTS, chosen point) survives a "Host an event" tapped from
 * another report, and that report is simply added to linkedReportIds.
 *
 * `slots` rides along exactly like `bring`: the whole `CleanupFormValue` is carried VERBATIM (a fresh
 * mount hands `initial` through untouched, and the merge path only ever spreads the LIVE value), so no
 * code here may reconstruct, re-key or re-sort a slot draft. Re-keying alone would remount every card
 * mid-edit and lose the caret.
 */
export function planHostDraftMount(
  draft: HostDraftSnapshot,
  seedReportId: string | undefined,
  draftSeedReportId: string | undefined,
  initial: CleanupFormValue,
  seedPoint?: HostSeedPoint,
): HostDraftMountPlan {
  const wasActive = draft.active
  const live = draft.value
  // Fresh: `begin` will seed linkedReportIds (and the pressed point) straight from `initial`, so there is
  // nothing to merge and nothing to move. `active` without a value cannot happen (begin/clear set both),
  // but were it ever to, `begin` would no-op and this correctly plans no merge into a draft that is not there.
  if (!wasActive || !live) {
    return {
      startedFresh: !wasActive,
      seedReportId: wasActive ? draftSeedReportId : seedReportId,
      linkReportId: undefined,
      movePointTo: undefined,
      value: initial,
    }
  }
  // Resumed. The link is guarded by "already linked?" - re-entering through a report the host already added
  // must not UNLINK it (the store's toggle is symmetric).
  const merges = seedReportId != null && shouldMergeSeedIntoDraft(true, draftSeedReportId, seedReportId)
  const linkReportId =
    merges && seedReportId != null && !live.linkedReportIds.includes(seedReportId) ? seedReportId : undefined
  // `begin()` NO-OPS while a draft is already active, so a seed coordinate would be silently discarded for a
  // host who already had one in progress. The pressed point moves the RESUMED draft instead - every typed
  // field (title/description/bring/slots/links) stays. Same point = no move, so nothing churns.
  const movePointTo =
    seedPoint && !(live.coords && live.coords.lat === seedPoint.lat && live.coords.lng === seedPoint.lng)
      ? seedPoint
      : undefined
  let value = live
  if (linkReportId != null) {
    value = { ...value, linkedReportIds: [...value.linkedReportIds, linkReportId] }
  }
  if (movePointTo) {
    value = { ...value, coords: { lat: movePointTo.lat, lng: movePointTo.lng } }
  }
  return {
    startedFresh: false,
    seedReportId: merges ? seedReportId : draftSeedReportId,
    linkReportId,
    movePointTo,
    value,
  }
}

/**
 * The WRITE half: apply a {@link planHostDraftMount} plan to the real store. MUST be called from an effect,
 * never from render (see the planner's doc) - and exactly once per mount, so it can never re-fire when a
 * retained page layer is buried and revealed again. Re-firing would silently re-link a report the host had
 * just REMOVED from the draft, and shove the pin back to the launch point they had just moved.
 *
 * Every write still goes through the store's own guarded operations rather than a wholesale `patch` of the
 * planned value: `begin` is an atomic begin-if-absent, the link goes through `toggleLinkedReport` behind
 * `isLinked`, and the point goes through `applyHostSeedPoint`. So a draft that changed between the plan and
 * this commit is resumed, never clobbered.
 */
export function commitHostDraftMount(draft: HostDraftTarget, plan: HostDraftMountPlan): void {
  if (plan.startedFresh) {
    draft.begin(plan.value)
    return
  }
  if (plan.linkReportId != null && !draft.isLinked(plan.linkReportId)) {
    draft.toggleLinkedReport(plan.linkReportId)
  }
  if (plan.movePointTo) applyHostSeedPoint(draft, plan.movePointTo)
}

/** A point supplied from OUTSIDE the host form (the map long-press "Host an event here"). */
export interface HostSeedPoint {
  lat: number
  lng: number
}

/** The slice of the cleanup draft store {@link applyHostSeedPoint} needs. */
export interface HostSeedPointTarget {
  value: CleanupFormValue | null
  patch: (value: CleanupFormValue) => void
}

/**
 * Overwrite the meeting point of a LIVE host draft with an externally supplied coordinate, keeping every
 * typed field (title / description / bring / date / time / links) intact.
 *
 * `useCleanupDraft.begin()` is a NO-OP while a draft is already active, so the seed
 * coordinate a mount hands to `emptyCleanupForm()` is silently discarded when the host already has a
 * draft in progress. The long-press flow must still land the pin the user just pressed, so the resumed
 * draft is PATCHED instead of begun.
 *
 * Returns false (and touches nothing) when there is no draft, or when the draft already sits on exactly
 * this point - so a re-render / a StrictMode double-effect cannot churn the store.
 */
export function applyHostSeedPoint(draft: HostSeedPointTarget, point: HostSeedPoint): boolean {
  const value = draft.value
  if (!value) return false
  const current = value.coords
  if (current && current.lat === point.lat && current.lng === point.lng) return false
  draft.patch({ ...value, coords: { lat: point.lat, lng: point.lng } })
  return true
}

/**
 * Decide what a map long-press "Report an issue here" does to the LIVE report draft. Symmetrical to
 * {@link applyHostSeedPoint} on the event side.
 *
 * `useDraftReportStore` is module-level and survives body unmount, and its only reset (`startFromCapture`)
 * runs solely when the draft has no media yet. So without this decision, tapping "Report an issue here" on
 * a fresh spot while a half-finished report sits in memory would merely overwrite its coordinates, and
 * `resumeStep` would drop the user on the REVIEW screen of a DIFFERENT report carrying the old photos,
 * category and title.
 *
 *   - `"seed"`          - just set the prefilled point (empty draft, or the very same spot).
 *   - `"confirm-reset"` - real work is in progress at a DIFFERENT spot: ask before discarding it.
 */
export function planDropPinReportSeed(
  draft: Pick<DraftReport, "media" | "reportTypeId" | "lat" | "lng">,
  point: { lat: number; lng: number },
): "seed" | "confirm-reset" {
  const hasWork = draft.media.length > 0 || draft.reportTypeId !== null
  const sameSpot =
    draft.lat != null &&
    draft.lng != null &&
    Math.abs(draft.lat - point.lat) < SAME_POINT_EPSILON_DEG &&
    Math.abs(draft.lng - point.lng) < SAME_POINT_EPSILON_DEG
  return hasWork && !sameSpot ? "confirm-reset" : "seed"
}
