/**
 * Unit test for the ONE back-chevron gate (`shell/backAffordance`).
 *
 * THE BUG: the own-profile pull-up rendered "< You" and the report wizard's step 1 rendered a back
 * chevron, on surfaces that are a TAB ROOT or a DIRECTLY-OPENED pull-up - i.e. with nothing behind them.
 * Both chevrons only CLOSED the surface (the wizard's literally called `reset()`), duplicating the dock /
 * the sheet's grab handle while promising a parent screen that does not exist.
 *
 * The gate is a pure predicate, so - house style (dragCollapse, expandedHomeButton, headerAuthAffordance)
 * - vitest drives it directly against the REAL nav store: no React Native renderer, and the arrival verbs
 * (selectView / push / openDetail / seed) are exercised for real rather than simulated, which is the whole
 * point (a "directly-opened pull-up" is defined by the STATE those verbs produce, not by their name).
 */
import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it } from "vitest"
import { detailLeadingAffordance, showBackAffordance } from "../backAffordance"
import { BODY_LAYOUT } from "../bodyLayout"
import { titleForEntry, useNavStore } from "../../nav"

/** Reset the singleton store to a clean home state in the COMPACT (portrait) layout. */
function resetCompact(): void {
  useNavStore.setState({
    view: "home",
    stack: [],
    active: null,
    snap: 2,
    query: "",
    mode: "compact",
    // Raw setState runs no reducer, so the collapse-origin must be cleared by hand to honour the store's
    // "non-null origin implies a non-empty stack" invariant between tests.
    originView: null,
  })
}

/** The predicate applied to the LIVE store, exactly as SheetHeader.shared does. */
function gateFromStore(stepIndex?: number): boolean {
  const { stack } = useNavStore.getState()
  return showBackAffordance({ stack, mode: "compact", stepIndex })
}

beforeEach(resetCompact)

