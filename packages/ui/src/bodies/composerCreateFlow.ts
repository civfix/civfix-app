/**
 * THE COMPOSER -> CREATE-A-THING -> BACK-TO-THE-COMPOSER ROUND TRIP.
 *
 * THE RULE (both halves): a create flow launched from the post composer's "+ New event" must open ON TOP OF
 * the composer and, on publish, land the user back IN that same composer with the new thing attached. It
 * must never route THROUGH another surface on the way out or on the way back.
 *
 * THE BUG THIS FIXES. `PostComposer.leaveForCreate` used to DISMISS the composer surface (`onBack ??
 * nav.back()`) and only then push `{kind:"create-cleanup"}`. `nav.back()` empties the stack and nulls
 * `originView` but does NOT touch `view`, which is still "home" - so the freshly pushed host form landed as
 * the ROOT of a brand-new stack over the HOME FEED. The user tapped "New event" inside a half-written post
 * and got kicked out to the timeline with the host pull-up rising over it ("it should open the pull-up menu
 * directly there instead of in the home page"). The return leg had the mirror-image flaw: on publish the
 * host form pushed a FRESH `{kind:"composer"}` entry, so the composer the user came back to was a second
 * entry stacked on top of the create-cleanup entry rather than the one they left.
 *
 * WHY A SHEET CAN NOW RIDE OVER THE COMPOSER. `BODY_LAYOUT.composer` is "full" (an overlay layer) and
 * `BODY_LAYOUT["create-cleanup"]` is "scroll" (the pull-up sheet), and `shell/bodyLayout.ts` used to derive
 * BOTH layers from the single ACTIVE entry - making them mutually exclusive by construction. It now resolves
 * the overlay from the TOPMOST "full" entry anywhere on the STACK (`topmostFullEntry`), so `[composer,
 * create-cleanup]` paints the composer on the overlay layer AND the host form as the sheet above it, with
 * the composer's `transitionKey` unchanged (no remount, so the draft's UI state survives).
 *
 * THE TEMPTING-BUT-WRONG ALTERNATIVES, all of which were tried or considered:
 *   - `openDetail({kind:"create-cleanup"})` instead of `push`: `openDetail` REPLACES the stack, which
 *     destroys the very composer entry the overlay layer needs. `push` APPENDS in both shell modes.
 *   - a single `nav.back()` on the return leg instead of {@link stackAfterComposerReturn}: correct only when
 *     the host form is exactly one entry deep. The form can push `verify` ("Get verified" banner) or a
 *     linked report's detail first, and one `back()` would then leave the user parked mid-flow. Truncating
 *     to the waiting composer is correct at ANY depth.
 *
 * No react-native import, so this module unit-tests directly under vitest. The one VALUE it imports is
 * `isFlowKind` from ../nav - the same single source of truth the collapse guard, `map/dropPinFlow` and
 * `shell/backAffordance` all read, so "which kinds are a flow" cannot drift between them (this is exactly
 * what `shell/backAffordance.ts` does, and for the same reason).
 */
import { isFlowKind, useNavStore, type DetailEntry } from "../nav"
import { reportRunSurvivesView } from "./postComposerExit"
import { usePostComposerStore } from "./postComposerStore"

/**
 * The stack a create flow should leave behind when it returns to a WAITING composer: everything up to and
 * including the topmost `composer` entry, i.e. the flow's own entry (plus anything it pushed on top of it)
 * popped in ONE step.
 *
 * `null` when no composer entry survived - the report wizard's round trip (`selectView` clears the stack)
 * and the mobile screen-hosted composer both hit that case, and their callers must fall back to their own
 * return (push a fresh entry / dismiss the host surface).
 *
 * NOTE the interaction with `isGenuineHostExit` (cleanupDraftExit.ts): after the truncate the stack no
 * longer contains `create-cleanup`, so the host form's unmount effect correctly reads a genuine exit and
 * clears the draft - the same outcome as before, and harmless because the publish path clears it explicitly.
 */
export function stackAfterComposerReturn(
  stack: readonly DetailEntry[],
): DetailEntry[] | null {
  for (let index = stack.length - 1; index >= 0; index--) {
    if (stack[index]?.kind === "composer") return stack.slice(0, index + 1)
  }
  return null
}

