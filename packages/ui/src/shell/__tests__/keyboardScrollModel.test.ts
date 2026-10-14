import { describe, expect, it } from "vitest"
import {
  initialScrollKeyboardState,
  reduceScrollKeyboard,
  scrollKeyboardReveals,
  type ScrollKeyboardSignal,
  type ScrollKeyboardState,
} from "../keyboardScrollModel"

const MINE = "scope-mine"
const run = (state: ScrollKeyboardState, ...signals: ScrollKeyboardSignal[]): ScrollKeyboardState =>
  signals.reduce(reduceScrollKeyboard, state)

const focus = (
  scope: string | null,
  extra: Partial<Extract<ScrollKeyboardSignal, { type: "focus" }>> = {},
): ScrollKeyboardSignal => ({
  type: "focus",
  scope,
  focused: scope !== null,
  overlap: 0,
  reserves: true,
  hostReserved: false,
  ...extra,
})

const show = (
  overlap: number,
  extra: Partial<Extract<ScrollKeyboardSignal, { type: "show" }>> = {},
): ScrollKeyboardSignal => ({ type: "show", overlap, reserves: true, hostReserved: false, ...extra })

const opened = (reserves = true) =>
  run(initialScrollKeyboardState(MINE), focus(MINE), show(345, { reserves }))

describe("reduceScrollKeyboard", () => {
  it("reserves the overlap PLUS the reveal margin once a field of its own scope raised the keyboard", () => {
    expect(opened().reserve).toBe(361)
  })

  it("reveals on the show that follows the focus", () => {
    expect(opened().revealVersion).toBe(1)
  })

  it("bumps the reveal on a focus SWITCH while the keyboard stays up, without dropping the reserve", () => {
    const next = run(opened(), focus(MINE, { overlap: 345 }))
    expect(next.revealVersion).toBe(2)
    expect(next.reserve).toBe(361)
  })

  it("reserves AND reveals for a focus into a fresh scope while the keyboard is already up", () => {
    const fresh = run(initialScrollKeyboardState(MINE), focus(MINE, { overlap: 345 }))
    expect(fresh.reserve).toBe(361)
    expect(fresh.revealVersion).toBe(1)
    expect(fresh.overlap).toBe(345)
  })

  it("reserves nothing on a focus into a fresh scope while the keyboard is down", () => {
    const fresh = run(initialScrollKeyboardState(MINE), focus(MINE))
    expect(fresh.reserve).toBe(0)
    expect(fresh.revealVersion).toBe(0)
  })

  it("leaves only the reveal margin when a pinned sibling already lifts by the overlap", () => {
    const next = run(initialScrollKeyboardState(MINE), focus(MINE), show(345, { hostReserved: true }))
    expect(next.reserve).toBe(16)
    expect(next.revealVersion).toBe(1)
  })

  it("never reserves for a foreign scope's field", () => {
    const foreign = run(initialScrollKeyboardState(MINE), focus("scope-other"), show(345))
    expect(foreign.reserve).toBe(0)
    expect(foreign.revealVersion).toBe(0)
  })

  it("releases the reserve when focus moves to another scroller while the keyboard stays up", () => {
    expect(run(opened(), focus("scope-other")).reserve).toBe(0)
  })

  it("releases the reserve for a field that belongs to NO scroller", () => {
    expect(run(opened(), focus(null, { focused: true })).reserve).toBe(0)
  })

  it("keeps the reserve on the bare blur that precedes a hide", () => {
    expect(run(opened(), focus(null)).reserve).toBe(361)
  })

  it("HOLDS the reserve through the hide and releases it when the hold expires", () => {
    const held = run(opened(), { type: "hide" })
    expect(held).toMatchObject({ holding: true, reserve: 361, overlap: 0 })
    expect(run(held, { type: "hold-expired" })).toMatchObject({ holding: false, reserve: 0 })
  })

  it("cancels the release when a hide is followed by a show: the keyboardType flip", () => {
    const next = run(opened(), { type: "hide" }, focus(MINE), show(297))
    expect(next).toMatchObject({ holding: false, reserve: 313 })
    expect(run(next, { type: "hold-expired" }).reserve).toBe(313)
  })

  it("re-reveals on content growth only while the keyboard is up and the scope is its own", () => {
    expect(run(opened(), { type: "content-grew" }).revealVersion).toBe(2)
    expect(run(opened(), focus("scope-other"), { type: "content-grew" }).revealVersion).toBe(1)
    expect(
      run(opened(), { type: "hide" }, { type: "hold-expired" }, { type: "content-grew" }).revealVersion,
    ).toBe(1)
  })

  it("returns the SAME state for a signal that changes nothing, so no scroller re-renders", () => {
    const idle = initialScrollKeyboardState(MINE)
    expect(reduceScrollKeyboard(idle, focus(null))).toBe(idle)
    expect(reduceScrollKeyboard(idle, focus("scope-other"))).toBe(idle)
    expect(reduceScrollKeyboard(idle, { type: "content-grew" })).toBe(idle)
    expect(reduceScrollKeyboard(idle, { type: "hide" })).toBe(idle)
    expect(reduceScrollKeyboard(idle, { type: "hold-expired" })).toBe(idle)
    const focused = run(idle, focus(MINE))
    expect(reduceScrollKeyboard(focused, focus(MINE))).toBe(focused)
  })

  it("still reveals for a host whose ANCESTOR reserves the space (reserves: false)", () => {
    const next = opened(false)
    expect(next.reserve).toBe(0)
    expect(next.revealVersion).toBe(1)
  })
})

describe("scrollKeyboardReveals", () => {
  it("reveals once a field of its OWN scope raised the keyboard", () => {
    expect(scrollKeyboardReveals(opened())).toBe(true)
  })

  it("never reveals for a focus that moved to a FOREIGN scope, even as the keyboard re-reports", () => {
    const foreign = run(opened(), focus("scope-other"), show(412))
    expect(foreign.overlap).toBe(412)
    expect(foreign.revealVersion).toBe(1)
    expect(scrollKeyboardReveals(foreign)).toBe(false)
  })

  it("never reveals before a focus, or once the keyboard is gone", () => {
    expect(scrollKeyboardReveals(initialScrollKeyboardState(MINE))).toBe(false)
    expect(scrollKeyboardReveals(run(opened(), { type: "hide" }))).toBe(false)
  })
})
