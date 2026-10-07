/**
 * The expanded shell's `transitionKey` and push/pop/replace `direction`, driven through real store
 * transitions (push appends, back pops, selectView clears, openDetail replaces). The key derivation is
 * replicated from ExpandedShell.tsx; the direction predicate is the real shared `directionForStackLengths`.
 *
 * The second block pins the web seam's mount invariant by source text: swapping between an unkeyed settled
 * child and keyed animation layers makes React delete and re-create the body on every away-and-back trip,
 * re-running the feed's refetch, replaying the entrance and blanking every react-native-web <Image>. The
 * seam ping-pongs between two constant-key layers so each body keeps one React identity. The rendered
 * proof lives in apps/community-web/src/components/home/body-transition-mounts.dom.test.tsx.
 */
import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it } from "vitest"
import { useNavStore } from "../../nav"
import type { DetailEntry, View as NavView } from "../../nav"
import { directionForStackLengths as directionFor } from "../useStackDirection"
import { surfaceKey } from "../bodyLayout"
import { entryDiscriminator } from "../../nav/routes"

/** ExpandedShell.tsx's transitionKey derivation. */
function transitionKey(active: DetailEntry | null, view: NavView): string {
  return surfaceKey(view, active)
}

function resetExpanded(): void {
  useNavStore.setState({
    view: "home",
    stack: [],
    active: null,
    snap: 0,
    query: "",
    mode: "expanded",
    // A raw setState runs no reducer, so the origin must be cleared explicitly.
    originView: null,
  })
}

beforeEach(resetExpanded)