describe("showBackAffordance - portrait pull-ups", () => {
  it("HIDES back on the own-profile pull-up pushed from an empty stack (the reported bug)", () => {
    // The SearchHeader avatar's push, from Home with nothing open.
    useNavStore.getState().push({ kind: "profile" })
    expect(useNavStore.getState().stack).toHaveLength(1)
    expect(gateFromStore()).toBe(false)

    // And Back from here really would just dismiss the sheet - which the grab handle already does.
    useNavStore.getState().back()
    expect(useNavStore.getState().active).toBeNull()
  })

  it("HIDES back on a laterally opened map detail (openDetail REPLACES the stack)", () => {
    useNavStore.getState().openDetail({ kind: "pin", id: "a" })
    expect(gateFromStore()).toBe(false)
    // Tapping a second marker is lateral browsing: still a single entry, still no parent.
    useNavStore.getState().openDetail({ kind: "cleanup", id: "b" })
    expect(useNavStore.getState().stack).toHaveLength(1)
    expect(gateFromStore()).toBe(false)
  })

  it("HIDES back on a deep-linked detail (seed lands a single-entry stack)", () => {
    useNavStore.getState().seed({ kind: "cleanup", id: "z" }, "compact")
    expect(useNavStore.getState().stack).toHaveLength(1)
    expect(gateFromStore()).toBe(false)
  })

  it("SHOWS back on a genuine drill-down (push APPENDS, so Back reveals the parent)", () => {
    useNavStore.getState().push({ kind: "profile" })
    useNavStore.getState().push({ kind: "language-settings" })
    expect(useNavStore.getState().stack).toHaveLength(2)
    expect(gateFromStore()).toBe(true)

    // Back really does land on the parent panel, not on home - so the chevron is honest.
    useNavStore.getState().back()
    expect(useNavStore.getState().active).toEqual({ kind: "profile" })
    // ...and once it is the root again, the chevron goes away.
    expect(gateFromStore()).toBe(false)
  })

  it("SHOWS back at every depth of the settings hub, and hides it at the hub's own root", () => {
    // The hub added a THREE-deep pull-up stack (profile -> settings -> settings-account). Depth 1 is a
    // directly-opened pull-up, so the grab handle is the exit and the chip stays hidden; from depth 2 on
    // Back has a real parent panel to reveal, so the chevron is honest at every level.
    useNavStore.getState().push({ kind: "settings" })
    expect(gateFromStore()).toBe(false)

    useNavStore.getState().back()
    useNavStore.getState().push({ kind: "profile" })
    useNavStore.getState().push({ kind: "settings" })
    expect(gateFromStore()).toBe(true)
    useNavStore.getState().push({ kind: "settings-account" })
    expect(useNavStore.getState().stack).toHaveLength(3)
    expect(gateFromStore()).toBe(true)
    expect(detailLeadingAffordance({ stack: useNavStore.getState().stack, mode: "compact" })).toBe("back")

    // ...and none of the three is a FLOW kind, so a drag really does dismiss the whole sheet.
    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().active).toBeNull()
  })

  it("SHOWS back at the ROOT for the in-progress FLOW kinds - a drag to peek refuses to dismiss them", () => {
    // "Host an event" from the Events tab: pushed onto an empty stack, so length 1 like the profile above.
    useNavStore.getState().selectView("events")
    useNavStore.getState().push({ kind: "create-cleanup" })
    expect(useNavStore.getState().stack).toHaveLength(1)
    expect(gateFromStore()).toBe(true)

    // The reason it must stay: collapseToParent NO-OPS here, so the grab handle leaves the half-filled
    // form stranded at peek instead of dismissing it. The chip is the only exit.
    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().active).toEqual({ kind: "create-cleanup" })

    // Contrast a non-flow pull-up, where collapse DOES clear it (hence no chevron needed).
    resetCompact()
    useNavStore.getState().openDetail({ kind: "pin", id: "a" })
    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().active).toBeNull()
  })

  it("SHOWS back for every flow kind, and only those, at the stack root", () => {
    const flows = ["create-cleanup", "edit-cleanup", "composer"] as const
    for (const kind of flows) {
      resetCompact()
      useNavStore.getState().openDetail({ kind, id: "x" })
      expect(gateFromStore()).toBe(true)
    }
    // "event-dashboard" belongs in THIS list: see the dedicated test below for why it is not a flow.
    for (const kind of ["pin", "cleanup", "post", "cluster", "event-dashboard"] as const) {
      resetCompact()
      useNavStore.getState().openDetail({ kind, id: "x" })
      expect(gateFromStore()).toBe(false)
    }
  })

  it('HIDES back at the root of "event-dashboard" - and the drag really does dismiss it, so nobody is trapped', () => {
    // The dashboard is not a FLOW_KIND: it holds no draft, so there is nothing for the collapse guard to
    // protect and the grab-handle drag must really dismiss it.
    useNavStore.getState().openDetail({ kind: "event-dashboard" })
    expect(useNavStore.getState().stack).toHaveLength(1)
    expect(gateFromStore()).toBe(false)

    // THE ASSERTION THAT MAKES THE HIDE SAFE, and the reason this is not just a flipped boolean: with the
    // dock hidden under any sheet detail (bodyLayout's `detailPresentation !== "sheet"`), the grab-handle
    // drag is the SOLE remaining exit - so hiding the chip is only legitimate because `collapseToParent`
    // now actually dismisses. If a future change adds "event-dashboard" to FLOW_KINDS, the collapse silently
    // becomes a no-op again and this line fails rather than shipping a dead-end screen.
    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().active).toBeNull()
    expect(useNavStore.getState().stack).toEqual([])
  })

  it("KEEPS a leading control at the root of host/edit-event - precisely because their drag is a no-op", () => {
    // THE INVERSE LOCK. The user's rationale for removing root back buttons ("they can just scroll down to
    // get rid of it") is true everywhere EXCEPT these two: `collapseToParent` no-ops for them on purpose so
    // a drag-to-peek cannot abandon a half-written event (the meet-location step needs that peek), the dock
    // is hidden the whole time a sheet detail is up, and CreateCleanupBody has no in-body Cancel. So the
    // header chip is the ONLY exit and removing it would TRAP the user in an unfinished event. Do not
    // "finish the job" of the root-chevron cleanup by deleting it - fix the drag first (see Option C in the
    // diagnosis: a discard confirmation), then this test is the thing that should change.
    for (const kind of ["create-cleanup", "edit-cleanup"] as const) {
      resetCompact()
      useNavStore.getState().openDetail({ kind, id: "x" })
      expect(useNavStore.getState().stack).toHaveLength(1)
      expect(gateFromStore()).toBe(true)

      // The drag does NOT exit: the entry survives the collapse, unchanged.
      useNavStore.getState().collapseToParent()
      expect(useNavStore.getState().active).toEqual({ kind, id: "x" })
    }
  })
})