/**
 * The stack a create flow should leave behind when it PUBLISHES with no composer waiting: the flow's own
 * entry (and anything it pushed on top of it) REPLACED by the thing it just created.
 *
 * THE BUG THIS FIXES, and it is a two-for-one. `CreateCleanupBody`'s happy path ended in `pushCleanup`,
 * which APPENDS - leaving `[create-cleanup, cleanup]`. Two things went wrong with that:
 *
 *   1. `useNavStore.collapseToParent` refuses to collapse while ANY entry on the stack is a flow kind (it
 *      scans the whole stack, because a collapse clears every entry, so a flow BELOW the top is just as
 *      abandoned as one on it). With the submitted `create-cleanup` still sitting underneath, the freshly
 *      published event's detail sheet could not be DRAGGED AWAY at all - the one gesture that is supposed
 *      to be a pull-up's universal exit, dead on the success screen.
 *   2. Back from that detail returned to the host form the user had already submitted - a stale, re-armed
 *      copy of a form whose draft was cleared, which is not a place Back should ever land.
 *
 * Both have the same cause: a FINISHED flow left its entry on the stack. The entry is the flow's claim on
 * the stack, so completing the flow must RELINQUISH it. That is what this does, and it is why the fix
 * belongs here rather than in the collapse guard: the guard is right that a live flow must not be
 * collapsed away, and widening or narrowing it would only trade this bug for the draft-loss it prevents.
 *
 * Everything above the flow entry goes too (the form can push `verify` or a linked report's detail first),
 * which is the same truncate-at-any-depth reasoning as {@link stackAfterComposerReturn}.
 *
 * Returns `null` when there is no flow entry to replace - a caller that reaches this with a
 * flow-less stack was never in a flow, and should push normally rather than rewrite a stack it does not own.
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
 * FORGET ANY REPORT ROUND TRIP THE COMPOSER STILL THINKS IS IN FLIGHT - both halves, armed and claimed.
 *
 * ONLY THE REPORT KIND, and that asymmetry is load-bearing: an armed "event" belongs to a host form that is
 * still on screen (the event round trip keeps the composer MOUNTED and pushes the form over it), so dropping
 * it would break the very trip it describes. The report side has no such live surface to speak for it - the
 * composer is dismissed before `selectView("report")`.
 */
function dropReportCreateIntent(): void {
  const composer = usePostComposerStore.getState()
  if (composer.draft.pendingCreate === "report") composer.setPendingCreate(null)
  composer.releaseClaimedCreate("report")
}

/**
 * OPEN THE REPORT WIZARD FROM AN ENTRY POINT THAT IS NOT THE COMPOSER - the map long-press "Report an issue
 * here", the expanded/web sidebar's Report button, the dock's Report tab, mobile's `/report` deep link, and
 * any future one. EVERY such entry goes through here; the source guards in
 * `__tests__/postComposerExit.test.ts` pin the ones in this package.
 *
 * ONE RULE, ONE PLACE: a report run reached from anywhere but the composer cannot be part of a composer
 * round trip, so it must not inherit an intent the composer left armed (or a claim a previous run leaked).
 * `claimPendingCreate` binds the intent to the run that picks it up, which is what makes an abandoned round
 * trip self-healing; this closes the other direction - an armed intent whose launch never reached the wizard
 * at all cannot be picked up by an unrelated run and route ITS report into the composer.
 *
 * `PostComposer.leaveForCreate` deliberately does NOT come through here: it is the one caller that means to
 * KEEP the armed intent across `selectView`.
 *
 * BUT ONLY WHEN THE TAP ACTUALLY STARTS A FRESH RUN, which is the whole reason the self-heal is gated on
 * {@link reportRunSurvivesView} rather than run unconditionally. Two entry points reach here while a report
 * run is ALREADY live, and settling its claim from the outside kills the round trip silently:
 *   - THE DOCK'S REPORT TAB, RE-TAPPED MID-WIZARD (`TabBar.shared`). `view` is "report" with an empty stack,
 *     so the deselect guard below early-returns and NOTHING changes on screen - but an unconditional drop has
 *     already released the claim, and the activation effect cannot repair it (`claimPendingCreate` finds both
 *     halves null and no-ops). The user submits and their report goes to the feed instead of to the waiting
 *     post. The guard's own comment says "leave the mounted run exactly as it is"; this makes that true.
 *   - THE REPORT TAB AS THE WAY BACK FROM A SEARCH DETOUR ON WEB, which is exactly what the search exemption
 *     and `armReportSearchDetour` exist to protect. Web's dock does not gate its tabs on `searchActive`
 *     (`TabBar.web` vs `TabBar.native`) and web has no exit circle, so the Report tab is the ONLY dock route
 *     back to a paused wizard - and taking it would release the claim on the way in, then let the detour
 *     watch disarm without releasing, leaving the remounting wizard nothing to adopt.
 * Every case the self-heal was added for (dock/sidebar/drop-pin/deep-link tapped from home, the map,
 * messaging, ...) has `view` OUTSIDE {report, search}, so none of them loses it.
 */
