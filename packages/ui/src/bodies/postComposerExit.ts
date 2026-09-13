/**
 * WHEN IS THE POST COMPOSER CLOSING FOR GOOD? - the exit rule the composer draft never had, split out of
 * PostComposer so it unit-tests without a renderer (type-only imports keep this module RN-free). The host
 * form's `isGenuineHostExit` (cleanupDraftExit.ts) is the same idea for the event draft; this is its
 * post-composer twin, and it needs two more inputs than the stack.
 *
 * THE BUG IT FIXES. `usePostComposerStore` is module-level and its only `reset()` is on submit DISPATCH, so
 * NO close path cleared it: header X, iOS swipe-back on `/compose`, Android hardware back, a PageStack pop -
 * all of them left the whole draft staged, and reopening "New post" showed the previously attached report
 * still attached. A report attached by SNAPSHOT (the create-and-return path) could not even be swept up by
 * `shouldClearStaleAttachedReport`, which returns false unconditionally while a snapshot exists.
 *
 * WHY THE STACK ALONE IS NOT THE ANSWER HERE, unlike the host form:
 *   - MOBILE HAS NO COMPOSER ENTRY. `MobileNavAdapter` bridges `{kind:"composer"}` out to the `/compose`
 *     expo-router screen and pops the entry in the same tick, so `stack.some(kind === "composer")` is ALWAYS
 *     false there - a stack-only test reads "genuine exit" in the middle of a round trip.
 *   - A REMOUNT IS NOT AN EXIT. civfix-web runs with `reactStrictMode: true`, so every mount is
 *     mount -> cleanup -> mount in dev; an unmount that discards would destroy the payload a create flow
 *     just handed back. The live mount COUNT (module-scope, across every host of the composer) is what
 *     distinguishes a remount from a departure - see {@link trackPostComposerMount}.
 *   - A ROUND TRIP IN FLIGHT IS NOT AN EXIT. Both halves of the create intent count: `pendingCreate` (armed
 *     by `leaveForCreate`) AND `claimedCreate` (taken over by the run that is now on screen). The wizard's
 *     claim can execute BEFORE this predicate is evaluated - on mobile, `leaveForCreate("report")` pops
 *     `/compose` and calls `selectView("report")` in the same tick - so a predicate that looked only at the
 *     armed half would see "nothing pending" and discard the attachments mid-hand-back.
 */
import type { DetailEntry, View } from "../nav"
import type { PostComposerPendingCreate } from "./postComposerStore"

export interface PostComposerExitInput {
  /** The composer's ARMED create intent ("+ New report" / "+ New event" was just tapped). */
  pendingCreate: PostComposerPendingCreate
  /** The create intent a live flow run has CLAIMED and will hand its result back through. */
  claimedCreate: PostComposerPendingCreate
  /** The shell's detail stack. A forward push (or a StrictMode remount) leaves the composer entry on it. */
  stack: readonly DetailEntry[]
  /** How many PostComposer instances are mounted app-wide right now. */
  liveMounts: number
}

/**
 * Is this unmount a real close (discard the selections) rather than a temporary departure that will come
 * back to this same draft? Every clause is a veto; the order is only cheapest-first.
 */
export function isGenuinePostComposerExit(input: PostComposerExitInput): boolean {
  if (input.pendingCreate != null) return false
  if (input.claimedCreate != null) return false
  if (input.stack.some((entry) => entry.kind === "composer")) return false
  return input.liveMounts <= 0
}

/** What {@link trackPostComposerMount} reads and writes. The real hosts are the two zustand stores. */
export interface PostComposerExitHost {
  readIntent: () => Pick<PostComposerExitInput, "pendingCreate" | "claimedCreate">
  readStack: () => readonly DetailEntry[]
  /** Apply the genuine-exit discard (`usePostComposerStore.discardAttachments`). */
  discard: () => void
  /** Deferral seam; defaults to `queueMicrotask`. Tests pass a queue they drain by hand. */
  defer?: (task: () => void) => void
}

/**
 * The live-mount COUNT, module scope on purpose: "is any composer still mounted?" is a question about the
 * app, not about one instance, and the whole point is that the instance asking has already gone.
 */