describe("detailLeadingAffordance - chevron vs close X vs nothing", () => {
  /** The tri-state applied to the LIVE store, exactly as SheetHeader.shared does. */
  function leadingFromStore(): "back" | "close" | "none" {
    const { stack } = useNavStore.getState()
    return detailLeadingAffordance({ stack, mode: "compact" })
  }

  it('gives a CLOSE X at the root of the two flow sheets - a chevron there promises a parent that does not exist', () => {
    for (const kind of ["create-cleanup", "edit-cleanup"] as const) {
      resetCompact()
      useNavStore.getState().selectView("events")
      useNavStore.getState().push({ kind })
      expect(useNavStore.getState().stack).toHaveLength(1)
      // Still a control (the inverse lock above proves it must be), but it now reads as "close", which is
      // the only thing it has ever actually done at the root.
      expect(leadingFromStore()).toBe("close")
    }
  })

  it("gives a BACK chevron the moment there is somewhere to go", () => {
    // A genuine drill-down: the flow sheet pushed ON TOP of a parent entry.
    useNavStore.getState().push({ kind: "profile" })
    useNavStore.getState().push({ kind: "create-cleanup" })
    expect(useNavStore.getState().stack).toHaveLength(2)
    expect(leadingFromStore()).toBe("back")
    // A wizard step > 0 steps backwards inside the surface.
    expect(detailLeadingAffordance({ stack: [], mode: "compact", stepIndex: 1 })).toBe("back")
  })

  it("keeps a BACK chevron in LANDSCAPE even at the stack root - the view under it IS the parent", () => {
    // ExpandedShell is ONE persistent card that always shows something, so there is no overlay to close
    // there and both root shapes have a real destination:
    //   - ONE entry -> back() pops it and the card re-renders the body for the current VIEW, which on home
    //     is the real feed timeline (`renderBody(null, view)`, VIEW_BODY.home = "feed"). The panel header
    //     hides its own Home chip at this depth for exactly that reason (ExpandedShell.tsx's PanelHeader
    //     doc: "Back already returns to the home card").
    expect(detailLeadingAffordance({ stack: [{ kind: "create-cleanup" }], mode: "expanded" })).toBe("back")
    expect(detailLeadingAffordance({ stack: [{ kind: "pin", id: "a" }], mode: "expanded" })).toBe("back")
    //   - EMPTY stack -> a top-level VIEW is filling the card. The only body that passes `stepIndex` is the
    //     landscape report wizard, whose step-1 Back is `useNavStore.reset()`; that is view -> "home" with
    //     an empty stack, i.e. the SAME card swapping in the same home surface (on `empty stack + view
    //     "home"` ExpandedShell falls back to the FEED). A surface swap in place, not a dismissal - so this
    //     is deliberately "back" and NOT the close-wearing-a-chevron the module doc indicts. An X here
    //     would claim the landscape card can be closed, and it cannot: something always fills it.
    expect(detailLeadingAffordance({ stack: [], mode: "expanded", stepIndex: 0 })).toBe("back")
  })

  it("gives NONE wherever showBackAffordance hides the chip (it is the same gate, refined)", () => {
    for (const kind of ["pin", "cleanup", "post", "cluster", "event-dashboard"] as const) {
      resetCompact()
      useNavStore.getState().openDetail({ kind, id: "x" })
      expect(leadingFromStore()).toBe("none")
      expect(gateFromStore()).toBe(false)
    }
    // A bare tab root (report wizard step 1) has no chip at all either.
    expect(detailLeadingAffordance({ stack: [], mode: "compact", stepIndex: 0 })).toBe("none")
  })

  it('never returns "none" where showBackAffordance returns true, or vice versa', () => {
    // The invariant that makes the refinement safe: one gate, two questions. Enumerated over the whole
    // input space that matters (mode x depth x step), so a future edit cannot let the two drift apart.
    const stacks = [
      [],
      [{ kind: "pin", id: "a" } as const],
      [{ kind: "create-cleanup" } as const],
      [{ kind: "pin", id: "a" } as const, { kind: "post", id: "b" } as const],
    ]
    for (const stack of stacks) {
      for (const mode of ["compact", "expanded"] as const) {
        for (const stepIndex of [0, 1]) {
          const input = { stack, mode, stepIndex }
          expect(detailLeadingAffordance(input) === "none").toBe(!showBackAffordance(input))
        }
      }
    }
  })
})

