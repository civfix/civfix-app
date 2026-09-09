import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it } from "vitest"
import type { DetailEntry } from "../../nav"
import { useNavStore } from "../../nav"
import {
  clearStaleReportIntentAtComposerMount,
  hostFormNavEscape,
  openReportFlow,
  stackAfterComposerReturn,
  stackAfterFlowPublished,
} from "../composerCreateFlow"
import * as composerCreateFlow from "../composerCreateFlow"
import { usePostComposerStore } from "../postComposerStore"
import { topmostFullEntry } from "../../shell/bodyLayout"

const readSource = (relative: string) =>
  readFileSync(new URL(relative, import.meta.url), "utf8")

const composer: DetailEntry = { kind: "composer" }
const hostForm: DetailEntry = { kind: "create-cleanup" }

/**
 * THE PLANNER AND THE HOST-PRESENTER SEAM ARE GONE, AND THAT IS THE ASSERTION.
 *
 * `planComposerCreateEvent` / `setComposerEventFormPresenter` / `composerEventFormPresenter` existed only to
 * present the host-an-event form over the post composer's "+ New event" shortcut. That shortcut was removed
 * (the dock's create bubble is the one entry point), which left the planner with no production caller, the
 * presenter singleton with no reader, and mobile's `/compose-host-event` screen unreachable. All three are
 * deleted; this pins the deletion so a revival has to be deliberate rather than accidental.
 */
describe("the removed composer -> host-event presentation seam", () => {
  it("exports neither the planner nor the presenter singleton any more", () => {
    for (const name of [
      "planComposerCreateEvent",
      "setComposerEventFormPresenter",
      "composerEventFormPresenter",
    ]) {
      expect(composerCreateFlow).not.toHaveProperty(name)
    }
    const source = readSource("../composerCreateFlow.ts")
    expect(source).not.toMatch(/eventFormPresenter|hasHostPresenter|ComposerCreateEventPlan/)
    // ...and the package barrel does not re-export them either.
    const barrel = readSource("../index.ts")
    expect(barrel).not.toMatch(/ComposerEventFormPresenter|planComposerCreateEvent|ComposerCreateEventPlan/)
  })
})

describe("hostFormNavEscape", () => {
  it("keeps the nav store for an IN-SHELL form, where the form IS an entry", () => {
    expect(hostFormNavEscape({ standalone: false, hasHostCallback: false })).toBe("nav-store")
    // An in-shell form ignores a host callback entirely: its own entry is the correct destination anchor.
    expect(hostFormNavEscape({ standalone: true, hasHostCallback: false })).not.toBe("nav-store")
    expect(hostFormNavEscape({ standalone: false, hasHostCallback: true })).toBe("nav-store")
  })

  it("NEVER returns the nav store for a standalone form - that is the whole rule", () => {
    // The regression this exists to make impossible: a standalone host screen sits above the whole shell,
    // so `useNavStore.push` from there is a DEAD tap that also leaves a stray entry on the hidden stack.
    // There is no input for which a standalone form may write that store.
    for (const hasHostCallback of [true, false]) {
      expect(hostFormNavEscape({ standalone: true, hasHostCallback })).not.toBe("nav-store")
    }
    expect(hostFormNavEscape({ standalone: true, hasHostCallback: true })).toBe("host")
    expect(hostFormNavEscape({ standalone: true, hasHostCallback: false })).toBe("inert")
  })
})

describe("stackAfterComposerReturn", () => {
  it("truncates back to the WAITING composer in one step, at any depth", () => {
    expect(stackAfterComposerReturn([composer, hostForm])).toEqual([composer])
    // The host form can push forward first ("Get verified", a linked report's detail), so a single `back()`
    // would leave the user parked mid-flow. Truncating is correct however deep it went.
    expect(stackAfterComposerReturn([composer, hostForm, { kind: "verify" }])).toEqual([composer])
    expect(
      stackAfterComposerReturn([{ kind: "post", id: "p1" }, composer, hostForm]),
    ).toEqual([{ kind: "post", id: "p1" }, composer])
  })

  it("returns null when no composer entry survived, so the caller pushes a fresh one", () => {
    // The report-wizard round trip (`selectView` clears the stack) and the mobile screen-hosted composer.
    expect(stackAfterComposerReturn([hostForm])).toBeNull()
    expect(stackAfterComposerReturn([])).toBeNull()
  })

  it("truncates at the TOPMOST composer, so a nested pair cannot strand the inner one", () => {
    expect(stackAfterComposerReturn([composer, hostForm, composer, hostForm])).toEqual([
      composer,
      hostForm,
      composer,
    ])
  })
})

