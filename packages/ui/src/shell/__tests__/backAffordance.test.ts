/**
 * Drives the gate against the real nav store, so the arrival verbs (selectView / push / openDetail / seed)
 * run for real: a "directly-opened pull-up" is defined by the state those verbs produce, not their name.
 * The guarded failure: a chevron on a tab root or a directly-opened pull-up that only closes the surface
 * while promising a parent screen that does not exist.
 */
import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it } from "vitest"
import { detailLeadingAffordance, showBackAffordance } from "../backAffordance"
import { BODY_LAYOUT } from "../bodyLayout"
import { titleForEntry, useNavStore } from "../../nav"
import { personDetailSource } from "../../bodies/personDetail/__tests__/personDetailSource"

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

function gateFromStore(stepIndex?: number): boolean {
  const { stack } = useNavStore.getState()
  return showBackAffordance({ stack, mode: "compact", stepIndex })
}

beforeEach(resetCompact)

describe("showBackAffordance - portrait pull-ups", () => {
  it("HIDES back on the own-profile pull-up pushed from an empty stack (the reported bug)", () => {
    useNavStore.getState().push({ kind: "profile" })
    expect(useNavStore.getState().stack).toHaveLength(1)
    expect(gateFromStore()).toBe(false)

    // Back from here would only dismiss the sheet, which the grab handle already does.
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

    useNavStore.getState().back()
    expect(useNavStore.getState().active).toEqual({ kind: "profile" })
    expect(gateFromStore()).toBe(false)
  })

  it("SHOWS back at every depth of the settings hub, and hides it at the hub's own root", () => {
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

    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().active).toBeNull()
  })

  it("SHOWS back at the ROOT for the in-progress FLOW kinds - a drag to peek refuses to dismiss them", () => {
    useNavStore.getState().selectView("events")
    useNavStore.getState().push({ kind: "create-cleanup" })
    expect(useNavStore.getState().stack).toHaveLength(1)
    expect(gateFromStore()).toBe(true)

    // collapseToParent no-ops here, so the grab handle cannot dismiss the half-filled form.
    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().active).toEqual({ kind: "create-cleanup" })

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
    for (const kind of ["pin", "cleanup", "post", "cluster", "event-dashboard"] as const) {
      resetCompact()
      useNavStore.getState().openDetail({ kind, id: "x" })
      expect(gateFromStore()).toBe(false)
    }
  })

  it('HIDES back at the root of "event-dashboard" - and the drag really does dismiss it, so nobody is trapped', () => {
    // Not a flow kind: it holds no draft, so the drag must really dismiss it.
    useNavStore.getState().openDetail({ kind: "event-dashboard" })
    expect(useNavStore.getState().stack).toHaveLength(1)
    expect(gateFromStore()).toBe(false)

    // With the dock hidden under any sheet detail the drag is the sole exit, so hiding the chip is only
    // safe because the collapse really dismisses. Adding it to FLOW_KINDS would fail here.
    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().active).toBeNull()
    expect(useNavStore.getState().stack).toEqual([])
  })

  it("KEEPS a leading control at the root of host/edit-event - precisely because their drag is a no-op", () => {
    // `collapseToParent` no-ops for these so a drag-to-peek cannot abandon a half-written event (the
    // meet-location step needs that peek), the dock is hidden, and CreateCleanupBody has no in-body
    // Cancel: the header chip is the only exit. Removing it needs a drag that dismisses safely first.
    for (const kind of ["create-cleanup", "edit-cleanup"] as const) {
      resetCompact()
      useNavStore.getState().openDetail({ kind, id: "x" })
      expect(useNavStore.getState().stack).toHaveLength(1)
      expect(gateFromStore()).toBe(true)

      useNavStore.getState().collapseToParent()
      expect(useNavStore.getState().active).toEqual({ kind, id: "x" })
    }
  })
})