/**
 * The other half of a kind NOT being in FLOW_KINDS: membership is read by `collapseToParent` too, and it
 * was reading only the TOP entry. That is a different question from "which chip does the header draw", but
 * it is the same list - so a kind leaving the list changed the drag behaviour of every stack that kind can
 * sit on top of, not just its own root. These pin the widened guard.
 */
describe("the FLOW_KINDS collapse guard covers the WHOLE stack, not just the top entry", () => {
  it("a drag on a child pushed ABOVE the host form no longer ejects the user out of the flow", () => {
    // THE REGRESSION. An ordinary non-flow detail pushed on top of the half-written event leaves the stack
    // as [create-cleanup, <detail>]. With that detail out of FLOW_KINDS a top-only guard saw an ordinary
    // detail here and collapsed - and a collapse clears the ENTIRE stack, so the user landed on the Events
    // tab with the host form gone.
    useNavStore.getState().selectView("events")
    useNavStore.getState().push({ kind: "create-cleanup" })
    useNavStore.getState().push({ kind: "event-dashboard" })

    useNavStore.getState().collapseToParent()
    const s = useNavStore.getState()
    expect(s.stack).toEqual([{ kind: "create-cleanup" }, { kind: "event-dashboard" }])
    expect(s.active).toEqual({ kind: "event-dashboard" })
    expect(s.view).toBe("events")
    expect(s.originView).toBe("events") // not burned - the flow's real exit still lands where it started

    // And the wider guard strands nobody: two entries always earn the chevron, which pops to the form.
    expect(detailLeadingAffordance({ stack: s.stack, mode: "compact" })).toBe("back")
    useNavStore.getState().back()
    expect(useNavStore.getState().active).toEqual({ kind: "create-cleanup" })
  })

  it("...and the same for the linked report the host form drills into", () => {
    // The forward drill-down `isGenuineHostExit` exists for ("View details" on a linked report, then "Back
    // to your event"). This one collapsed before the FLOW_KINDS edit as well - same defect, one guard.
    useNavStore.getState().selectView("events")
    useNavStore.getState().push({ kind: "create-cleanup" })
    useNavStore.getState().push({ kind: "pin", id: "r1" })

    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().stack).toHaveLength(2)
    expect(useNavStore.getState().active).toEqual({ kind: "pin", id: "r1" })
  })

  it("still collapses an ordinary drill-down - the guard is about FLOW kinds, not about depth", () => {
    // The inverse: widening the scan must not turn every deep stack into a no-op. Nothing here is a flow.
    useNavStore.getState().selectView("map")
    useNavStore.getState().openDetail({ kind: "pin", id: "a" })
    useNavStore.getState().push({ kind: "post", id: "p" })

    useNavStore.getState().collapseToParent()
    const s = useNavStore.getState()
    expect(s.stack).toEqual([])
    expect(s.active).toBeNull()
    expect(s.view).toBe("map")
  })
})

describe("showBackAffordance - the report wizard (a TAB ROOT with its own steps)", () => {
  it("HIDES back on step 1 and SHOWS it from step 2 on", () => {
    // The report tab: selectView CLEARS the stack, so the wizard always runs on an empty one.
    useNavStore.getState().selectView("report")
    expect(useNavStore.getState().stack).toEqual([])

    expect(gateFromStore(0)).toBe(false) // step 1 (capture): Back would `reset()` the whole tab.
    expect(gateFromStore(1)).toBe(true) // step 2+: Back steps the wizard.
    expect(gateFromStore(4)).toBe(true)
  })

  it("SHOWS back in LANDSCAPE even on step 1 - the panel has no dock, so it is the only exit", () => {
    // Load-bearing: ExpandedShell renders NO TabBar, so hiding this chevron would TRAP the user in the
    // wizard with no way out.
    expect(showBackAffordance({ stack: [], mode: "expanded", stepIndex: 0 })).toBe(true)
  })
})

