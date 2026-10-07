/**
 * Decides when the post composer is closing for good, so a genuine exit discards the staged attachments
 * (the draft store is module-level and would otherwise carry them into the next post). Kept RN-free so it
 * unit-tests without a renderer. Unlike the host form's `isGenuineHostExit`, the stack alone cannot
 * decide it: mobile bridges the composer entry out to the `/compose` route and pops it in the same tick,
 * a StrictMode remount unmounts without leaving (only the live mount count tells them apart), and a
 * create run's claim can land before this predicate is evaluated, so both halves of the create intent
 * veto the discard.
 */
import type { DetailEntry, View } from "../nav"
import type { PostComposerPendingCreate } from "./postComposerStore"

export interface PostComposerExitInput {
  pendingCreate: PostComposerPendingCreate
  claimedCreate: PostComposerPendingCreate
  stack: readonly DetailEntry[]
  liveMounts: number
}

/** Every clause is a veto; the order is only cheapest-first. */
export function isGenuinePostComposerExit(input: PostComposerExitInput): boolean {
  if (input.pendingCreate != null) return false
  if (input.claimedCreate != null) return false
  if (input.stack.some((entry) => entry.kind === "composer")) return false
  return input.liveMounts <= 0
}

export interface PostComposerExitHost {
  readIntent: () => Pick<PostComposerExitInput, "pendingCreate" | "claimedCreate">
  readStack: () => readonly DetailEntry[]
  discard: () => void
  defer?: (task: () => void) => void
}

/** Module scope because the instance asking whether any composer is still mounted has already gone. */
let liveComposerMounts = 0

/**
 * The cleanup re-reads everything one microtask later, so a remount in the same effect flush (StrictMode,
 * a route swap, a host handoff) has already restored the count and the discard cancels itself. Nothing is
 * captured at cleanup time, so a claim landing before the microtask can still veto the discard.
 */
export function trackPostComposerMount(host: PostComposerExitHost): () => void {
  liveComposerMounts += 1
  let released = false
  return () => {
    // A host that calls its cleanup twice must not drive the count negative and make a live composer look
    // departed.
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

/** For assertions only; the predicate reads the module value directly. */
export function postComposerLiveMounts(): number {
  return liveComposerMounts
}

/**
 * The one rule the activation effect, the unmount release and the deferred decision all read, so the three
 * cannot disagree. Search is exempt because it opens as an overlay over the wizard (`SEARCH_IS_OVERLAY`),
 * which the camera gate already treats as a paused session; releasing there would send the finished report
 * to the wizard's success screen instead of the post that asked for it. Every other view is a departure,
 * which keeps an abandoned run self-healing.
 */
export function reportRunSurvivesView(view: View): boolean {
  return view === "report" || view === "search"
}

export interface ReportRunExitHost {
  /** Read at decision time, never captured: that is the whole mechanism. */
  readView: () => View
  release: () => void
  /**
   * Required because it is the only thing that can notice where a search detour settles once this body has
   * gone; omitting it would leak the claim. It may fire on any nav write, which is harmless because
   * `readView` is re-read each time.
   */
  watchView: (onNavChange: () => void) => () => void
  defer?: (task: () => void) => void
}

/** Module scope for the same reason as the mount count: the instance that armed it has already gone. */
let searchDetourWatch: (() => void) | null = null

/**
 * Exported so a host that knows the run is over can say so and tests can isolate cases. Correctness does not
 * depend on it: a stale watch only re-decides and calls an already-satisfied, kind-scoped release.
 */
export function disarmReportSearchDetour(): void {
  const unsubscribe = searchDetourWatch
  searchDetourWatch = null
  unsubscribe?.()
}

/** For assertions only; never a control input. */
export function reportSearchDetourArmed(): boolean {
  return searchDetourWatch !== null
}

/**
 * On web Search is a full view swap, so the wizard's body unmounts and nothing mounted would notice the user
 * leaving Search for a third view; the claim would then misroute every later report. This self-disarming
 * subscription re-reads the live view on each nav write and settles the claim when the detour resolves.
 */
function armReportSearchDetour(host: ReportRunExitHost): void {
  // A second departure (a layout flip mid-detour) must not leave two watches racing.
  disarmReportSearchDetour()
  searchDetourWatch = host.watchView(() => {
    const view = host.readView()
    if (view === "search") return
    disarmReportSearchDetour()
    // Back on the wizard, a mounting body's activation effect owns the claim's lifetime again.
    if (view !== "report") host.release()
  })
}

/**
 * Drops the report run's claim when its body unmounts without seeing the deactivation. The activation
 * effect's `else` only runs on a body that stays mounted (native portrait's keep-alive slot); reduced-motion
 * web and the expanded shell just unmount it, and since `claimPendingCreate` keeps an existing claim, a
 * leftover one would route every later report into the composer. Deferred because a layout flip, the
 * keep-alive slot and StrictMode remount and re-claim before the microtask, so re-reading the live view
 * tells a remount from a departure; a search detour hands the decision to {@link armReportSearchDetour}.
 */
export function deferReportRunRelease(host: ReportRunExitHost): void {
  const defer = host.defer ?? queueMicrotask
  defer(() => {
    const view = host.readView()
    // A remount, not a departure; any watch armed by an earlier detour is stale.
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