describe("ExpandedShell BodyTransition - transitionKey", () => {
  it("keys home as 'view:home' (no active, home view)", () => {
    const s = useNavStore.getState()
    expect(transitionKey(s.active, s.view)).toBe("view:home")
  })

  it("keys a list view as 'view:<view>'", () => {
    useNavStore.getState().selectView("events")
    const s = useNavStore.getState()
    expect(s.active).toBeNull()
    expect(transitionKey(s.active, s.view)).toBe("view:events")
  })

  it("keys an open detail by the entry's full identity", () => {
    useNavStore.getState().push({ kind: "pin", id: "abc" })
    const s = useNavStore.getState()
    expect(transitionKey(s.active, s.view)).toBe(entryDiscriminator({ kind: "pin", id: "abc" }))
  })

  it("keys an id-less detail by its kind", () => {
    useNavStore.getState().push({ kind: "profile" })
    const s = useNavStore.getState()
    expect(transitionKey(s.active, s.view)).toBe(entryDiscriminator({ kind: "profile" }))
  })

  it("changes key when the active detail changes (drives an animation)", () => {
    useNavStore.getState().push({ kind: "pin", id: "a" })
    const first = transitionKey(useNavStore.getState().active, useNavStore.getState().view)
    useNavStore.getState().push({ kind: "person", id: "b" })
    const second = transitionKey(useNavStore.getState().active, useNavStore.getState().view)
    expect(first).not.toBe(second)
  })

  it("changes key between two entities that share a kind and have no id (org slug, leaderboard geoid)", () => {
    useNavStore.getState().push({ kind: "org", slug: "a" })
    const first = transitionKey(useNavStore.getState().active, useNavStore.getState().view)
    useNavStore.getState().push({ kind: "org", slug: "b" })
    const second = transitionKey(useNavStore.getState().active, useNavStore.getState().view)
    expect(first).not.toBe(second)
    expect(transitionKey({ kind: "leaderboard", geoid: "06" }, "home")).not.toBe(
      transitionKey({ kind: "leaderboard", geoid: "36" }, "home"),
    )
    expect(transitionKey({ kind: "announcement", id: "c", announcementId: "1" }, "home")).not.toBe(
      transitionKey({ kind: "announcement", id: "c", announcementId: "2" }, "home"),
    )
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

const WEB_SEAM = readFileSync(new URL("../BodyTransition.web.tsx", import.meta.url), "utf8")

describe("BodyTransition.web - one stable React identity per body", () => {
  it("renders TWO layers with constant slot keys and nothing else", () => {
    expect(WEB_SEAM).toContain('const OTHER_SLOT: Record<SlotId, SlotId> = { a: "b", b: "a" }')
    expect(WEB_SEAM).toMatch(/\{renderLayer\("a"\)\}\s*\{renderLayer\("b"\)\}/)
    expect(WEB_SEAM).toContain("key={slot}")
  })

  it("keys no LAYER by the transitionKey, which is what made a settle a delete+create", () => {
    expect(WEB_SEAM).not.toMatch(/key=\{`/)
    expect(WEB_SEAM).not.toContain("`in:${")
    expect(WEB_SEAM).not.toContain("`out:${")
  })

  it("keys the CONTENT of a slot by its screen, so one entity never inherits another's instance", () => {
    expect(WEB_SEAM).toContain("const activeContent = <Fragment key={state.key}>{children}</Fragment>")
    expect(WEB_SEAM).toContain("<Fragment key={anim.outgoingKey}>{anim.outgoing}</Fragment>")
    expect(WEB_SEAM).toContain("outgoingKey: state.key")
  })

  it("has exactly ONE return shape: the host is emitted once, never per phase", () => {
    expect(WEB_SEAM.match(/<View style=\{styles\.host\}>/g)).toHaveLength(1)
    expect(WEB_SEAM).not.toMatch(/if \(!anim\)\s*\{?\s*return\s*</)
    expect(WEB_SEAM.match(/<View\b/g)).toHaveLength(2)
  })

  it("derives the incoming slot DURING RENDER, before any effect runs", () => {
    const derivation = WEB_SEAM.indexOf("if (state.key !== transitionKey) {")
    const firstEffect = WEB_SEAM.indexOf("useEffect(")
    expect(derivation).toBeGreaterThan(-1)
    expect(firstEffect).toBeGreaterThan(-1)
    expect(derivation).toBeLessThan(firstEffect)
    expect(WEB_SEAM).toContain("activeSlot: instant ? state.activeSlot : OTHER_SLOT[state.activeSlot]")
  })

  it("routes the outgoing tree to the slot it already occupies and vacates it on settle", () => {
    expect(WEB_SEAM).toContain("{active ? activeContent : outgoingContent}")
    expect(WEB_SEAM).toContain("anim && !anim.outDropped ?")
    expect(WEB_SEAM).toContain("outgoing: committedChildRef.current")
  })

  it("keeps the settled layer free of the transform and z-index an animation needs", () => {
    expect(WEB_SEAM).toContain('const IDLE: LayerStyle = { transform: "none", opacity: 1 }')
    expect(WEB_SEAM).toContain('const VACANT: LayerStyle = { transform: "none", opacity: 0 }')
    expect(WEB_SEAM).toContain("const zIndex = anim ? (active ? 1 : 0) : undefined")
    expect(WEB_SEAM).toContain('const activeTransition = phase && flipped ? phase.incomingTransition : "none"')
  })

  it("still runs the incoming/outgoing animation, the reduced-motion swap and the settle fallback", () => {
    expect(WEB_SEAM).toContain("incomingTo: ARRIVED")
    expect(WEB_SEAM).toContain("const ARRIVED: LayerStyle = { transform: translateRatio(0), opacity: 1 }")
    expect(WEB_SEAM).toContain("const outgoingTransition = phase && flipped ? phase.outgoingTransition")
    expect(WEB_SEAM).toContain("const instant = prefersReducedMotion()")
    expect(WEB_SEAM).toContain("const SETTLE_FALLBACK_MS = IN_DURATION + 60")
    expect(WEB_SEAM).toContain("fallbackMs: SETTLE_FALLBACK_MS,")
    expect(WEB_SEAM).toMatch(/const outDrop = setTimeout\([\s\S]*?OUT_DURATION\)/)
    expect(WEB_SEAM).toContain("return () => clearTimeout(outDrop)")
    expect(WEB_SEAM).toContain("onTransitionEnd")
  })

  it("creates an Animation ONLY in the render-phase update that increments nav, which its effect keys on", () => {
    expect(WEB_SEAM.match(/flipped: false,\s*\n?\s*outDropped: false/g)).toHaveLength(1)
    expect(WEB_SEAM).toContain("nav: state.nav + 1")
    expect(WEB_SEAM).toContain("pendingNav: anim && !anim.flipped ? state.nav : null,")
    expect(WEB_SEAM).toContain("const phaseNav = anim ? state.nav : null")
    expect(WEB_SEAM).toContain("}, [phaseNav])")
  })

  it("leaves the inactive layer inert instead of letting it intercept the pointer", () => {
    expect(WEB_SEAM).toContain('pointerEvents: interactive ? undefined : "none"')
    expect(WEB_SEAM).toContain("castLayerStyle(layer, transition, zIndex, active)")
  })
})