describe("showBackAffordance - landscape", () => {
  it("always shows back wherever the panel header renders (the persistent sidebar has no dismiss)", () => {
    expect(showBackAffordance({ stack: [{ kind: "pin", id: "a" }], mode: "expanded" })).toBe(true)
    expect(
      showBackAffordance({ stack: [{ kind: "pin", id: "a" }, { kind: "post", id: "b" }], mode: "expanded" }),
    ).toBe(true)
  })
})

/**
 * `dismissGesture: false` - the surface is a full PAGE, not a pull-up.
 *
 * Every HIDE decision in this module trades the control away for the grab-handle drag. A page has no grab
 * handle, and the dock is hidden over any detail, and iOS has no hardware back - so on a page the hide is
 * not an inconvenience, it is a dead end with zero exits. These cases are the ONLY thing standing between
 * the mobile sheet -> page conversion and a trapped user, and this package's vitest run resolves the WEB
 * seam, so nothing else in the suite ever exercises them.
 */
describe("dismissGesture: a surface with no drag always keeps its control", () => {
  const root = [{ kind: "profile" } as const]

  it("SHOWS back at a page root where the identical SHEET root hides it", () => {
    // The exact pair the branch exists for: same stack, same mode, same depth - only the gesture differs.
    expect(showBackAffordance({ stack: root, mode: "compact" })).toBe(false)
    expect(showBackAffordance({ stack: root, mode: "compact", dismissGesture: false })).toBe(true)
  })

  it("draws a CHEVRON there, not an X: Back pops to the view underneath, which is a real destination", () => {
    // The store's second invariant guarantees a non-empty stack has an origin view to return to, so at
    // depth 1 Back genuinely navigates. An X would claim the page merely closes over nothing.
    expect(detailLeadingAffordance({ stack: root, mode: "compact" })).toBe("none")
    expect(detailLeadingAffordance({ stack: root, mode: "compact", dismissGesture: false })).toBe("back")
  })

  it("SHOWS back at a page root for EVERY non-flow kind - the whole conversion set", () => {
    for (const kind of [
      "profile",
      "pin",
      "cleanup",
      "post",
      "cluster",
      "event-dashboard",
      "leaderboard",
      "settings",
      "settings-account",
      "settings-privacy",
    ] as const) {
      resetCompact()
      useNavStore.getState().openDetail({ kind, id: "x" })
      const { stack } = useNavStore.getState()
      expect(showBackAffordance({ stack, mode: "compact", dismissGesture: false }), kind).toBe(true)
      expect(detailLeadingAffordance({ stack, mode: "compact", dismissGesture: false }), kind).toBe("back")
    }
  })

  it("keeps the FLOW root's close X - the flow branch runs FIRST on a page", () => {
    // A root flow page is still a flow: `collapseToParent` no-ops for it and there is nothing behind it,
    // so the control must stay but must not promise a parent screen. Ordering, not a coincidence.
    for (const kind of ["create-cleanup", "edit-cleanup", "composer"] as const) {
      resetCompact()
      useNavStore.getState().openDetail({ kind, id: "x" })
      const { stack } = useNavStore.getState()
      expect(detailLeadingAffordance({ stack, mode: "compact", dismissGesture: false }), kind).toBe("close")
      // ...and it is the SAME answer the sheet gives, so converting a flow changes nothing here.
      expect(detailLeadingAffordance({ stack, mode: "compact" }), kind).toBe("close")
    }
  })

  it("changes NOTHING once there is a real destination (a drill-down, a wizard step, landscape)", () => {
    const deep = [{ kind: "profile" } as const, { kind: "settings" } as const]
    for (const dismissGesture of [true, false]) {
      expect(detailLeadingAffordance({ stack: deep, mode: "compact", dismissGesture })).toBe("back")
      expect(detailLeadingAffordance({ stack: root, mode: "compact", stepIndex: 2, dismissGesture })).toBe("back")
      expect(detailLeadingAffordance({ stack: root, mode: "expanded", dismissGesture })).toBe("back")
      expect(detailLeadingAffordance({ stack: [], mode: "expanded", dismissGesture })).toBe("back")
    }
  })

  it("DEFAULTS to true, so every historic caller is byte-identical by omission", () => {
    for (const stack of [[], root, [{ kind: "create-cleanup" } as const]]) {
      for (const mode of ["compact", "expanded"] as const) {
        expect(showBackAffordance({ stack, mode })).toBe(
          showBackAffordance({ stack, mode, dismissGesture: true }),
        )
        expect(detailLeadingAffordance({ stack, mode })).toBe(
          detailLeadingAffordance({ stack, mode, dismissGesture: true }),
        )
      }
    }
  })

  it("is declared by the two HOSTS, and only by them", () => {
    // Source greps (house style: these files import react-native). The sheet states its gesture by
    // OMISSION - the default - and the shell's page header states its absence explicitly. If the page
    // header ever loses this prop, every converted root silently becomes a dead end again.
    //
    // The page header used to live in PortraitShell.shared and now lives in `PageStack`, which is a
    // PLATFORM SEAM - so BOTH seams are asserted, not one. That is the whole reason to grep here rather
    // than to trust one file: web and native draw the same header from two different sources, and a
    // seam that quietly dropped the prop would trap users on exactly one platform.
    const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
    expect(read("../PageStack.web.tsx")).toContain("dismissGesture={false}")
    expect(read("../PageStack.native.tsx")).toContain("dismissGesture={false}")
    expect(read("../SheetHeader.shared.tsx")).not.toContain("dismissGesture={false}")
    // ...and the shell no longer draws a page header of its own: two headers over one page would
    // double-stack the bar, and only one of them would be inside the layer that slides.
    expect(read("../PortraitShell.shared.tsx")).not.toContain("<DetailHeader")
  })

  /**
   * THE EDGE SWIPE IS ADDITIVE, NEVER A TRADE. `PageStack.native` gives every page an interactive
   * left-edge back gesture, which is precisely the shape of thing `dismissGesture` describes - and it
   * still passes FALSE, because the swipe is iOS-only, invisible, and a navigation rather than a
   * dismissal. Reporting it would hand the compact-root HIDE branch a reason to remove the ONLY visible
   * exit from every page, on a platform half of which does not have the gesture at all.
   */
  it("is NOT reported by the page host, even though a page now has an edge swipe", () => {
    const native = readFileSync(new URL("../PageStack.native.tsx", import.meta.url), "utf8")
    expect(native).toContain("Gesture.Pan()")
    expect(native).not.toContain("dismissGesture={true}")
    expect(native).not.toContain("dismissGesture />")
    // And the arming runs THROUGH this module rather than around it, so "can I swipe this away" and
    // "what does the header promise" can never give two different answers.
    expect(native).toContain("detailLeadingAffordance(")
    expect(native).toContain("canSwipeBack(")
  })
})

