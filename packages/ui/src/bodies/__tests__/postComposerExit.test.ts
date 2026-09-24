/**
 * The create intent's claim (taken at run activation, dropped on deactivation) and the composer's
 * genuine-exit discard are one seam: the wizard's claim can land before or after the composer's deferred
 * unmount cleanup evaluates the exit predicate, and both orderings must keep the attachments the run will
 * hand back.
 *
 * This package's vitest cannot load react-native, so the two effects are simulated against the real stores
 * and their wiring is source-pinned at the bottom.
 */
import { beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { reportFlowSource } from "../reportFlow/__tests__/reportFlowSource"
import type { LinkedReportRef, UserMentionDTO } from "@civfix/shared"
import type { DetailEntry } from "../../nav"
import { ALL_VIEWS, useNavStore } from "../../nav"
import { clearStaleReportIntentAtComposerMount, openReportFlow } from "../composerCreateFlow"
import {
  deferReportRunRelease,
  disarmReportSearchDetour,
  isGenuinePostComposerExit,
  postComposerLiveMounts,
  reportRunSurvivesView,
  reportSearchDetourArmed,
  trackPostComposerMount,
  type PostComposerExitHost,
  type ReportRunExitHost,
} from "../postComposerExit"
import { useFeedScrollTopStore } from "../feed/feedScrollStore"
import { usePostComposerStore } from "../postComposerStore"
import { postSubmitDestination } from "../postComposerSubmit"

const readSource = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8")

const composerEntry: DetailEntry = { kind: "composer" }
const maya: UserMentionDTO = { id: "maya", handle: "mayal", displayName: "Maya Lopez" }
const reportRef: LinkedReportRef = {
  id: "report-9",
  category: "hazard",
  type: "pavement",
  title: "Pothole on Sunset",
  status: "published",
  lat: 34.09,
  lng: -118.28,
  addr: "Sunset Blvd",
  thumbUrl: "file:///local-capture.jpg",
  linkedAt: "2026-07-29T00:00:00.000Z",
}

/** The composer's own unmount cleanup, with the microtask queue in the test's hands. */
function composerHost() {
  const deferred: Array<() => void> = []
  let discards = 0
  const host: PostComposerExitHost = {
    readIntent: () => {
      const state = usePostComposerStore.getState()
      return { pendingCreate: state.draft.pendingCreate, claimedCreate: state.claimedCreate }
    },
    readStack: () => useNavStore.getState().stack,
    discard: () => {
      discards += 1
      usePostComposerStore.getState().discardAttachments()
    },
    defer: (task) => {
      deferred.push(task)
    },
  }
  return {
    mount: () => trackPostComposerMount(host),
    /** Run every pending deferral (the microtask flush). */
    flush: () => {
      while (deferred.length > 0) deferred.shift()?.()
    },
    discards: () => discards,
  }
}

/** ReportFlowBody's run-activation effect, both directions (pinned to the real source below). */
const activateReportRun = () => usePostComposerStore.getState().claimPendingCreate("report")
const deactivateReportRun = () => usePostComposerStore.getState().releaseClaimedCreate("report")

/**
 * The SAME effect, driven off the live nav view and WITH its deferred unmount cleanup - i.e. the whole
 * lifetime of the report body, which is what the hosts without a keep-alive slot exercise.
 */
function reportBody() {
  const deferred: Array<() => void> = []
  let liveWatches = 0
  const host: ReportRunExitHost = {
    readView: () => useNavStore.getState().view,
    release: deactivateReportRun,
    // The real store subscription, so the search-detour watch is exercised end to end; counted, so an
    // unsubscribe the module forgets to call is visible.
    watchView: (onNavChange) => {
      liveWatches += 1
      const unsubscribe = useNavStore.subscribe(onNavChange)
      return () => {
        liveWatches -= 1
        unsubscribe()
      }
    },
    defer: (task) => {
      deferred.push(task)
    },
  }
  return {
    /** How many nav subscriptions this body's departures currently hold. */
    liveWatches: () => liveWatches,
    /** One pass of the effect for the CURRENT view; the return value is its cleanup. */
    runEffect: () => {
      const view = useNavStore.getState().view
      if (view === "report") activateReportRun()
      else if (!reportRunSurvivesView(view)) deactivateReportRun()
      return () => deferReportRunRelease(host)
    },
    flush: () => {
      while (deferred.length > 0) deferred.shift()?.()
    },
  }
}
/**
 * A composer MOUNT as PostComposer actually performs it: the stale-intent clear runs first (its effect is
 * declared above the tracker's), then the mount is registered. Only the cases that care about the ORDER of
 * those two use this; the rest go through `composerHost().mount()` directly.
 */
function mountComposer(composer: ReturnType<typeof composerHost>): () => void {
  clearStaleReportIntentAtComposerMount()
  return composer.mount()
}

/** What the wizard's submit path and its review step both read: THIS run's claim. */
const fromComposer = () => usePostComposerStore.getState().claimedCreate === "report"

/** A half-written post with a report and a photo already attached. */
function stageDraft() {
  const store = usePostComposerStore.getState()
  store.setBody("Just filed this @mayal")
  store.toggleMention(maya)
  store.setAttachedReport(reportRef)
  store.setAttachedEventId("event-1")
  store.addMedia({ uri: "file:///photo.jpg", kind: "image", posterUri: null, uploadId: "u1", status: "ready" })
}

beforeEach(() => {
  // Drop a search-detour watch a previous case left armed BEFORE touching the stores, so its listener
  // cannot fire on this case's reset and release a claim out from under it.
  disarmReportSearchDetour()
  usePostComposerStore.getState().reset()
  useNavStore.getState().reset()
  expect(postComposerLiveMounts()).toBe(0)
  expect(reportSearchDetourArmed()).toBe(false)
})

describe("isGenuinePostComposerExit", () => {
  const base = { pendingCreate: null, claimedCreate: null, stack: [] as DetailEntry[], liveMounts: 0 }

  it("is an exit only when nothing is in flight, on the stack, or mounted", () => {
    expect(isGenuinePostComposerExit(base)).toBe(true)
  })

  it("is NOT an exit while a create intent is armed or claimed", () => {
    expect(isGenuinePostComposerExit({ ...base, pendingCreate: "report" })).toBe(false)
    expect(isGenuinePostComposerExit({ ...base, pendingCreate: "event" })).toBe(false)
    // The claimed clause is what the claim-before-cleanup ordering relies on.
    expect(isGenuinePostComposerExit({ ...base, claimedCreate: "report" })).toBe(false)
    expect(isGenuinePostComposerExit({ ...base, claimedCreate: "event" })).toBe(false)
  })

  it("is NOT an exit while the composer entry is still on the nav stack (web forward push)", () => {
    expect(isGenuinePostComposerExit({ ...base, stack: [composerEntry] })).toBe(false)
    expect(isGenuinePostComposerExit({ ...base, stack: [{ kind: "post", id: "p1" }, composerEntry] })).toBe(
      false,
    )
    // Somebody else's stack is not a veto.
    expect(isGenuinePostComposerExit({ ...base, stack: [{ kind: "post", id: "p1" }] })).toBe(true)
  })

  it("is NOT an exit while another composer instance is mounted (mobile has NO stack entry)", () => {
    // MobileNavAdapter pops the `composer` entry the instant it opens `/compose`, so the stack test above
    // cannot speak for mobile at all. The mount count is what does.
    expect(isGenuinePostComposerExit({ ...base, liveMounts: 1 })).toBe(false)
    expect(isGenuinePostComposerExit({ ...base, liveMounts: 2 })).toBe(false)
  })
})

describe("reportRunSurvivesView", () => {
  it("keeps a run alive on the report view and across the SEARCH overlay, and nowhere else", () => {
    expect(reportRunSurvivesView("report")).toBe(true)
    // The one deliberate exemption: Search rides over the wizard, so it is a detour, not a departure.
    expect(reportRunSurvivesView("search")).toBe(true)
    // EXHAUSTIVE over the nav store's views, so a view added later cannot quietly join the exemption.
    const departures = ALL_VIEWS.filter((view) => view !== "report" && view !== "search")
    for (const view of departures) expect(reportRunSurvivesView(view), view).toBe(false)
  })
})

describe("the composer's genuine-exit discard", () => {
  it("clears the selections and KEEPS the prose", () => {
    stageDraft()
    usePostComposerStore.getState().setMode("quote")
    usePostComposerStore.getState().setQuotePostId("post-quoted")
    usePostComposerStore.getState().setReplyToPostId("post-parent")
    usePostComposerStore.getState().setPendingCreate("report")
    usePostComposerStore.getState().claimPendingCreate("report")

    usePostComposerStore.getState().discardAttachments()

    expect(usePostComposerStore.getState().draft).toEqual({
      body: "Just filed this @mayal",
      mentionedUsers: [maya],
      attachedEventId: null,
      attachedEvent: null,
      attachedReportId: null,
      attachedReport: null,
      media: [],
      mode: "quote",
      quotePostId: "post-quoted",
      replyToPostId: "post-parent",
      organizationId: null,
      pendingCreate: null,
      ownerId: null,
    })
    expect(usePostComposerStore.getState().claimedCreate).toBeNull()
  })

  it("drops a SNAPSHOTTED report, which no other sweep can touch", () => {
    // `shouldClearStaleAttachedReport` returns false while a snapshot exists, so the exit discard is the only
    // thing that can clear one.
    usePostComposerStore.getState().setAttachedReport(reportRef)
    expect(usePostComposerStore.getState().draft.attachedReport).not.toBeNull()

    usePostComposerStore.getState().discardAttachments()

    expect(usePostComposerStore.getState().draft.attachedReportId).toBeNull()
    expect(usePostComposerStore.getState().draft.attachedReport).toBeNull()
  })

  it("closing the composer and reopening it shows NO attached report", () => {
    const composer = composerHost()
    stageDraft()
    const unmount = composer.mount()

    unmount()
    composer.flush()

    expect(composer.discards()).toBe(1)
    expect(usePostComposerStore.getState().draft.attachedReportId).toBeNull()
    expect(usePostComposerStore.getState().draft.body).toBe("Just filed this @mayal")

    // Reopen: nothing carried over but the text.
    const reopened = composer.mount()
    expect(usePostComposerStore.getState().draft.attachedReport).toBeNull()
    reopened()
    composer.flush()
    expect(postComposerLiveMounts()).toBe(0)
  })

  it("does NOT discard on a StrictMode-style unmount/remount, or a surviving stack entry", () => {
    const composer = composerHost()
    stageDraft()

    // Dev double-invoke: mount -> cleanup -> mount, all inside one passive-effect flush. The deferral is
    // what sees the count back at 1 and cancels itself.
    const first = composer.mount()
    first()
    const second = composer.mount()
    composer.flush()

    expect(composer.discards()).toBe(0)
    expect(usePostComposerStore.getState().draft.attachedReportId).toBe(reportRef.id)

    // Forward push on web: the composer's entry stays on the stack under the new top.
    useNavStore.getState().push(composerEntry)
    useNavStore.getState().push({ kind: "person", id: "p1" })
    second()
    composer.flush()

    expect(composer.discards()).toBe(0)
    expect(usePostComposerStore.getState().draft.attachedReportId).toBe(reportRef.id)
    expect(postComposerLiveMounts()).toBe(0)
  })

  it("ignores a cleanup called twice, so a live composer can never look departed", () => {
    const composer = composerHost()
    const unmount = composer.mount()
    const other = composer.mount()
    unmount()
    unmount()
    composer.flush()

    expect(composer.discards()).toBe(0)
    other()
    composer.flush()
    expect(composer.discards()).toBe(1)
    expect(postComposerLiveMounts()).toBe(0)
  })
})

describe("the composer -> report wizard round trip", () => {
  it("claims the armed intent when the report RUN activates, not when its body mounts", () => {
    usePostComposerStore.getState().setPendingCreate("report")

    activateReportRun()

    expect(fromComposer()).toBe(true)
    // The armed half is consumed, so nothing else can pick the same intent up.
    expect(usePostComposerStore.getState().draft.pendingCreate).toBeNull()
  })

  it("re-claims idempotently, so a remount mid-run keeps the round trip", () => {
    // The native shell RETAINS this body and rebuilds it on a keyed slot bump / layout flip, and StrictMode
    // double-invokes its effect. None of those is a new run.
    usePostComposerStore.getState().setPendingCreate("report")
    activateReportRun()
    activateReportRun()
    activateReportRun()

    expect(fromComposer()).toBe(true)
  })

  it("KEEPS THE DRAFT when the wizard claims BEFORE the composer's cleanup is evaluated (mobile)", () => {
    // Mobile pops `/compose` and selects the report view in one tick; the retained wizard body claims
    // immediately while the route's unmount cleanup lands later.
    const composer = composerHost()
    stageDraft()
    const unmount = composer.mount()

    usePostComposerStore.getState().setPendingCreate("report")
    activateReportRun() // the wizard run gets there first
    unmount() // now the /compose screen goes away
    composer.flush()

    expect(composer.discards()).toBe(0)
    expect(usePostComposerStore.getState().draft.attachedReportId).toBe(reportRef.id)
    expect(usePostComposerStore.getState().draft.media).toHaveLength(1)
    expect(postComposerLiveMounts()).toBe(0)
  })

  it("KEEPS THE DRAFT when the cleanup is queued BEFORE the claim, too", () => {
    // The other ordering (web, where the composer unmounts in the same commit that mounts the wizard):
    // nothing is captured at cleanup time, so a claim that lands before the microtask still vetoes.
    const composer = composerHost()
    stageDraft()
    const unmount = composer.mount()

    usePostComposerStore.getState().setPendingCreate("report")
    unmount()
    activateReportRun()
    composer.flush()

    expect(composer.discards()).toBe(0)
    expect(usePostComposerStore.getState().draft.attachedReportId).toBe(reportRef.id)
    expect(postComposerLiveMounts()).toBe(0)
  })

  it("SURVIVES THE WEB BODY SWAP, whose outgoing layer REMOUNTS the composer over the live run", () => {
    // A mount is not an arrival: a web body swap can re-parent the dismissed composer into an outgoing layer,
    // a real React remount, while the wizard already owns the screen. A mount-time clear must not release
    // the claim there, or the layer's teardown discards the draft.
    const composer = composerHost()
    stageDraft()
    const mounted = mountComposer(composer)

    // Arm, dismiss this surface and select the wizard in one batched tick.
    usePostComposerStore.getState().setPendingCreate("report")
    useNavStore.getState().selectView("report")

    // COMMIT A: BodyTransition still renders a single child, so the wizard mounts and claims while the
    // composer is dropped from `children` and unmounts.
    activateReportRun()
    mounted()
    const claimedAtCommitA = fromComposer()

    // COMMIT B: `setAnim` lands and the CACHED composer element mounts inside the keyed outgoing layer, with
    // `view` already on the wizard. Nothing has flushed yet - both deferrals resolve after the swap.
    const reparented = mountComposer(composer)
    const claimedAtCommitB = fromComposer()

    // ...and `motion.bodyExit` later the outgoing layer leaves the DOM and the composer is gone. The
    // mid-flight facts are asserted AFTER the teardown so a regression cannot leak the module mount count
    // into every later case (the `beforeEach` guard would then fail the whole file instead of this one).
    reparented()
    composer.flush()

    expect(claimedAtCommitA).toBe(true)
    expect(claimedAtCommitB).toBe(true)
    // The hand-back is intact: the review step, `useReportSubmit`'s share suppression and the submit's
    // destination all read this answer...
    expect(fromComposer()).toBe(true)
    // ...with every attachment the round trip is carrying back to it.
    expect(composer.discards()).toBe(0)
    expect(usePostComposerStore.getState().draft.attachedReportId).toBe(reportRef.id)
    expect(usePostComposerStore.getState().draft.media).toHaveLength(1)
    expect(postComposerLiveMounts()).toBe(0)
  })

  it("still drops a LEAKED claim when the composer mounts with the app somewhere else", () => {
    // A claim whose run vanished vetoes every genuine exit, so the previous post's attachments would ride
    // along to the next "New post"; the mount clear drops it when the app is not on the wizard.
    const composer = composerHost()
    stageDraft()
    usePostComposerStore.getState().setPendingCreate("report")
    activateReportRun()
    useNavStore.getState().selectView("home")

    const mounted = mountComposer(composer)
    const clearedAtMount = usePostComposerStore.getState().claimedCreate === null

    mounted()
    composer.flush()
    expect(clearedAtMount).toBe(true)
    expect(composer.discards()).toBe(1)
    expect(usePostComposerStore.getState().draft.attachedReportId).toBeNull()
    expect(postComposerLiveMounts()).toBe(0)
  })

  it("hands the report back and ends the run, leaving the returned composer with no run in flight", () => {
    const composer = composerHost()
    const store = usePostComposerStore.getState()
    store.setBody("Just filed this:")
    const unmount = composer.mount()

    // Launch, claim, complete: ReportFlowBody attaches by snapshot and releases.
    store.setPendingCreate("report")
    activateReportRun()
    unmount()
    composer.flush()
    expect(fromComposer()).toBe(true)
    usePostComposerStore.getState().setAttachedReport(reportRef)
    deactivateReportRun()

    // Back in the composer: the text and the new attachment, one post to send, no lingering intent.
    const returned = composer.mount()
    expect(usePostComposerStore.getState().draft.body).toBe("Just filed this:")
    expect(usePostComposerStore.getState().draft.attachedReport).toEqual(reportRef)
    expect(usePostComposerStore.getState().draft.pendingCreate).toBeNull()
    expect(usePostComposerStore.getState().claimedCreate).toBeNull()
    expect(composer.discards()).toBe(0)
    returned()
    composer.flush()
    expect(postComposerLiveMounts()).toBe(0)
  })

  it("ABANDONING the run drops the claim, so the next report is not hijacked", () => {
    // Arm the intent, back out of the wizard to another tab, then file an unrelated report from the Report
    // tab.
    usePostComposerStore.getState().setPendingCreate("report")
    activateReportRun()
    deactivateReportRun() // tabbed away: the run is over

    // The next run activates with nothing to claim...
    activateReportRun()

    expect(fromComposer()).toBe(false)
    // ...so it takes the success-screen path and keeps its "Share to the feed" toggle, both of which read
    // this one answer.
    expect(usePostComposerStore.getState().claimedCreate).toBeNull()
    expect(usePostComposerStore.getState().draft.pendingCreate).toBeNull()
  })

  it("an abandoned run also stops blocking the composer's exit discard", () => {
    // A latch left armed would also veto every genuine exit.
    const composer = composerHost()
    stageDraft()
    usePostComposerStore.getState().setPendingCreate("report")
    activateReportRun()
    deactivateReportRun()

    const unmount = composer.mount()
    unmount()
    composer.flush()

    expect(composer.discards()).toBe(1)
    expect(usePostComposerStore.getState().draft.attachedReportId).toBeNull()
    expect(postComposerLiveMounts()).toBe(0)
  })

  it("releases only its OWN kind, so the event round trip is untouched", () => {
    usePostComposerStore.getState().setPendingCreate("event")
    usePostComposerStore.getState().claimPendingCreate("event")

    deactivateReportRun()

    expect(usePostComposerStore.getState().claimedCreate).toBe("event")
  })

  it("cannot claim an event intent for a report run", () => {
    usePostComposerStore.getState().setPendingCreate("event")

    activateReportRun()

    expect(fromComposer()).toBe(false)
    expect(usePostComposerStore.getState().draft.pendingCreate).toBe("event")
  })
})

/**
 * Only native portrait keeps the wizard mounted across a tab switch, so on reduced-motion web and the
 * expanded shell the activation effect's `else` never runs; the body just unmounts, and because
 * `claimPendingCreate` keeps an existing claim, a leftover one would misroute later reports.
 */
describe("the report run's deferred deactivation on unmount", () => {
  function launchFromComposer() {
    usePostComposerStore.getState().setPendingCreate("report")
    useNavStore.getState().selectView("report")
  }

  it("drops the claim when the body UNMOUNTS without ever seeing the deactivation", () => {
    const body = reportBody()
    launchFromComposer()
    const cleanup = body.runEffect()
    expect(fromComposer()).toBe(true)

    // The user taps Home. On these hosts the view swap and the unmount are the same commit, so the effect
    // never re-runs with `runActive === false` - the cleanup is the only signal there is.
    useNavStore.getState().selectView("home")
    cleanup()
    body.flush()

    expect(usePostComposerStore.getState().claimedCreate).toBeNull()
  })

  it("so the NEXT unrelated report run is not hijacked (the reported bug, web/landscape)", () => {
    const body = reportBody()
    launchFromComposer()
    const cleanup = body.runEffect()
    useNavStore.getState().selectView("home")
    cleanup()
    body.flush()

    // A fresh report run, from the Report dock tab this time.
    useNavStore.getState().selectView("report")
    const next = reportBody()
    next.runEffect()

    // Its "Share to the feed" toggle, its share and its success screen all read this one answer.
    expect(fromComposer()).toBe(false)
    expect(usePostComposerStore.getState().draft.pendingCreate).toBeNull()
  })

  it("KEEPS the claim across a remount that is not a departure at all", () => {
    // A layout flip (portrait <-> expanded), the keyed keep-alive slot rebuilding, StrictMode's double
    // invoke: unmount then mount with `view` untouched. The deferral is what lets the remount re-claim
    // first, and the microtask then re-reads the LIVE view instead of anything captured.
    const body = reportBody()
    launchFromComposer()
    const first = body.runEffect()

    first()
    const second = body.runEffect()
    body.flush()

    expect(fromComposer()).toBe(true)

    // ...and it is still the same run afterwards, so the round trip can still hand its report back.
    useNavStore.getState().selectView("home")
    second()
    body.flush()
    expect(usePostComposerStore.getState().claimedCreate).toBeNull()
  })

  it("releases only the REPORT claim, so an event round trip survives the wizard's unmount", () => {
    const body = reportBody()
    useNavStore.getState().selectView("report")
    const cleanup = body.runEffect()
    usePostComposerStore.getState().setPendingCreate("event")
    usePostComposerStore.getState().claimPendingCreate("event")

    useNavStore.getState().selectView("home")
    cleanup()
    body.flush()

    expect(usePostComposerStore.getState().claimedCreate).toBe("event")
  })

  it("does NOT release on a SEARCH detour, and the returning wizard adopts the same claim", () => {
    // Search rides as an overlay over the wizard, so a reporter looking something up mid-report has paused
    // the run, not ended it; releasing there would send the report to the wizard's success screen instead
    // of the post that asked for it.
    const body = reportBody()
    launchFromComposer()
    const cleanup = body.runEffect()
    expect(fromComposer()).toBe(true)

    // The dock's Search orb. On web this is a full view swap, so the body simply goes away.
    useNavStore.getState().selectView("search")
    cleanup()
    body.flush()

    expect(fromComposer()).toBe(true)
    // Nothing is mounted to settle the claim, so the departing run left a store watch behind instead.
    expect(reportSearchDetourArmed()).toBe(true)

    // Back to the wizard: the watch stands down and a new body adopts the claim as the same logical run,
    // which works because `claimPendingCreate` keeps an existing claim.
    useNavStore.getState().selectView("report")
    expect(reportSearchDetourArmed()).toBe(false)
    expect(usePostComposerStore.getState().draft.pendingCreate).toBeNull()
    const resumed = reportBody()
    resumed.runEffect()

    expect(fromComposer()).toBe(true)
  })

  it("RELEASES when the detour settles on a third view, with no report body left to notice", () => {
    // Report -> Search -> Home: the body unmounted at the Search step, so on hosts without a keep-alive slot
    // nothing mounted runs the activation effect for "home". The departing run's store watch closes it.
    const body = reportBody()
    launchFromComposer()
    const cleanup = body.runEffect()
    useNavStore.getState().selectView("search")
    cleanup()
    body.flush()
    expect(fromComposer()).toBe(true)

    useNavStore.getState().selectView("home")

    expect(usePostComposerStore.getState().claimedCreate).toBeNull()
    expect(reportSearchDetourArmed()).toBe(false)

    // ...so the next unrelated report keeps its "Share to the feed" toggle and its own success screen.
    useNavStore.getState().selectView("report")
    reportBody().runEffect()
    expect(fromComposer()).toBe(false)
  })

  it("keeps the claim across a search detour the body SURVIVES (the native overlay), and drops it after", () => {
    // Native portrait keeps this body mounted under the Search overlay, so here the effect really does
    // re-run with `view === "search"` - the branch that must neither claim nor release.
    const body = reportBody()
    launchFromComposer()
    const first = body.runEffect()

    useNavStore.getState().selectView("search")
    first() // React runs the previous cleanup before the next effect pass
    const second = body.runEffect()
    body.flush()

    expect(fromComposer()).toBe(true)

    // Leaving Search for a real departure drops it, by whichever half gets there first (the watch fires on
    // the store publication; the effect pass that follows is idempotent).
    useNavStore.getState().selectView("home")
    second()
    body.runEffect()
    body.flush()

    expect(usePostComposerStore.getState().claimedCreate).toBeNull()
    expect(reportSearchDetourArmed()).toBe(false)
  })

  it("re-arming replaces the watch, so a detour cannot leave two of them racing", () => {
    // A layout flip mid-detour unmounts and remounts the body, and each departure defers its own decision.
    const body = reportBody()
    launchFromComposer()
    const first = body.runEffect()
    useNavStore.getState().selectView("search")
    first()
    body.flush()
    expect(reportSearchDetourArmed()).toBe(true)

    const second = body.runEffect()
    second()
    body.flush()
    expect(reportSearchDetourArmed()).toBe(true)
    expect(fromComposer()).toBe(true)
    // The point of the case: ONE live subscription, not one per departure.
    expect(body.liveWatches()).toBe(1)

    // ONE decision when the detour resolves, and nothing armed afterwards.
    useNavStore.getState().selectView("home")
    expect(usePostComposerStore.getState().claimedCreate).toBeNull()
    expect(reportSearchDetourArmed()).toBe(false)
    expect(body.liveWatches()).toBe(0)
  })

  it("a search detour does not block the composer's exit discard once the claim is settled", () => {
    // The exemption must not become a new way to keep the last post's attachments alive: the leaked claim
    // vetoes `isGenuinePostComposerExit`, so the detour's release is what lets a later close discard.
    const composer = composerHost()
    const body = reportBody()
    stageDraft()
    launchFromComposer()
    const cleanup = body.runEffect()
    useNavStore.getState().selectView("search")
    cleanup()
    body.flush()
    useNavStore.getState().selectView("home")

    const unmount = composer.mount()
    unmount()
    composer.flush()

    expect(composer.discards()).toBe(1)
    expect(usePostComposerStore.getState().draft.attachedReportId).toBeNull()
    expect(postComposerLiveMounts()).toBe(0)
  })

  it("does not block the composer's genuine-exit discard once the wizard is gone", () => {
    // A leaked claim would veto every exit discard (`isGenuinePostComposerExit`) and keep the previously
    // attached report on the next "New post".
    const composer = composerHost()
    const body = reportBody()
    stageDraft()
    launchFromComposer()
    const cleanup = body.runEffect()
    useNavStore.getState().selectView("home")
    cleanup()
    body.flush()

    const unmount = composer.mount()
    unmount()
    composer.flush()

    expect(composer.discards()).toBe(1)
    expect(usePostComposerStore.getState().draft.attachedReportId).toBeNull()
    expect(postComposerLiveMounts()).toBe(0)
  })
})

/**
 * `openReportFlow` drops a report intent so an unrelated run cannot inherit it, but two entry points reach it
 * while the wizard is already on screen (or paused under Search), where the claim belongs to that run.
 * Settling it from outside would kill the round trip invisibly.
 */
describe("openReportFlow and a report run that is already live", () => {
  /** Arm the composer intent, open the wizard, and let its run claim - the state both cases start from. */
  function liveRunFromComposer() {
    usePostComposerStore.getState().setPendingCreate("report")
    useNavStore.getState().selectView("report")
    activateReportRun()
  }

  it("leaves the claim ALONE when the dock's Report tab is re-tapped mid-wizard", () => {
    // `view` is "report" with an empty stack (the wizard is always a tab root), so the deselect guard
    // early-returns and NOTHING changes on screen - which is exactly why releasing here is invisible and
    // unrecoverable: the activation effect cannot repair it, because `claimPendingCreate` finds both halves
    // null and no-ops.
    liveRunFromComposer()
    expect(fromComposer()).toBe(true)

    openReportFlow()

    expect(fromComposer()).toBe(true)
    expect(useNavStore.getState().view).toBe("report")
    expect(useNavStore.getState().stack).toEqual([])
  })

  it("leaves the claim ALONE when the Report tab is the way back from a SEARCH detour (web)", () => {
    // `TabBar.web` does not gate its tabs on `searchActive` and web has no exit circle, so the Report tab is
    // the only dock route back to a paused wizard. Releasing on the way in would defeat the search
    // exemption: the detour watch sees "report", disarms without releasing, and the wizard has nothing to
    // adopt.
    const body = reportBody()
    liveRunFromComposer()
    const cleanup = body.runEffect()
    useNavStore.getState().selectView("search")
    cleanup()
    body.flush()
    expect(reportSearchDetourArmed()).toBe(true)

    openReportFlow()

    expect(useNavStore.getState().view).toBe("report")
    expect(reportSearchDetourArmed()).toBe(false)
    // A brand new body adopts the same logical run, so the paused round trip still hands its report back.
    reportBody().runEffect()
    expect(fromComposer()).toBe(true)
  })

  it("STILL self-heals when the tap really does start a fresh run", () => {
    // A tap from home, the map, a profile, messaging or a `/report` deep link is outside the exemption.
    usePostComposerStore.getState().setPendingCreate("report")
    activateReportRun()
    usePostComposerStore.getState().setPendingCreate("report")
    expect(useNavStore.getState().view).toBe("home")

    openReportFlow()

    expect(usePostComposerStore.getState().claimedCreate).toBeNull()
    expect(usePostComposerStore.getState().draft.pendingCreate).toBeNull()
    expect(useNavStore.getState().view).toBe("report")
    // ...so the run that mounts next keeps its "Share to the feed" toggle and its own success screen.
    activateReportRun()
    expect(fromComposer()).toBe(false)
  })
})

/**
 * The rules above are pure; which effect claims, what the wizard reads at submit time, what the review step
 * is handed and that the close paths discard all live in components that cannot be mounted here.
 */
describe("the wiring (source-pinned)", () => {
  it("PostComposer registers the mount tracker and discards on the header X", () => {
    const source = readSource("../PostComposer.tsx")
    expect(source).toMatch(/import \{ trackPostComposerMount, type PostComposerExitHost \}/)
    expect(source).toMatch(/useEffect\(\(\) => trackPostComposerMount\(EXIT_HOST\), \[\]\)/)
    // The host reads BOTH halves of the intent, and reads them at decision time (no captured values).
    expect(source).toMatch(/readIntent: \(\) => \{[\s\S]*?claimedCreate: state\.claimedCreate/)
    expect(source).toMatch(/discard: \(\) => usePostComposerStore\.getState\(\)\.discardAttachments\(\)/)
    // The deliberate close also clears the local media mirrors, as the submit `onSuccess` path does: an
    // effect mirrors `carriedMedia` + the attachment hook back into the draft, so a store-only discard is
    // undone when a late upload-finalize republishes the hook's list.
    expect(source).toMatch(
      /const closeComposer = \(\) => \{\s*\n\s*usePostComposerStore\.getState\(\)\.discardAttachments\(\)\s*\n\s*attachments\.reset\(\)\s*\n\s*setCarriedMedia\(\[\]\)\s*\n\s*setDroppedMedia\(0\)\s*\n\s*;\(onBack \?\? back\)\(\)/,
    )
    expect(source).toMatch(/onPress=\{closeComposer\}/)
  })

  it("PostComposer drops a stale REPORT create-intent at mount", () => {
    // A claim whose run vanished also vetoes the exit discard, so without this a leak keeps the previous
    // post's attachments alive on every later "New post".
    const source = readSource("../PostComposer.tsx")
    expect(source).toMatch(/useEffect\(clearStaleReportIntentAtComposerMount, \[\]\)/)
    expect(source).toMatch(
      /import \{ clearStaleReportIntentAtComposerMount \} from "\.\/composerCreateFlow"/,
    )
    // Report-scoped: the event trip keeps this composer mounted under the host form, so a remount mid-form
    // must not disarm it.
    const flow = readSource("../composerCreateFlow.ts")
    const clear = flow.slice(flow.indexOf("export function clearStaleReportIntentAtComposerMount"))
    expect(clear).toMatch(/dropReportCreateIntent\(\)/)
    expect(clear).not.toMatch(/discardAttachments|setPendingCreate\("event"\)/)
    // Gated on the shared liveness predicate, because a web body swap can remount this surface while the
    // wizard already owns the screen.
    expect(clear).toMatch(/if \(reportRunSurvivesView\(useNavStore\.getState\(\)\.view\)\) return/)
  })

  it("the composer no longer launches a create round trip of its own", () => {
    // The dock's create bubble is the only create entry point, so this surface never arms an intent or
    // leaves for a flow.
    const source = readSource("../PostComposer.tsx")
    expect(source).not.toMatch(/leaveForCreate|createReport|createEvent/)
    expect(source).not.toMatch(/setPendingCreate/)
  })

  it("POPS the composer and PUSHES the new thread for a QUOTE, so the origin entry survives the post", () => {
    // `openDetail` replaces the whole stack, so "thread A -> Quote -> Post -> Back" would lose thread A. Popping
    // the composer first (the host's dismiss, else `nav.back()`) and then pushing leaves [A, newPost].
    const source = readSource("../PostComposer.tsx")
    const success = source.slice(source.indexOf("onSuccess: (post) => {"), source.indexOf("onSettled:"))
    expect(success).toContain('push({ kind: "post-thread", id: post.id })')
    expect(success).not.toContain("openDetail")
    // `onPosted` still runs BEFORE the navigation, and the pop still runs before the push.
    const posted = success.indexOf("onPosted?.(post)")
    const popped = success.indexOf("if (onBack) onBack()")
    const pushed = success.indexOf('push({ kind: "post-thread"')
    expect(posted).toBeGreaterThan(-1)
    expect(popped).toBeGreaterThan(posted)
    expect(pushed).toBeGreaterThan(popped)
    expect(success).toMatch(/if \(onBack\) onBack\(\)\s*\n\s*else back\(\)/)
    // A stray `openDetail` selector is how this regresses.
    expect(source).not.toMatch(/state\.openDetail/)
  })

  it("a TOP-LEVEL post pops only, and asks the feed to show its new top", () => {
    // A top-level post returns the author to the feed their post now tops, not a thread of one.
    expect(postSubmitDestination("post")).toBe("origin")
    expect(postSubmitDestination("quote")).toBe("thread")
    expect(postSubmitDestination("reply")).toBe("thread")
    const source = readSource("../PostComposer.tsx")
    const success = source.slice(source.indexOf("onSuccess: (post) => {"), source.indexOf("onSettled:"))
    // Keyed off what was SUBMITTED, never the `mode` prop - the two can disagree mid-flight.
    expect(success).toContain(
      'if (postSubmitDestination(resolution.input.kind) === "thread") push({ kind: "post-thread", id: post.id })',
    )
    expect(success).toContain("else useFeedScrollTopStore.getState().requestScrollTop()")
    // The feed has a list ref and consumes the request, or the new post lands off-screen for a reader
    // who had scrolled down. The ref is TYPED through the ScrollHost seam - no `as never`.
    const feed = readSource("../FeedBody.tsx")
    expect(feed).toContain("ref={listRef}")
    expect(feed).not.toContain("as never")
    expect(feed).toContain("useRef<ScrollHostListHandle | null>(null)")
    expect(feed).toMatch(
      /if \(scrollTopRequestId === honouredRequestIdRef\.current\) return\s*\n\s*honouredRequestIdRef\.current = scrollTopRequestId\s*\n\s*listRef\.current\?\.scrollToOffset\?\.\(\{ offset: 0, animated: true \}\)/,
    )
  })

  it("a scroll-to-top raised while the feed is unmounted is never replayed at its next mount", () => {
    // Posting from the event-detail composer (or the report-flow handoff) raises a request with no FeedBody
    // mounted; replaying it at the next mount would jump a list the reader had not asked to move.
    const store = useFeedScrollTopStore
    store.setState({ requestId: 0 })
    store.getState().requestScrollTop()
    store.getState().requestScrollTop()
    // What a mount captures is the CURRENT id, so every request raised before it is already honoured.
    const atMount = store.getState().requestId
    expect(atMount).toBe(2)
    expect(store.getState().requestId === atMount).toBe(true)
    // Only a request raised while that mount is alive moves the id past what it captured.
    store.getState().requestScrollTop()
    expect(store.getState().requestId).toBe(3)
    expect(store.getState().requestId === atMount).toBe(false)
    // ...and the store never exposes a way to leave a request standing for the next mount to find.
    expect(Object.keys(store.getState())).toEqual(["requestId", "requestScrollTop"])
  })

  it("ReportFlowBody claims at run ACTIVATION and releases on deactivation", () => {
    const source = reportFlowSource()
    expect(readSource("../ReportFlowBody.tsx")).toContain("useReportRunClaim(runActive)")
    // Live boolean nav-store selectors, never mount-time snapshots, so the activation edge fires on the
    // commit the view changes.
    expect(source).toMatch(/const runActive = useNavStore\(\(s\) => s\.view === "report"\)/)
    // The SEARCH exemption is the shared predicate, not a second inline rule: the effect's release branch,
    // the deferred decision and the detour watch have to agree, and re-deriving it here is how they drift.
    expect(source).toMatch(/const runSurvives = useNavStore\(\(s\) => reportRunSurvivesView\(s\.view\)\)/)
    expect(source).toMatch(
      /useEffect\(\(\) => \{\s*\n\s*const composer = usePostComposerStore\.getState\(\)\s*\n\s*if \(runActive\) composer\.claimPendingCreate\("report"\)\s*\n\s*else if \(!runSurvives\) composer\.releaseClaimedCreate\("report"\)\s*\n\s*return \(\) => deferReportRunRelease\(REPORT_RUN_EXIT_HOST\)\s*\n\s*\}, \[runActive, runSurvives\]\)/,
    )
    // ...and the host supplies the store watch that settles a detour the body does not survive.
    expect(source).toMatch(/watchView: \(onNavChange\) => useNavStore\.subscribe\(onNavChange\)/)
    // NOT a mount-scoped read: the shell pre-warms and retains this body, so a mount claim would both miss
    // the legitimate launch and outlive an abandoned run.
    expect(source).not.toMatch(/useState\([^)]*pendingCreate/)
    // ...and the UNMOUNT is a deactivation too, DEFERRED. Without this the claim leaks on every host that
    // has no keep-alive slot for the wizard (web reduced-motion, the expanded/landscape shell).
    expect(source).toMatch(/return \(\) => deferReportRunRelease\(REPORT_RUN_EXIT_HOST\)/)
    // The host re-reads the live view at DECISION time; nothing is captured when the cleanup runs.
    expect(source).toMatch(/readView: \(\) => useNavStore\.getState\(\)\.view/)
  })

  it("the dock's Report tab opens the wizard through openReportFlow, not a bare selectView", () => {
    // `openReportFlow` self-heals a leaked claim (and a stale armed intent) as a second line behind the
    // cleanup. The rail's Report item renders this same handler, so it inherits the self-heal.
    const source = readSource("../../shell/TabBar.shared.tsx")
    expect(source).toMatch(/import \{ openReportFlow \} from "\.\.\/bodies\/composerCreateFlow"/)
    expect(source).toMatch(/if \(tab\.id === "report"\) \{[\s\S]*?openReportFlow\(\)/)
    expect(source).not.toMatch(/selectView\("report"\)/)
  })

  it("ReportFlowBody routes on THIS RUN'S claim and threads it, never re-reading the latch", () => {
    const source = reportFlowSource()
    expect(readSource("../ReportFlowBody.tsx")).toContain("useReportSubmitFlow({ fromComposer, stepOrder, setStep })")
    expect(source).toMatch(/const fromComposer = usePostComposerStore\(\(s\) => s\.claimedCreate\) === "report"/)
    expect(source).toMatch(/useReportSubmit\(\{ forComposer: fromComposer \}\)/)
    expect(source).toMatch(/if \(fromComposer\) \{/)
    expect(source).toMatch(/composer\.releaseClaimedCreate\("report"\)/)
    expect(source).toMatch(/<ReviewStep\s*\n\s*fromComposer=\{fromComposer\}/)
    // Neither the submit path nor the review step may read the unowned latch.
    expect(source).not.toMatch(/draft\.pendingCreate/)
    expect(source).not.toMatch(/composerPendingReport/)
  })

  it("the share gate in report/submit.ts takes the answer as a parameter", () => {
    const source = readSource("../../report/submit.ts")
    expect(source).toMatch(/export function useReportSubmit\(options\?: ReportSubmitOptions\)/)
    expect(source).toMatch(/const forComposer = options\?\.forComposer === true/)
    expect(source).toMatch(/^\s*!forComposer &&$/m)
    // It must not be able to reach the store at all.
    expect(source).not.toMatch(/usePostComposerStore/)
  })

  /**
   * Every report entry point in this package, named individually. Deliberately not listed:
   *
   *   - PostComposer, pinned as an absence by the `not.toMatch` below because it opens no report flow.
   *   - mobile's `/report` deep-link route, outside this package; it imports `openReportFlow` from
   *     `@civfix/ui`, which is why the helper is re-exported from `bodies/index.ts` (asserted below).
   *   - web routes, which reach the view through `useNavStore.seed` on a cold start or popstate, where the
   *     module-level composer draft is brand new and there is nothing to inherit.
   *   - the landscape rail's Report tab (`shell/Rail.tsx`), which renders `useTabBarModel().onTab` from
   *     `TabBar.shared` verbatim and is covered by the dock's row below.
   */
  it("every report entry point in this package goes through openReportFlow", () => {
    const entries = [
      // The map long-press "Report an issue here".
      { file: "../DropPinBody.tsx", from: "./composerCreateFlow" },
      // The dock's (and, through `useTabBarModel`, the rail's) Report tab.
      { file: "../../shell/TabBar.shared.tsx", from: "../bodies/composerCreateFlow" },
    ]
    for (const { file, from } of entries) {
      const source = readSource(file)
      expect(source, file).toContain(`import { openReportFlow } from "${from}"`)
      expect(source, file).not.toMatch(/selectView\("report"\)/)
    }
    // The landscape rail reaches the wizard through the dock's own handler rather than a second copy of it,
    // which keeps the list above complete.
    const rail = readSource("../../shell/Rail.tsx")
    expect(rail).toMatch(/useTabBarModel/)
    expect(rail).not.toMatch(/selectView\("report"\)/)
    // The composer opens no report flow at all.
    expect(readSource("../PostComposer.tsx")).not.toMatch(/selectView\("report"\)/)
    // And the helper is reachable by the hosts' own entry points (mobile's `/report` shim).
    expect(readSource("../index.ts")).toMatch(/export \{[^}]*\bopenReportFlow\b[^}]*\} from "\.\/composerCreateFlow"/)

    // The helper is the one place that decides what a non-composer entry inherits...
    const flow = readSource("../composerCreateFlow.ts")
    expect(flow).toMatch(/export function openReportFlow\(\): void/)
    expect(flow).toMatch(/if \(composer\.draft\.pendingCreate === "report"\) composer\.setPendingCreate\(null\)/)
    expect(flow).toMatch(/composer\.releaseClaimedCreate\("report"\)/)
    // ...but ONLY when the tap actually starts a fresh run: the same predicate the effect, the deferred
    // release and the detour watch read, so an entry point cannot settle a claim that is still someone's.
    expect(flow).toMatch(/if \(!reportRunSurvivesView\(nav\.view\)\) dropReportCreateIntent\(\)/)
    // ...and it is DESELECT-SAFE: `selectView` on the already-current view with an empty stack deselects to
    // the home feed, which would answer "open the report wizard" with a trip to the timeline.
    expect(flow).toMatch(/if \(nav\.view === "report" && nav\.stack\.length === 0\) return/)
  })

  it("the host form no longer carries an EVENT create-intent at all", () => {
    // Nothing arms `pendingCreate === "event"`, so the host form must not carry an event branch that has no
    // way to be reached. The report half of the latch is still live (openReportFlow above).
    const source = readSource("../CreateCleanupBody.tsx")
    expect(source).not.toMatch(/pendingCreate|setPendingCreate|usePostComposerStore/)
    const cleanup = source.slice(source.indexOf("if (isGenuineHostExit("))
    expect(cleanup).toMatch(/useCleanupDraft\.getState\(\)\.clear\(\)/)
  })
})
