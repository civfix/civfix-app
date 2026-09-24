import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it } from "vitest"
import type { DetailEntry } from "../../nav"
import { useNavStore } from "../../nav"
import {
  clearStaleReportIntentAtComposerMount,
  openReportFlow,
  stackAfterFlowPublished,
} from "../composerCreateFlow"
import * as composerCreateFlow from "../composerCreateFlow"
import { usePostComposerStore } from "../postComposerStore"

const readSource = (relative: string) =>
  readFileSync(new URL(relative, import.meta.url), "utf8")

const hostForm: DetailEntry = { kind: "create-cleanup" }

/**
 * The dock's create bubble is the one entry point for hosting an event, so the composer -> host-event
 * presentation seam must not come back by accident.
 */
describe("the removed composer -> host-event presentation seam", () => {
  it("exports neither the planner nor the presenter singleton any more", () => {
    for (const name of [
      "planComposerCreateEvent",
      "setComposerEventFormPresenter",
      "composerEventFormPresenter",
      "stackAfterComposerReturn",
    ]) {
      expect(composerCreateFlow).not.toHaveProperty(name)
    }
    const source = readSource("../composerCreateFlow.ts")
    expect(source).not.toMatch(/eventFormPresenter|hasHostPresenter|ComposerCreateEventPlan/)
    // ...and the package barrel does not re-export them either.
    const barrel = readSource("../index.ts")
    expect(barrel).not.toMatch(
      /ComposerEventFormPresenter|planComposerCreateEvent|ComposerCreateEventPlan|stackAfterComposerReturn/,
    )
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
    // `selectView` carries the dock's re-tap rule (the already-current view with an empty stack DESELECTS
    // back to "home"), so a bare `selectView("report")` answers a second "Report an issue here"
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
 * Source-grep guards. The rules above are unit-tested, but the user-facing wiring (the standalone host form
 * mounts a keyboard-aware scroller and routes its escapes; the composer carries no create shortcuts) cannot
 * be rendered here because both components pull in react-native. Without these assertions, reverting either
 * wiring leaves the suite green.
 */
describe("PostComposer's create shortcuts (source-pinned)", () => {
  it("no longer offers a new-report / new-event shortcut, so it never launches either flow", () => {
    // The dock's create bubble is the one entry point for new reports and events. Pinned as an absence,
    // because a composer shortcut that dismisses before launching would detour the user through the feed.
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
    // With no provider mounted, `useScrollHost()` falls back to PLAIN_SCROLL_HOST, a bare RN ScrollView.
    // An iOS formSheet does not resize for the keyboard, so the description field, the "what to
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

  it("takes the escapes and the flag as ONE object, so a host cannot declare one without the other", () => {
    const text = source()
    expect(text).toMatch(/export interface CreateCleanupStandaloneHost \{/)
    expect(text).toMatch(/onComposerReturn: \(\) => void/)
    expect(text).toMatch(/standalone\?: CreateCleanupStandaloneHost/)
    // A boolean plus a loose callback would let a host declare one without the other.
    expect(text).not.toMatch(/standalone\?: boolean/)
  })
})

describe("stackAfterFlowPublished", () => {
  const created: DetailEntry = { kind: "cleanup", id: "c1", title: "Beach cleanup", lat: 1, lng: 2 }

  it("REPLACES the finished flow entry, so the published event's sheet can be dragged away", () => {
    // An append would leave [create-cleanup, cleanup]. `collapseToParent` refuses to collapse while ANY
    // entry is a flow kind, so the success sheet's drag-to-dismiss (the universal exit for a pull-up) would
    // be dead, and Back would land on the submitted form.
    expect(stackAfterFlowPublished([hostForm], created)).toEqual([created])
  })

  it("takes anything the flow pushed on top with it", () => {
    // The form can push a linked report's detail before publishing.
    const linkedReport: DetailEntry = { kind: "pin", id: "r1" }
    expect(stackAfterFlowPublished([hostForm, linkedReport], created)).toEqual([created])
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
    // Asserted against the real store rather than by reasoning about it: drive the published stack through
    // `collapseToParent` and require that it really clears. [create-cleanup, cleanup] would fail this.
    const nav = useNavStore.getState()
    nav.setStack(stackAfterFlowPublished([hostForm], created) ?? [])
    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().active).toBeNull()
  })
})