/**
 * P8 moved `person` OUT of this module's scope: it is no longer one of the ~19 sheet-presented bodies the
 * gate governs, it is one of the seven own-header FULL bodies the SCOPE paragraph enumerates. That is why
 * `person` was removed from the sheet-kind arrays above rather than left there as a passing coincidence.
 */
describe("person is an own-header FULL body", () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

  it("is a FULL body whose title is the header-suppression sentinel, so the gate never sees it", () => {
    expect(BODY_LAYOUT.person).toBe("full")
    // " " (not "") is the sentinel: SheetHeader.shared renders no DetailBar for it, and ExpandedShell's
    // `hasHeader = titleKey.trim() !== ""` is likewise false - so NEITHER shell draws chrome for it.
    expect(titleForEntry({ kind: "person", id: "x" })).toBe(" ")
    expect(titleForEntry({ kind: "person", id: "x" }).trim()).toBe("")
  })

  it("supplies its OWN Back and - in expanded - its own Home, because PanelHeader supplies neither", () => {
    // Suppressing PanelHeader removes its Back AND its Home chip (`showHome={stack.length > 1}`), so the
    // body has to replace both or person -> person -> person on desktop loses the one-tap route back to
    // the home sidebar. Source greps, house style: the body imports react-native, which this package's
    // node-environment vitest cannot load.
    const body = read("../../bodies/PersonDetailBody.tsx")
    expect(body).toMatch(/accessibilityLabel=\{tNav\("a11y\.back"\)\}/)
    expect(body).toMatch(/accessibilityLabel=\{tNav\("a11y\.home"\)\}/)
    // Home is gated on EXPANDED + PanelHeader's own condition, never on compact (where the dock is the
    // route home - and it is deliberately hidden for this kind).
    expect(body).toMatch(/showHome = layoutMode === "expanded" && stackDepth > 1/)
    // ...and it dispatches the same store action PanelHeader's home button does.
    expect(body).toMatch(/useNavStore\.getState\(\)\.reset\(\)/)
  })
})

