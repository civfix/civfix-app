/**
 * Stack rules for a create flow that publishes over the surface that launched it, and the report-wizard
 * entry. No react-native import, so this module unit-tests directly; `isFlowKind` comes from ../nav, the one
 * definition the collapse guard, `map/dropPinFlow` and `shell/backAffordance` also read, so "which kinds are
 * a flow" cannot drift between them.
 */
import { isFlowKind, useNavStore, type DetailEntry } from "../nav"
import { reportRunSurvivesView } from "./postComposerExit"
import { usePostComposerStore } from "./postComposerStore"

/**
 * The stack a create flow should leave behind when it PUBLISHES with no composer waiting: the flow's own
 * entry (and anything it pushed on top of it, such as a linked report's detail) REPLACED by the thing it
 * just created. It truncates at the topmost flow entry rather than calling `back()` once, because the form
 * can push forward first, so only the truncate is correct at any depth.
 *
 * A finished flow must relinquish its entry. `useNavStore.collapseToParent` refuses to collapse while ANY
 * entry on the stack is a flow kind, so a submitted `create-cleanup` left underneath would make the new
 * event's detail sheet impossible to drag away, and Back would land on a form whose draft was already
 * cleared. The fix belongs here rather than in the collapse guard, which is right that a live flow must not
 * be collapsed away.
 *
 * `null` when there is no flow entry: the caller was never in a flow and should push normally rather than
 * rewrite a stack it does not own.
 */
export function stackAfterFlowPublished(
  stack: readonly DetailEntry[],
  created: DetailEntry,
): DetailEntry[] | null {
  for (let index = stack.length - 1; index >= 0; index--) {
    const kind = stack[index]?.kind
    if (kind !== undefined && isFlowKind(kind)) return [...stack.slice(0, index), created]
  }
  return null
}

/**
 * Forget the report round trip the composer may still think is in flight, both the armed and the claimed
 * half. Only the report kind: an armed "event" belongs to a host form still on screen over the MOUNTED
 * composer, while the report side has no live surface to speak for it (the composer is dismissed before
 * `selectView("report")`).
 */
function dropReportCreateIntent(): void {
  const composer = usePostComposerStore.getState()
  if (composer.draft.pendingCreate === "report") composer.setPendingCreate(null)
  composer.releaseClaimedCreate("report")
}

/**
 * Open the report wizard from an entry point that is not the composer: the map long-press "Report an issue
 * here", the web sidebar's Report button, the dock's Report tab, mobile's `/report` deep link. Every such
 * entry goes through here; `__tests__/postComposerExit.test.ts` pins the ones in this package.
 *
 * A report run reached from anywhere but the composer cannot be part of a composer round trip, so it must
 * not inherit an intent the composer left armed or a claim a previous run leaked. The drop is gated on
 * {@link reportRunSurvivesView} because two entry points reach here while a run is already live, and
 * settling its claim from outside silently sends the report to the feed instead of the waiting post:
 *   - the dock's Report tab re-tapped mid-wizard, where the deselect guard below changes nothing on screen
 *     but an unconditional drop would already have released the claim;
 *   - the Report tab as the way back from a search detour on web, whose dock does not gate tabs on
 *     `searchActive` and has no exit circle, so releasing on the way in would leave the remounting wizard
 *     nothing to adopt.
 */
export function openReportFlow(): void {
  const nav = useNavStore.getState()
  // Same predicate as the activation effect, the deferred release and the detour watch, so the four cannot
  // drift.
  if (!reportRunSurvivesView(nav.view)) dropReportCreateIntent()
  // `selectView` on the already-current view with an empty stack DESELECTS back to the home feed (the dock's
  // re-tap rule), which would turn a second "Report an issue here" or a `/report` link into a trip to the
  // timeline that throws away the prefilled location. A non-empty stack still selects, which clears a detail
  // opened over the wizard.
  if (nav.view === "report" && nav.stack.length === 0) return
  // selectView clears the detail stack, which is why the composer's intent lives in postComposerStore rather
  // than on a nav entry.
  nav.selectView("report")
}

/**
 * Drop a report create-intent that no live run can be behind, as the composer mounts. A leaked claim (a run
 * whose body vanished on a host with no keep-alive) also vetoes the composer's genuine-exit discard, so the
 * previous report would otherwise ride along to every later "New post".
 *
 * A mount is not an arrival: on web a layout flip or StrictMode can remount the composer while the wizard it
 * launched already owns the screen and holds the claim, and clearing then would share the finished report
 * to the feed and wipe the draft's attachments. So the clear is gated on the shared
 * `reportRunSurvivesView` predicate; the cases it exists for all mount with `view` outside {report, search}.
 *
 * The return leg needs no gate: ReportFlowBody releases its claim BEFORE it pushes the composer entry. The
 * event kind is deliberately untouched (see {@link dropReportCreateIntent}).
 */
export function clearStaleReportIntentAtComposerMount(): void {
  if (reportRunSurvivesView(useNavStore.getState().view)) return
  dropReportCreateIntent()
}