let liveComposerMounts = 0

/**
 * Register a composer mount; the returned function is its unmount cleanup.
 *
 * THE DEFERRAL IS THE MECHANISM. The cleanup drops the count and then re-reads EVERYTHING one microtask
 * later, so a remount in the same passive-effect flush (StrictMode in dev, a route swap, the shell handing
 * the composer from one host to another) has already put the count back and the discard cancels itself.
 * Nothing is captured at cleanup time - a claim that lands between the unmount and the microtask must be
 * able to veto the discard, which is exactly the mobile round-trip ordering.
 */
export function trackPostComposerMount(host: PostComposerExitHost): () => void {
  liveComposerMounts += 1
  let released = false
  return () => {
    // Guarded: a host that calls its cleanup twice must not drive the count negative and make a LIVE
    // composer look departed.
    if (released) return
    released = true
    liveComposerMounts -= 1
    const defer = host.defer ?? queueMicrotask
    defer(() => {
      const decided = isGenuinePostComposerExit({
        ...host.readIntent(),
        stack: host.readStack(),
        liveMounts: liveComposerMounts,
      })
      if (decided) host.discard()
    })
  }
}

/** The live mount count, for assertions. Never a control input - the predicate reads the module value. */
export function postComposerLiveMounts(): number {
  return liveComposerMounts
}

/**
 * IS A CLAIMED REPORT RUN STILL ALIVE WITH THE APP ON THIS VIEW? The ONE rule the activation effect, the
 * unmount release and the deferred decision all read, so the three cannot disagree.
 *
 * SEARCH IS A DETOUR, NOT A DEPARTURE - the one deliberate exemption, and it reverses the earlier behaviour.
 * The dock's Search glyph is reachable from inside the wizard and rides as an OVERLAY over the surface it
 * was opened from (`SEARCH_IS_OVERLAY`/`effectiveBaseView`): the report view is still the base view, the
 * reporter is looking something up mid-report, and the wizard's own camera gate already treats that as a
 * paused - not ended - session (`viewfinderResumeGraceEligible`). Releasing the claim there cost a paused
 * round trip its hand-back: the reporter came back to the wizard, submitted, and the report landed on the
 * wizard's success screen instead of on the half-written post that asked for it. Every OTHER view is a real
 * departure and still drops the claim, which is what keeps an abandoned "+ New report" self-healing.
 */
export function reportRunSurvivesView(view: View): boolean {
  return view === "report" || view === "search"
}

/** What {@link deferReportRunRelease} reads and writes. The real host is ReportFlowBody's activation effect. */
export interface ReportRunExitHost {
  /** The nav view AT DECISION TIME. Never a captured value - that is the whole mechanism. */
  readView: () => View
  /** Drop this run's claim (`usePostComposerStore.releaseClaimedCreate("report")`). */
  release: () => void
  /**
   * Subscribe to the nav store, returning the unsubscribe. REQUIRED rather than optional on purpose: it is
   * the only thing that can notice where a SEARCH detour settles once this body has gone (see
   * {@link deferReportRunRelease}), so a host allowed to omit it would silently re-open the claim leak.
   * The listener may fire on any nav write - a keystroke in the search field publishes `query` - and
   * `readView` is re-read on every one, so the extra firings are free.
   */
  watchView: (onNavChange: () => void) => () => void
  /** Deferral seam; defaults to `queueMicrotask`. Tests pass a queue they drain by hand. */
  defer?: (task: () => void) => void
}

/**
 * THE ONE PENDING SEARCH-DETOUR WATCH, module scope for the same reason the mount count is: "is a paused
 * report run still waiting to find out where the user landed?" is a question about the app, not about the
 * instance that armed it - and that instance has already gone. One slot, armed/disarmed exactly like
 * `map/dropPinFlow`'s drop-pin cleanup subscription.
 */
let searchDetourWatch: (() => void) | null = null

/**
 * Tear the pending watch down. Exported for the same two reasons `disarmDropPinCleanup` is: a host that
 * knows the run is over can say so, and the suite can isolate cases. Correctness does NOT depend on it -
 * a stale watch only ever re-decides and then calls an already-satisfied, kind-scoped release.
 */