describe("the gate is decided in ONE place", () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

  it("is the only thing the three header sites branch on", () => {
    // The compact sheet header (governs all ~19 sheet-presented bodies) resolves the TRI-STATE once and
    // derives both DetailBar props from that single value, so "is there a chip?" and "what does the chip
    // mean?" cannot be answered from two different reads of the stack.
    const sheet = read("../SheetHeader.shared.tsx")
    expect(sheet).toContain("detailLeadingAffordance({")
    expect(sheet).toContain('showBack={leading !== "none"}')
    expect(sheet).toContain('leading={leading === "close" ? "close" : "back"}')
    // ... the landscape panel header (still the boolean: the sidebar's chip always navigates) ...
    expect(read("../ExpandedShell.tsx")).toContain("showBack={showBackAffordance(")
    // ... and the one body that owns its own header on a tab root.
    // A nav-store selector since the camera-swipe-lag narrowing (only the boolean reaches the render),
    // but still the one shared-predicate call site this guard exists to pin.
    expect(read("../../bodies/ReportFlowBody.tsx")).toContain(
      "useNavStore((s) => showBackAffordance({ stack: s.stack, mode, stepIndex }))",
    )
  })

  it("holds each header row at its WITH-CHIP height, padding included (RN is border-box)", () => {
    // Hiding the chip must not resize the row, or the report header shrinks on step 1 and GROWS back on
    // step 2, shoving the progress rail + step body down mid-flow. RN's box model is border-box on both
    // platforms (Yoga; `boxSizing: "border-box"` on every react-native-web View), so a height floor
    // INCLUDES padding: on the wizard's PADDED header row a bare `minHeight: DETAIL_BACK_SIZE` leaves only
    // 36 - 6 - 12 = 18pt for content and never binds. The floor must be derived from that row's own pads.
    const wizard = read("../../bodies/ReportFlowBody.tsx")
    expect(wizard).toContain("minHeight: HEADER_PAD_COMPACT.top + DETAIL_BACK_SIZE + HEADER_PAD_COMPACT.bottom")
    expect(wizard).toContain("minHeight: HEADER_PAD_EXPANDED.top + DETAIL_BACK_SIZE + HEADER_PAD_EXPANDED.bottom")
    // The sheet DetailBar is the one row where a BARE floor is right - it carries no vertical padding of
    // its own (CompactShell's headerHost owns it), so chip height IS box height.
    const bar = read("../DetailBar.tsx")
    expect(bar).toContain("minHeight: DETAIL_BACK_SIZE")
    expect(bar).not.toMatch(/row:\s*\{[^}]*padding(Top|Bottom|Vertical)/)
  })

  it("keeps the flow-kind list in ONE module, shared with the store's collapse guard", () => {
    // A flow kind added to the collapse guard but forgotten here would silently strand a user mid-form.
    // And the two GUARDS must read that list the same WAY: both scan the whole stack, because a collapse
    // clears every entry and `openDetail` replaces every entry, so a flow with a child pushed on top of it
    // is exactly as abandoned as one on top. A top-only test in either drops the protection at the moment
    // the user has the most typed (see the whole-stack describe above for the [create-cleanup, verify] repro).
    expect(read("../../nav/useNavStore.ts")).toContain("s.stack.some((entry) => isFlowKind(entry.kind))")
    // Matched loosely (no receiver) because dropPinFlow owns that local's name, not this test.
    expect(read("../../map/dropPinFlow.ts")).toMatch(/stack\.some\(\(entry\) => isFlowKind\(entry\.kind\)\)/)
    // The affordance predicate reads only the ROOT on purpose: `stack.length > 1` has already returned
    // above it, so at that line the root IS the only entry.
    expect(read("../backAffordance.ts")).toContain("isFlowKind(root.kind)")
  })
})