describe("detailLeadingAffordance - chevron vs close X vs nothing", () => {
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
      expect(leadingFromStore()).toBe("close")
    }
  })

  it("gives a BACK chevron the moment there is somewhere to go", () => {
    useNavStore.getState().push({ kind: "profile" })
    useNavStore.getState().push({ kind: "create-cleanup" })
    expect(useNavStore.getState().stack).toHaveLength(2)
    expect(leadingFromStore()).toBe("back")
    expect(detailLeadingAffordance({ stack: [], mode: "compact", stepIndex: 1 })).toBe("back")
  })

  it("keeps a BACK chevron in LANDSCAPE even at the stack root - the view under it IS the parent", () => {
    // ExpandedShell is one persistent card that always shows something, so both root shapes have a real
    // destination. One entry: back() pops to the view's own body (the feed on home).
    expect(detailLeadingAffordance({ stack: [{ kind: "create-cleanup" }], mode: "expanded" })).toBe("back")
    expect(detailLeadingAffordance({ stack: [{ kind: "pin", id: "a" }], mode: "expanded" })).toBe("back")
    // Empty stack: the report wizard's step-1 Back swaps the home surface into the same card, a surface
    // swap rather than a dismissal. An X would claim the landscape card can be closed, and it cannot.
    expect(detailLeadingAffordance({ stack: [], mode: "expanded", stepIndex: 0 })).toBe("back")
  })

  it("gives NONE wherever showBackAffordance hides the chip (it is the same gate, refined)", () => {
    for (const kind of ["pin", "cleanup", "post", "cluster", "event-dashboard"] as const) {
      resetCompact()
      useNavStore.getState().openDetail({ kind, id: "x" })
      expect(leadingFromStore()).toBe("none")
      expect(gateFromStore()).toBe(false)
    }
    expect(detailLeadingAffordance({ stack: [], mode: "compact", stepIndex: 0 })).toBe("none")
  })

  it('never returns "none" where showBackAffordance returns true, or vice versa', () => {
    // Enumerated over mode x depth x step, so the two functions can never drift apart.
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
 * `collapseToParent` reads FLOW_KINDS too, so a kind's membership changes the drag behaviour of every
 * stack it can sit on top of, not just its own root.
 */
describe("the FLOW_KINDS collapse guard covers the WHOLE stack, not just the top entry", () => {
  it("a drag on a child pushed ABOVE the host form no longer ejects the user out of the flow", () => {
    // A top-only guard would see an ordinary detail here and collapse, and a collapse clears the entire
    // stack: the half-written host form would be gone.
    useNavStore.getState().selectView("events")
    useNavStore.getState().push({ kind: "create-cleanup" })
    useNavStore.getState().push({ kind: "event-dashboard" })

    useNavStore.getState().collapseToParent()
    const s = useNavStore.getState()
    expect(s.stack).toEqual([{ kind: "create-cleanup" }, { kind: "event-dashboard" }])
    expect(s.active).toEqual({ kind: "event-dashboard" })
    expect(s.view).toBe("events")
    expect(s.originView).toBe("events")

    // Two entries always earn the chevron, so the wider guard strands nobody.
    expect(detailLeadingAffordance({ stack: s.stack, mode: "compact" })).toBe("back")
    useNavStore.getState().back()
    expect(useNavStore.getState().active).toEqual({ kind: "create-cleanup" })
  })

  it("...and the same for the linked report the host form drills into", () => {
    // The forward drill-down `isGenuineHostExit` exists for.
    useNavStore.getState().selectView("events")
    useNavStore.getState().push({ kind: "create-cleanup" })
    useNavStore.getState().push({ kind: "pin", id: "r1" })

    useNavStore.getState().collapseToParent()
    expect(useNavStore.getState().stack).toHaveLength(2)
    expect(useNavStore.getState().active).toEqual({ kind: "pin", id: "r1" })
  })

  it("still collapses an ordinary drill-down - the guard is about FLOW kinds, not about depth", () => {
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
    // selectView clears the stack, so the wizard always runs on an empty one.
    useNavStore.getState().selectView("report")
    expect(useNavStore.getState().stack).toEqual([])

    expect(gateFromStore(0)).toBe(false)
    expect(gateFromStore(1)).toBe(true)
    expect(gateFromStore(4)).toBe(true)
  })

  it("SHOWS back in LANDSCAPE even on step 1 - the panel has no dock, so it is the only exit", () => {
    // ExpandedShell renders no TabBar, so hiding this chevron would trap the user in the wizard.
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
 * A page has no grab handle, the dock is hidden over any detail and iOS has no hardware back, so a hide
 * there is a dead end. This package's vitest run resolves the web seam, so nothing else exercises these.
 */
describe("dismissGesture: a surface with no drag always keeps its control", () => {
  const root = [{ kind: "profile" } as const]

  it("SHOWS back at a page root where the identical SHEET root hides it", () => {
    expect(showBackAffordance({ stack: root, mode: "compact" })).toBe(false)
    expect(showBackAffordance({ stack: root, mode: "compact", dismissGesture: false })).toBe(true)
  })

  it("draws a CHEVRON there, not an X: Back pops to the view underneath, which is a real destination", () => {
    // The store guarantees a non-empty stack has an origin view to return to, so Back navigates.
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
    for (const kind of ["create-cleanup", "edit-cleanup", "composer"] as const) {
      resetCompact()
      useNavStore.getState().openDetail({ kind, id: "x" })
      const { stack } = useNavStore.getState()
      expect(detailLeadingAffordance({ stack, mode: "compact", dismissGesture: false }), kind).toBe("close")
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
    // Source greps because these files import react-native. Both PageStack seams are asserted: a seam
    // that dropped the prop would trap users on exactly one platform.
    const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
    expect(read("../PageStack.web.tsx")).toContain("dismissGesture={false}")
    expect(read("../PageStack.native.tsx")).toContain("dismissGesture={false}")
    expect(read("../SheetHeader.shared.tsx")).not.toContain("dismissGesture={false}")
    // Two headers over one page would double-stack the bar, and only one would be inside the sliding layer.
    expect(read("../PortraitShell.shared.tsx")).not.toContain("<DetailHeader")
  })

  /**
   * The iOS edge swipe is additive: reporting it as a dismiss gesture would let the compact-root hide
   * branch remove the only visible exit from every page, including on platforms without the swipe.
   */
  it("is NOT reported by the page host, even though a page has an edge swipe", () => {
    const native = readFileSync(new URL("../PageStack.native.tsx", import.meta.url), "utf8")
    expect(native).toContain("Gesture.Pan()")
    expect(native).not.toContain("dismissGesture={true}")
    expect(native).not.toContain("dismissGesture />")
    // Arming runs through this module, so the swipe and the header can never disagree.
    expect(native).toContain("detailLeadingAffordance(")
    expect(native).toContain("canSwipeBack(")
  })
})

/** `person` is one of the own-header full bodies outside this module's scope, so it is absent above. */
describe("person is an own-header FULL body", () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

  it("is a FULL body whose title is the header-suppression sentinel, so the gate never sees it", () => {
    expect(BODY_LAYOUT.person).toBe("full")
    // " " (not "") is the sentinel: SheetHeader.shared renders no DetailBar for it, and ExpandedShell's
    // `hasDetailHeader` gate is false too.
    expect(titleForEntry({ kind: "person", id: "x" })).toBe(" ")
    expect(titleForEntry({ kind: "person", id: "x" }).trim()).toBe("")
  })

  it("supplies its OWN Back, and nothing beside it, because PanelHeader supplies neither", () => {
    // Source greps: the body imports react-native, which this package's node vitest cannot load.
    const body = personDetailSource()
    expect(body).toMatch(/accessibilityLabel=\{tNav\("a11y\.back"\)\}/)
    expect(body).not.toMatch(/a11y\.home/)
    expect(body).not.toMatch(/showHome/)
    expect(body).not.toMatch(/iconMap\.Home/)
  })

  it("leaves the landscape panel header with Back as its ONLY navigation chip", () => {
    const shell = read("../ExpandedShell.tsx")
    expect(shell).not.toMatch(/showHome/)
    expect(shell).not.toMatch(/iconMap\.Home/)
    expect(shell).not.toMatch(/a11y\.home/)
  })
})

describe("the gate is decided in ONE place", () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

  it("is the only thing the three header sites branch on", () => {
    // The sheet header derives both DetailBar props from one tri-state read, so "is there a chip?" and
    // "what does it mean?" cannot come from two different reads of the stack.
    const sheet = read("../SheetHeader.shared.tsx")
    expect(sheet).toContain("detailLeadingAffordance({")
    expect(sheet).toContain('showBack={leading !== "none"}')
    expect(sheet).toContain('leading={leading === "close" ? "close" : "back"}')
    // The landscape chip always navigates, so it keeps the boolean.
    expect(read("../ExpandedShell.tsx")).toContain("showBack={showBackAffordance(")
    // A nav-store selector so only the boolean reaches the render.
    expect(read("../../bodies/ReportFlowBody.tsx")).toContain(
      "useNavStore((s) => showBackAffordance({ stack: s.stack, mode, stepIndex }))",
    )
  })

  it("holds each header row at its WITH-CHIP height, padding included (RN is border-box)", () => {
    // Hiding the chip must not resize the row, or the report header shrinks on step 1 and grows on step
    // 2. RN is border-box on both platforms, so on the wizard's padded row a bare
    // `minHeight: DETAIL_BACK_SIZE` leaves 36 - 6 - 12 = 18pt for content and never binds.
    const wizard = read("../../bodies/ReportFlowBody.tsx")
    expect(wizard).toContain("minHeight: HEADER_PAD_COMPACT.top + DETAIL_BACK_SIZE + HEADER_PAD_COMPACT.bottom")
    expect(wizard).toContain("minHeight: HEADER_PAD_EXPANDED.top + DETAIL_BACK_SIZE + HEADER_PAD_EXPANDED.bottom")
    // DetailBar carries no vertical padding of its own (CompactShell's headerHost owns it).
    const bar = read("../DetailBar.tsx")
    expect(bar).toContain("minHeight: DETAIL_BACK_SIZE")
    expect(bar).not.toMatch(/row:\s*\{[^}]*padding(Top|Bottom|Vertical)/)
  })

  it("keeps the flow-kind list in ONE module, shared with the store's collapse guard", () => {
    // Both guards scan the whole stack: a collapse clears every entry and `openDetail` replaces every
    // entry, so a flow with a child pushed on top is exactly as abandoned as one on top.
    expect(read("../../nav/useNavStore.ts")).toContain("s.stack.some((entry) => isFlowKind(entry.kind))")
    expect(read("../../map/dropPinFlow.ts")).toMatch(/stack\.some\(\(entry\) => isFlowKind\(entry\.kind\)\)/)
    // Only the root: `stack.length > 1` has already returned above that line.
    expect(read("../backAffordance.ts")).toContain("isFlowKind(root.kind)")
  })
})