export function disarmReportSearchDetour(): void {
  const unsubscribe = searchDetourWatch
  searchDetourWatch = null
  unsubscribe?.()
}

/** Is a search detour currently being watched? For assertions; never a control input. */
export function reportSearchDetourArmed(): boolean {
  return searchDetourWatch !== null
}

/**
 * THE LEAK THE SEARCH EXEMPTION WOULD OTHERWISE OPEN, closed where it is created.
 *
 * The exemption says a claim survives `view === "search"`. On web that is a view the wizard's body does NOT
 * survive - Search is a full view swap there, so the body unmounts, its deferred decision reads "search",
 * keeps the claim, and then NOTHING is mounted to notice the user leaving Search for a third view. The claim
 * would outlive its run for the rest of the session, which is the original misroute verbatim.
 *
 * So the departing body hands the question to the store instead of to another body: one subscription, armed
 * only in the search case, that re-reads the LIVE view (never anything captured) on each nav publication and
 * settles the claim the moment the detour resolves - released if the user landed anywhere else, handed back
 * to the remounting wizard if they returned to it. Self-disarming, so nothing survives the decision.
 */
function armReportSearchDetour(host: ReportRunExitHost): void {
  // Re-arming replaces: a second departure (a layout flip mid-detour) must not leave two watches racing.
  disarmReportSearchDetour()
  searchDetourWatch = host.watchView(() => {
    const view = host.readView()
    // Still inside the detour - the reporter is typing in Search. Nothing to decide yet.
    if (view === "search") return
    disarmReportSearchDetour()
    // Back on the wizard: a body is mounting and its activation effect owns the claim's lifetime again.
    if (view !== "report") host.release()
  })
}

/**
 * THE OTHER HALF OF THE CLAIM'S LIFETIME: the report run's claim must also be dropped when its body UNMOUNTS
 * without ever seeing the deactivation.
 *
 * WHY THE ACTIVATION EFFECT'S `else` BRANCH IS NOT ENOUGH. It only ever runs on a body that is still mounted,
 * which is true of native portrait (the shell's keep-alive slot holds the wizard at `display:none`) and
 * NOWHERE ELSE: web with `prefers-reduced-motion: reduce` settles straight onto the new view with no outgoing
 * layer, and the expanded/landscape shell has no keep-alive slot at all. In both the wizard simply goes away,
 * and a claim left behind reproduces the original misroute verbatim - `claimPendingCreate` deliberately KEEPS
 * an existing claim, so every later report in the session renders as the composer round trip. (The first
 * animated web path happened to release only because BodyTransition re-parented the outgoing element into its
 * own keyed layer, remounting the body with the new `view`; it now keeps one identity per body. Nothing
 * should depend on either.)
 *
 * DEFERRED, for the same reason the composer's exit discard is: an unmount is not a departure. A layout flip,
 * the keyed keep-alive slot and StrictMode's double-invoked effects all remount immediately and re-claim
 * before the microtask runs, and re-reading the LIVE view then answers the only question that matters - is a
 * report run still the thing on screen? - rather than anything this cleanup closed over.
 *
 * THREE OUTCOMES, not two, because of the search exemption ({@link reportRunSurvivesView}): still on the
 * report view means this was a remount and there is nothing to do; a real departure releases; and a SEARCH
 * detour with no body left to watch it hands the decision to the store
 * ({@link armReportSearchDetour}) rather than guessing now.
 */
export function deferReportRunRelease(host: ReportRunExitHost): void {
  const defer = host.defer ?? queueMicrotask
  defer(() => {
    const view = host.readView()
    // Still the run on screen: a remount, not a departure. Any watch armed by an earlier detour is stale.
    if (view === "report") {
      disarmReportSearchDetour()
      return
    }
    // Same rule as the activation effect's `else`, so the two cannot disagree.
    if (!reportRunSurvivesView(view)) {
      disarmReportSearchDetour()
      host.release()
      return
    }
    armReportSearchDetour(host)
  })
}