describe("the composer <-> host-form round trip over the real nav store", () => {
  beforeEach(() => {
    useNavStore.getState().reset()
  })

  it("opens the host form ON TOP of the composer and lands back IN it on publish", () => {
    // `reset()` leaves the store on the home view with an empty stack.
    useNavStore.getState().push(composer)
    expect(useNavStore.getState().stack).toEqual([composer])
    const originView = useNavStore.getState().originView

    // --- The launch leg: the host form is PUSHED, never opened with `openDetail` (which replaces the stack
    // and would destroy the very composer entry the overlay layer needs).
    useNavStore.getState().push(hostForm)

    const during = useNavStore.getState()
    expect(during.stack).toEqual([composer, hostForm])
    expect(during.active).toEqual(hostForm)
    // The composer entry survived, which is the whole point: the base view is untouched (NOT re-rooted on
    // home the way the old `nav.back()` + push left it) and the overlay layer still resolves to the composer.
    expect(during.view).toBe("home")
    expect(during.originView).toBe(originView)
    expect(topmostFullEntry(during.stack)).toEqual(composer)

    // --- The return leg: truncate back to the waiting composer in one step.
    const trimmed = stackAfterComposerReturn(useNavStore.getState().stack)
    expect(trimmed).toEqual([composer])
    useNavStore.getState().setStack(trimmed ?? [])

    const after = useNavStore.getState()
    expect(after.stack).toEqual([composer])
    expect(after.active).toEqual(composer)
    expect(after.originView).toBe(originView)
    // Exactly ONE composer entry — a second `push` here would make Back from the returned composer re-open
    // the host form the user just published.
    expect(after.stack.filter((entry) => entry.kind === "composer")).toHaveLength(1)
  })
})

describe("openReportFlow", () => {
  beforeEach(() => {
    useNavStore.getState().reset()
    usePostComposerStore.getState().reset()
  })

  it("activates the report wizard on an empty stack", () => {
    useNavStore.getState().push({ kind: "person", id: "p1" })
    openReportFlow()
    const nav = useNavStore.getState()
    expect(nav.view).toBe("report")
    expect(nav.stack).toEqual([])
  })

  it("is DESELECT-SAFE: re-entering while already on the wizard does not bounce to the home feed", () => {
    // THE TRAP. `selectView` carries the dock's re-tap rule — the already-current view with an empty stack
    // DESELECTS back to "home" — so a bare `selectView("report")` answers a second "Report an issue here"
    // (which has just prefilled the draft's location) with a silent trip to the timeline, and any create
    // intent armed on the way in is left with no run to claim it.
    openReportFlow()
    expect(useNavStore.getState().view).toBe("report")
    openReportFlow()
    expect(useNavStore.getState().view).toBe("report")
    expect(useNavStore.getState().stack).toEqual([])
  })

  it("still clears a detail opened OVER the wizard, which is a real selection", () => {
    openReportFlow()
    useNavStore.getState().push({ kind: "pin", id: "r1", lat: 1, lng: 2 })
    openReportFlow()
    expect(useNavStore.getState().view).toBe("report")
    expect(useNavStore.getState().stack).toEqual([])
  })

  it("drops a REPORT create-intent the composer left behind, and keeps an EVENT one", () => {
    // A run reached from here cannot be part of a composer round trip, so it must not inherit either half.
    usePostComposerStore.getState().setPendingCreate("report")
    usePostComposerStore.getState().claimPendingCreate("report")
    usePostComposerStore.getState().setPendingCreate("report")
    openReportFlow()
    expect(usePostComposerStore.getState().draft.pendingCreate).toBeNull()
    expect(usePostComposerStore.getState().claimedCreate).toBeNull()

    // An armed EVENT belongs to a host form that is still on screen (that trip keeps the composer mounted).
    usePostComposerStore.getState().setPendingCreate("event")
    openReportFlow()
    expect(usePostComposerStore.getState().draft.pendingCreate).toBe("event")
  })
})

