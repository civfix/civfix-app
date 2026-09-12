/**
 * Unit test for the ExpandedShell body-transition derivation (issue #60): the `transitionKey` + the
 * push/pop/replace `direction` the shell feeds into <BodyTransition>.
 *
 * Like backAffordance.test.ts, these are PURE predicates over the live nav store - no React Native
 * renderer (the package has no react-test-renderer / testing-library). The derivation in
 * ExpandedShell.tsx is:
 *   transitionKey = active ? `${kind}:${id ?? ""}` : isHome ? "home" : `view:${view}`
 *   direction     = stack longer than last render => "push"; shorter => "pop"; equal => "replace".
 * The direction predicate is now the REAL shared `directionForStackLengths` (useStackDirection.ts, used
 * by all three shells); the key derivation is still replicated. We drive both through real store
 * transitions (push appends, back pops, selectView clears, openDetail replaces), asserting each step.
 *
 * The .web wrapper's two-layers-during / one-layer-after-settle behavior is verified MANUALLY (see the
 * task's web-verification steps): open a detail => slide-in-from-right with the previous screen
 * parallaxing left; Back => reverse; tab switch => cross-fade; OS reduced-motion => instant swap.
 */
import { beforeEach, describe, expect, it } from "vitest"
import { useNavStore } from "../../nav"
import type { DetailEntry, View as NavView } from "../../nav"
import { directionForStackLengths as directionFor } from "../useStackDirection"

/** Mirror of ExpandedShell.tsx's transitionKey derivation. */
function transitionKey(active: DetailEntry | null, view: NavView): string {
  const isHome = !active && view === "home"
  return active ? `${active.kind}:${active.id ?? ""}` : isHome ? "home" : `view:${view}`
}

/** Reset the singleton store to a clean home state in the EXPANDED layout (so push appends). */
function resetExpanded(): void {
  useNavStore.setState({
    view: "home",
    stack: [],
    active: null,
    snap: 0,
    query: "",
    mode: "expanded",
    // See the nav store's origin invariant: a raw setState runs no reducer, so clear it explicitly.
    originView: null,
  })
}

beforeEach(resetExpanded)

describe("ExpandedShell BodyTransition - transitionKey", () => {
  it("keys home as 'home' (no active, home view)", () => {
    const s = useNavStore.getState()
    expect(transitionKey(s.active, s.view)).toBe("home")
  })

  it("keys a list view as 'view:<view>'", () => {
    useNavStore.getState().selectView("events")
    const s = useNavStore.getState()
    expect(s.active).toBeNull()
    expect(transitionKey(s.active, s.view)).toBe("view:events")
  })

  it("keys an open detail as '<kind>:<id>'", () => {
    useNavStore.getState().push({ kind: "pin", id: "abc" })
    const s = useNavStore.getState()
    expect(transitionKey(s.active, s.view)).toBe("pin:abc")
  })

  it("keys an id-less detail as '<kind>:'", () => {
    useNavStore.getState().push({ kind: "profile" })
    const s = useNavStore.getState()
    expect(transitionKey(s.active, s.view)).toBe("profile:")
  })

  it("changes key when the active detail changes (drives an animation)", () => {
    useNavStore.getState().push({ kind: "pin", id: "a" })
    const first = transitionKey(useNavStore.getState().active, useNavStore.getState().view)
    useNavStore.getState().push({ kind: "person", id: "b" })
    const second = transitionKey(useNavStore.getState().active, useNavStore.getState().view)
    expect(first).toBe("pin:a")
    expect(second).toBe("person:b")
    expect(first).not.toBe(second)
  })
})

describe("ExpandedShell BodyTransition - direction (stack length delta)", () => {
  it("push: opening a detail grows the stack => 'push'", () => {
    const before = useNavStore.getState().stack.length
    useNavStore.getState().push({ kind: "pin", id: "a" })
    const after = useNavStore.getState().stack.length
    expect(after).toBeGreaterThan(before)
    expect(directionFor(before, after)).toBe("push")
  })

  it("push: a second detail (expanded appends) is still 'push'", () => {
    useNavStore.getState().push({ kind: "pin", id: "a" })
    const before = useNavStore.getState().stack.length
    useNavStore.getState().push({ kind: "person", id: "b" })
    const after = useNavStore.getState().stack.length
    expect(before).toBe(1)
    expect(after).toBe(2)
    expect(directionFor(before, after)).toBe("push")
  })

  it("pop: Back shrinks the stack => 'pop'", () => {
    useNavStore.getState().push({ kind: "pin", id: "a" })
    useNavStore.getState().push({ kind: "person", id: "b" })
    const before = useNavStore.getState().stack.length
    useNavStore.getState().back()
    const after = useNavStore.getState().stack.length
    expect(after).toBeLessThan(before)
    expect(directionFor(before, after)).toBe("pop")
  })

  it("pop: Back from a single entry to home is 'pop'", () => {
    useNavStore.getState().push({ kind: "pin", id: "a" })
    const before = useNavStore.getState().stack.length
    useNavStore.getState().back()
    const after = useNavStore.getState().stack.length
    expect(before).toBe(1)
    expect(after).toBe(0)
    expect(directionFor(before, after)).toBe("pop")
  })

  it("replace: switching list tabs at the home level keeps length 0 => 'replace'", () => {
    // home (stack 0) -> events list (selectView clears the stack -> still 0).
    const before = useNavStore.getState().stack.length
    useNavStore.getState().selectView("events")
    const after = useNavStore.getState().stack.length
    expect(before).toBe(0)
    expect(after).toBe(0)
    expect(directionFor(before, after)).toBe("replace")
  })

  it("replace: a lateral openDetail pin->pin swap keeps length 1 => 'replace' (compact map browsing)", () => {
    useNavStore.getState().openDetail({ kind: "pin", id: "a" })
    const before = useNavStore.getState().stack.length
    useNavStore.getState().openDetail({ kind: "pin", id: "b" })
    const after = useNavStore.getState().stack.length
    expect(before).toBe(1)
    expect(after).toBe(1)
    expect(directionFor(before, after)).toBe("replace")
  })

  it("pop: selectView from inside a detail clears the stack => 'pop'", () => {
    // Open a detail (stack 1) then select a list tab: selectView clears the stack to 0 (shorter) => pop.
    useNavStore.getState().push({ kind: "pin", id: "a" })
    const before = useNavStore.getState().stack.length
    useNavStore.getState().selectView("reports")
    const after = useNavStore.getState().stack.length
    expect(before).toBe(1)
    expect(after).toBe(0)
    expect(directionFor(before, after)).toBe("pop")
  })
})
