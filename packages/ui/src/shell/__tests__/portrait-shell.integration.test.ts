import { describe, expect, it } from "vitest"
import type { DetailEntry, View } from "../../nav"
import { portraitFramePlan, portraitShellPlan } from "../bodyLayout"

const renderPlan = (
  view: View,
  active: DetailEntry | null,
  measuredTabBarHeight = 0,
  fallback = 80,
) => {
  return portraitFramePlan(
    view,
    active,
    portraitShellPlan(view, active),
    measuredTabBarHeight,
    fallback,
  )
}

/** The same wiring, but driven by a REAL multi-entry stack (what PortraitShell.shared passes). */
const renderStackPlan = (view: View, stack: readonly DetailEntry[]) => {
  const active = stack[stack.length - 1] ?? null
  return portraitFramePlan(view, active, portraitShellPlan(view, active), 0, 80, stack)
}

describe("portrait frame wiring", () => {
  it.each([
    // [kind, the overlay's keyboardAvoidance]. Only the composer's is true: `post-thread`'s docked reply
    // bar owns the inset itself (useReplyDockInset), and the shell reserving it too double-applied the
    // keyboard on mobile web. See the regression note in portrait-shell.test.ts. `person` (P8) is a full
    // PAGE with no docked input at all, so there is nothing for the shell to reserve.
    ["composer", true],
    ["post-thread", false],
    ["person", false],
  ] as const)(
    "keeps the Home base mounted under the %s overlay while hiding bottom chrome",
    (kind, keyboardAvoidance) => {
      const before = renderPlan("home", null)
      const active: DetailEntry =
        kind === "post-thread" ? { kind, id: "post-1" } : kind === "person" ? { kind, id: "p" } : { kind }
      const during = renderPlan("home", active)

      expect(during.base).toMatchObject({
        bodyMounted: true,
        entry: null,
        transitionKey: before.base.transitionKey,
        bottomInset: before.base.bottomInset,
      })
      expect(during.overlay).toMatchObject({
        bodyMounted: true,
        entry: active,
        keyboardAvoidance,
        bottomInset: 0,
      })
      expect(during.overlay.zIndex).toBeGreaterThan(during.base.zIndex)
      expect(during.bottomChrome.visible).toBe(false)
    },
  )

  it("keeps the Map and controls mounted beneath a composer overlay", () => {
    const active: DetailEntry = { kind: "composer" }
    const shell = portraitShellPlan("map", active)
    const frame = renderPlan("map", active)

    expect(shell.mountMap).toBe(true)
    expect(shell.mountMapControls).toBe(true)
    expect(frame.base.bodyMounted).toBe(false)
    expect(frame.overlay.bodyMounted).toBe(true)
    expect(frame.overlay.zIndex).toBeGreaterThan(50)
  })

  it("renders the Report tab as a full-screen base body with the dock above it", () => {
    // Report is a regular view now: its ReportFlowBody is the base body (no map, no detail overlay),
    // and the bottom chrome (dock) stays visible above it.
    const shell = portraitShellPlan("report", null)
    const frame = renderPlan("report", null)

    expect(shell.mountMap).toBe(false)
    expect(shell.mountMapControls).toBe(false)
    expect(shell.renderBaseBody).toBe(true)
    expect(frame.base.bodyMounted).toBe(true)
    expect(frame.base.bottomInset).toBe(80)
    expect(frame.overlay.bodyMounted).toBe(false)
    expect(frame.bottomChrome.visible).toBe(true)
    expect(frame.bottomChrome.zIndex).toBeGreaterThan(frame.overlay.zIndex)
  })

  it("presents a scroll detail as a sheet ABOVE a retained composer overlay (no detour through Home)", () => {
    // THE REPORTED DEFECT: "for hosting events in new post, it should open the pull-up menu directly there
    // instead of in the home page". The composer keeps its stack entry, so the overlay layer still resolves
    // to it (topmostFullEntry) while `create-cleanup` presents as the pull-up above it — the home feed
    // underneath is never revealed.
    const composerOnly = renderStackPlan("home", [{ kind: "composer" }])
    const withSheet = renderStackPlan("home", [{ kind: "composer" }, { kind: "create-cleanup" }])

    expect(withSheet.overlay.bodyMounted).toBe(true)
    expect(withSheet.overlay.entry).toEqual({ kind: "composer" })
    // Byte-identical transition key => React never remounts the composer subtree when the sheet opens or
    // closes, so the half-written draft's UI state (scroll offset, expanded groups) survives the round trip.
    expect(withSheet.overlay.transitionKey).toBe(composerOnly.overlay.transitionKey)
    expect(withSheet.overlay.transitionKey).toBe("composer:post:")
    // Covered by a modal sheet => pointer-inert, or a tap in the bare strip above the card would reach the
    // composer behind it (and could even re-trigger the "New event" button that opened the sheet).
    expect(composerOnly.overlay.interactive).toBe(true)
    expect(withSheet.overlay.interactive).toBe(false)
    // The sheet's own scroll host owns the keyboard while it is up; the composer must not also reserve it.
    expect(composerOnly.overlay.keyboardAvoidance).toBe(true)
    expect(withSheet.overlay.keyboardAvoidance).toBe(false)
    expect(withSheet.sheet.visible).toBe(true)
    expect(withSheet.bottomChrome.visible).toBe(false)
    // LAYER LADDER: CompactShell's own anchor is z 60, so the overlay must sit strictly below it (and still
    // above AppShell's map controls at 50). A tie here used to be resolved only by sibling order.
    expect(withSheet.overlay.zIndex).toBeLessThan(60)
    expect(withSheet.overlay.zIndex).toBeGreaterThan(50)
    expect(withSheet.bottomChrome.zIndex).toBeGreaterThan(withSheet.overlay.zIndex)
  })

  it("keeps a PERSON page mounted under its own child drill-down - the mechanism P8 depends on", () => {
    // THE WHOLE REASON `person` is an unbridged FULL body rather than a pushed native screen.
    // PersonDetailBody has five child navigations (pin / cleanup / a nested person / followers /
    // following), every one of them a "scroll" kind. Each must ride as a SHEET over the retained person
    // overlay so Back returns to the profile; if the overlay unmounted here, the child would open over
    // whatever base view was behind the profile and Back would land there instead.
    const personOnly = renderStackPlan("social", [{ kind: "person", id: "p" }])
    const withChild = renderStackPlan("social", [
      { kind: "person", id: "p" },
      { kind: "cleanup", id: "e1" },
    ])

    expect(personOnly.overlay.entry).toEqual({ kind: "person", id: "p" })
    expect(withChild.overlay.bodyMounted).toBe(true)
    expect(withChild.overlay.entry).toEqual({ kind: "person", id: "p" })
    // Byte-identical key => React never remounts the profile subtree, so its tab selection and scroll
    // offset survive the round trip through the child.
    expect(withChild.overlay.transitionKey).toBe(personOnly.overlay.transitionKey)
    expect(withChild.overlay.transitionKey).toBe("person:p:::::")
    // Covered by the child's sheet card => pointer-inert, or a tap in the bare strip above it would land
    // on the profile behind a modal.
    expect(personOnly.overlay.interactive).toBe(true)
    expect(withChild.overlay.interactive).toBe(false)
    expect(withChild.sheet.visible).toBe(true)
    expect(withChild.bottomChrome.visible).toBe(false)
  })

  it("never re-animates the base surface across composer -> composer+sheet -> composer", () => {
    const before = renderStackPlan("home", [{ kind: "composer" }])
    const during = renderStackPlan("home", [{ kind: "composer" }, { kind: "create-cleanup" }])
    const after = renderStackPlan("home", [{ kind: "composer" }])

    for (const frame of [before, during, after]) {
      expect(frame.base.bodyMounted).toBe(true)
      expect(frame.base.entry).toBeNull()
      expect(frame.base.transitionKey).toBe("view:home")
      expect(frame.base.bottomInset).toBe(before.base.bottomInset)
    }
    // And the overlay identity is stable too, so the whole round trip animates ONLY the sheet.
    expect(after.overlay.transitionKey).toBe(before.overlay.transitionKey)
    expect(after.overlay.interactive).toBe(true)
  })

  it("defaults `stack` to the active entry, so a single-detail call site is unchanged", () => {
    // The defaulted 6th parameter is what keeps every pre-existing caller (and this file's own renderPlan)
    // byte-identical: one active entry behaves exactly as a one-deep stack.
    expect(renderPlan("home", { kind: "composer" })).toEqual(
      renderStackPlan("home", [{ kind: "composer" }]),
    )
    expect(renderPlan("home", { kind: "profile" })).toEqual(
      renderStackPlan("home", [{ kind: "profile" }]),
    )
    expect(renderPlan("map", null)).toEqual(renderStackPlan("map", []))
  })

  it.each([
    { kind: "profile" as const },
    { kind: "cleanup" as const, id: "event-1" },
  ])("hides the dock under a $kind detail sheet (the sheet covers it) but keeps the base footprint", (active) => {
    const frame = renderPlan("home", active)

    // Round 4: the detail sheet presents as a modal that covers the dock, so the dock chrome is hidden
    // while it is up. The base surface behind it still reserves the nonzero chrome footprint.
    expect(frame.sheet.visible).toBe(true)
    expect(frame.bottomChrome.visible).toBe(false)
    expect(frame.bottomChrome.footprint).toBe(80)
    expect(frame.base.bottomInset).toBe(80)
  })
})