describe("clearStaleReportIntentAtComposerMount", () => {
  beforeEach(() => {
    // The NAV store too, and not for hygiene: the clear is LIVENESS-GATED on the view (a composer mounting
    // while the wizard owns the screen is web's outgoing-layer remount, not an arrival), so a case that means
    // "the composer opens with a leaked intent" has to start from a view that is not the wizard's. The claim's
    // behaviour ON the wizard's view is `postComposerExit.test.ts`'s body-swap case.
    useNavStore.getState().reset()
    usePostComposerStore.getState().reset()
  })

  it("drops a leaked report intent but never the draft it is mounting into", () => {
    // THE ROUND-TRIP RETURN MOUNT, which is the case this must not break: ReportFlowBody has already
    // attached the new report by SNAPSHOT and released its claim before pushing the composer entry, so the
    // mount clear is a no-op on the intent and must leave the attachment (and the prose) alone.
    const store = usePostComposerStore.getState()
    store.setBody("Just filed this:")
    store.setAttachedReport({
      id: "report-9",
      category: "hazard",
      title: "Pothole on Sunset",
      status: "published",
      lat: 34.09,
      lng: -118.28,
      addr: "Sunset Blvd",
      thumbUrl: null,
      linkedAt: "2026-07-29T00:00:00.000Z",
    })

    clearStaleReportIntentAtComposerMount()

    expect(usePostComposerStore.getState().draft.attachedReportId).toBe("report-9")
    expect(usePostComposerStore.getState().draft.attachedReport).not.toBeNull()
    expect(usePostComposerStore.getState().draft.body).toBe("Just filed this:")

    // And a LEAKED claim (a run whose body vanished mid search detour) really does go, so it stops vetoing
    // the composer's genuine-exit discard.
    usePostComposerStore.getState().setPendingCreate("report")
    usePostComposerStore.getState().claimPendingCreate("report")
    clearStaleReportIntentAtComposerMount()
    expect(usePostComposerStore.getState().claimedCreate).toBeNull()
    expect(usePostComposerStore.getState().draft.attachedReportId).toBe("report-9")
  })

  it("leaves the EVENT round trip armed - it keeps this composer mounted under the host form", () => {
    // A remount mid-form (a layout flip) must not disarm the intent CreateCleanupBody reads on publish.
    usePostComposerStore.getState().setPendingCreate("event")
    clearStaleReportIntentAtComposerMount()
    expect(usePostComposerStore.getState().draft.pendingCreate).toBe("event")
  })
})

/**
 * SOURCE-GREP GUARDS. The rules above are pure and unit-tested, but the USER-FACING wiring is that the
 * standalone host form mounts a keyboard-aware scroller and routes its escapes, and that the composer no
 * longer carries create shortcuts of its own. Neither component can be rendered here (no RN renderer in
 * this suite; both pull in react-native), and without these assertions reverting either wiring leaves the
 * whole suite green while the reported defect walks straight back in. Same technique, and same reason, as
 * shell/__tests__/tabBar.test.ts's scroll-host composition assertions.
 */
describe("PostComposer's create shortcuts (source-pinned)", () => {
  it("no longer offers a new-report / new-event shortcut, so it never launches either flow", () => {
    // The composer's "New report" / "New event" affordances are gone: the dock's create bubble is the one
    // entry point for both. Pinned as an absence, because re-adding either is what would resurrect the
    // dismiss-then-detour defect the planner above exists to prevent.
    const source = readSource("../PostComposer.tsx")
    expect(source).not.toMatch(/leaveForCreate|createReport|createEvent/)
    expect(source).not.toMatch(/planComposerCreateEvent|composerEventFormPresenter/)
    expect(source).not.toMatch(/selectView\("report"\)/)
    expect(source).not.toMatch(/push\(\{ kind: "create-cleanup" \}\)/)
  })
})