export function openReportFlow(): void {
  const nav = useNavStore.getState()
  // A run that is already on screen (or paused under the Search overlay) owns its own claim: the activation
  // effect and the detour watch govern its lifetime, so an entry-point tap must not settle it from outside.
  // Same predicate as the effect, the deferred release and the watch, so the four cannot drift.
  if (!reportRunSurvivesView(nav.view)) dropReportCreateIntent()
  // DESELECT-SAFE, which a bare `selectView` is not. `selectView` carries the dock's re-tap rule: selecting
  // the view that is ALREADY current with an empty stack DESELECTS it back to the home feed (useNavStore).
  // Every caller here means "open the report wizard", so that rule would turn a second "Report an issue
  // here" - or a `/report` link followed while already on the wizard - into a silent trip to the timeline,
  // throwing away the location the map just prefilled. Already there IS activated: return, and leave the
  // mounted run exactly as it is. A NON-empty stack still selects, which is how a detail opened over the
  // wizard gets cleared back to it.
  if (nav.view === "report" && nav.stack.length === 0) return
  // selectView CLEARS the detail stack, which is what makes the report wizard a tab root (and why the
  // composer's intent cannot live on a nav entry - see postComposerStore).
  nav.selectView("report")
}

/**
 * THE COMPOSER IS MOUNTING: drop a report create-intent that no live run can be behind.
 *
 * WHAT IT BUYS: a claim that leaked (a run whose body vanished on a host with no keep-alive) also VETOES the
 * composer's genuine-exit discard, so the previously attached report would ride along to the next "New post"
 * forever. Clearing at mount is the braces to `postComposerExit`'s belt.
 *
 * "THE COMPOSER IS ARRIVING" IS NOT ENOUGH, and assuming it was is what made the first version of this a
 * blocker. A MOUNT IS NOT AN ARRIVAL on web: `BodyTransition.web` re-parents the outgoing element into its
 * own keyed layer, so the composer this batch just dismissed MOUNTS AGAIN - a different parent and key path,
 * therefore a real React remount - one commit later, while the wizard it launched already owns the screen and
 * has claimed the intent. An unconditional clear released that claim, and then the outgoing layer's own
 * teardown (`theme.motion.bodyExit` later) unmounted the composer for good with nothing left to veto the exit
 * discard: the finished report was shared to the feed instead of handed back, AND the draft's attachments and
 * staged photos were wiped mid-round-trip. Both from one line.
 *
 * So the liveness test is the SHARED predicate every other half of this seam reads ({@link
 * reportRunSurvivesView}): a report run on screen - or paused under the Search overlay - speaks for itself,
 * and only a composer mounting with the app somewhere else can be sure no run is behind the intent. The cases
 * the clear exists for all mount with `view` outside {report, search} (a "New post" opened from the feed, the
 * map, a profile), so none of them loses it.
 *
 * The RETURN LEG is a no-op either way and needs no gate: ReportFlowBody's submit path attaches the report by
 * snapshot and calls `releaseClaimedCreate("report")` BEFORE it pushes the composer entry, so the mount this
 * runs in already reads a null claim - and it touches only the intent, never the attachments.
 *
 * The EVENT kind is deliberately untouched (see {@link dropReportCreateIntent}): that trip keeps the composer
 * mounted under the host form, and a remount mid-form - a layout flip, for one - must not disarm it.
 */
export function clearStaleReportIntentAtComposerMount(): void {
  if (reportRunSurvivesView(useNavStore.getState().view)) return
  dropReportCreateIntent()
}

/**
 * WHAT A NAV-STORE ESCAPE INSIDE THE HOST FORM IS ALLOWED TO DO.
 *
 * THE RULE: a form rendered STANDALONE - outside the shell's nav stack - must NEVER write to the shell's nav
 * store. Not for its return leg, and not for any forward navigation either. Every escape has to go through a
 * callback the HOST supplied, or not happen at all.
 *
 * WHY, concretely. A standalone host is an expo-router SCREEN sitting above the whole shell, and
 * `MobileNavAdapter` bridges only `composer`, `post-thread` and `thread` out to routes. A
 * `push({kind:"verify"})` from there is therefore doubly wrong: nothing appears (the tap is dead), AND a
 * `verify` entry is silently left on the hidden shell's stack, which surfaces later as a pull-up the user
 * never asked for. The publish return leg already had a host callback for exactly this reason; this rule is
 * that seam generalised to every escape, so the next one added cannot regress the same way.
 *
 *   - "nav-store" - in-shell: the form IS a nav entry, so `useNavStore.push` is correct and the pushed body
 *     lands on top of it. Unchanged behaviour, and the case for every host in the app today.
 *   - "host"      - standalone AND the host supplied a callback for this destination: call it.
 *   - "inert"     - standalone with NO callback: render the affordance as a NON-interactive notice. Deliberate
 *     and strictly better than the alternatives: a pressable that does nothing is a lie, and reaching the
 *     shell's verify sheet from a standalone host means tearing down that screen (throwing away the
 *     half-filled host form) for a banner the user can also reach from their profile at any time. VerificationNotice already renders exactly this shape when it is given no
 *     `onPress` (no chevron, no Pressable) - it is the same thing a "pending" host sees.
 */
export type HostFormNavEscape = "nav-store" | "host" | "inert"

export function hostFormNavEscape(input: {
  standalone: boolean
  hasHostCallback: boolean
}): HostFormNavEscape {
  if (!input.standalone) return "nav-store"
  return input.hasHostCallback ? "host" : "inert"
}