describe("the standalone host form's wiring (source-pinned)", () => {
  const source = () => readSource("../CreateCleanupBody.tsx")

  it("mounts a keyboard-aware scroll host, built ONCE at module scope", () => {
    // FINDING 1: with no provider mounted, `useScrollHost()` falls back to PLAIN_SCROLL_HOST — a bare RN
    // ScrollView. An iOS formSheet does not resize for the keyboard, so the description field, the "what to
    // bring" input and Publish all end up under it with no scroll range to reach them.
    const text = source()
    expect(text).toMatch(
      /import \{ makeKeyboardAwareScrollHost \} from "\.\.\/shell\/KeyboardAwareScroll"/,
    )
    expect(text).toMatch(
      /^const STANDALONE_SCROLL_HOST = makeKeyboardAwareScrollHost\(PLAIN_SCROLL_HOST\)$/m,
    )
    // Module scope, not inside a component: the factory returns a FRESH component type, so building it per
    // render would remount the whole form (every field's local state) on every keystroke.
    const hostDecl = text.indexOf("const STANDALONE_SCROLL_HOST")
    expect(hostDecl).toBeLessThan(text.indexOf("function HostForm("))
    // And it is actually PROVIDED to the form.
    expect(text).toMatch(/const scrollHost = isStandalone \? STANDALONE_SCROLL_HOST : inheritedScrollHost/)
    expect(text).toMatch(/<ScrollHostProvider value=\{scrollHost\}>/)
  })

  it("routes EVERY nav-store escape through the host when standalone", () => {
    // FINDING 2: `standalone` used to suppress the nav-entry SEEDS but not the OUTBOUND navigation, so the
    // "Get verified" banner still pushed onto the shell's hidden stack — a dead tap that also left a stray
    // `verify` entry behind. Both escapes must now be gated, and the gate must be the shared rule.
    const text = source()
    expect(text).toMatch(/import \{ hostFormNavEscape, stackAfterFlowPublished \} from "\.\/composerCreateFlow"/)
    expect(text).toMatch(/const verifyEscape = hostFormNavEscape\(\{/)
    expect(text).toMatch(/verifyEscape === "nav-store" \? pushVerifyEntry/)
    expect(text).toMatch(/verifyEscape === "host" \? hostGetVerified : undefined/)
    // Every `push` onto the shell store sits AFTER a `standalone` bail-out. Asserted positionally because
    // the failure mode is a bare fallthrough, not a wrong call.
    const publishReturn = text.indexOf("standalone.onComposerReturn()")
    const pushEvent = text.indexOf("pushCleanup(cleanup)")
    expect(publishReturn).toBeGreaterThan(-1)
    expect(pushEvent).toBeGreaterThan(-1)
    expect(text.lastIndexOf("standalone.onComposerReturn()")).toBeLessThan(pushEvent)
    expect(text.match(/standalone\.onComposerReturn\(\)/g) ?? []).toHaveLength(1)
  })

  it("takes the escapes and the flag as ONE object, so a host cannot declare one without the other", () => {
    const text = source()
    expect(text).toMatch(/export interface CreateCleanupStandaloneHost \{/)
    expect(text).toMatch(/onComposerReturn: \(\) => void/)
    expect(text).toMatch(/standalone\?: CreateCleanupStandaloneHost/)
    // The old shape (a boolean plus a loose callback) is what shipped the hole.
    expect(text).not.toMatch(/standalone\?: boolean/)
  })
})

describe("stackAfterFlowPublished", () => {
  const created: DetailEntry = { kind: "cleanup", id: "c1", title: "Beach cleanup", lat: 1, lng: 2 }

  it("REPLACES the finished flow entry, so the published event's sheet can be dragged away", () => {
    // THE REGRESSION. The happy path used to `pushCleanup`, which APPENDS -> [create-cleanup, cleanup].
    // `collapseToParent` refuses to collapse while ANY entry is a flow kind, so the success sheet's
    // drag-to-dismiss - the universal exit for a pull-up - was dead, and Back landed on the submitted form.
    expect(stackAfterFlowPublished([hostForm], created)).toEqual([created])
  })

  it("takes anything the flow pushed on top with it", () => {
    // The form can push `verify` (the unverified-host banner) or a linked report's detail before publishing.
    const verify: DetailEntry = { kind: "verify" }
    expect(stackAfterFlowPublished([hostForm, verify], created)).toEqual([created])
  })

  it("keeps entries BELOW the flow, which are somebody else's stack", () => {
    const person: DetailEntry = { kind: "person", id: "p1" }
    expect(stackAfterFlowPublished([person, hostForm], created)).toEqual([person, created])
  })

  it("returns null when no flow entry is on the stack, so the caller pushes normally", () => {
    expect(stackAfterFlowPublished([], created)).toBeNull()
    expect(stackAfterFlowPublished([{ kind: "person", id: "p1" }], created)).toBeNull()
  })

  it("leaves a stack the LIVE collapse guard will actually collapse", () => {
    // The point of the whole fix, asserted against the real store rather than by reasoning about it: drive
    // the published stack through `collapseToParent` and require that it really clears. Run against
    // [create-cleanup, cleanup] this fails, which is precisely the bug.
    const nav = useNavStore.getState()
    nav.setStack(stackAfterFlowPublished([hostForm], created) ?? [])
    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().active).toBeNull()
  })
})
