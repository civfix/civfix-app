import { describe, expect, it } from "vitest"
import {
  initialScrollKeyboardState,
  reduceScrollKeyboard,
  type ScrollKeyboardSignal,
  type ScrollKeyboardState,
} from "../keyboardScrollModel"

const MINE = "scope-mine"
const run = (state: ScrollKeyboardState, ...signals: ScrollKeyboardSignal[]): ScrollKeyboardState =>
  signals.reduce(reduceScrollKeyboard, state)

const opened = (reserves = true) =>
  run(
    initialScrollKeyboardState(MINE),
    { type: "focus", scope: MINE, version: 1 },
    { type: "show", overlap: 345, reserves },
  )

describe("reduceScrollKeyboard", () => {
  it("reserves the overlap PLUS the reveal margin once a field of its own scope raised the keyboard", () => {
    expect(opened().reserve).toBe(361)
  })

  it("reveals on the show that follows the focus", () => {
    expect(opened().revealVersion).toBe(1)
  })

  it("bumps the reveal on a focus SWITCH while the keyboard stays up, without dropping the reserve", () => {
    const next = run(opened(), { type: "focus", scope: MINE, version: 2 })
    expect(next.revealVersion).toBe(2)
    expect(next.reserve).toBe(361)
  })

  it("never reserves for a foreign scope's field", () => {
    const foreign = run(
      initialScrollKeyboardState(MINE),
      { type: "focus", scope: "scope-other", version: 1 },
      { type: "show", overlap: 345, reserves: true },
    )
    expect(foreign.reserve).toBe(0)
    expect(foreign.revealVersion).toBe(0)
  })

  it("releases the reserve when focus moves to another scroller while the keyboard stays up", () => {
    const next = run(opened(), { type: "focus", scope: "scope-other", version: 2 })
    expect(next.reserve).toBe(0)
  })

  it("keeps the reserve on the bare blur that precedes a hide", () => {
    const next = run(opened(), { type: "focus", scope: null, version: 2 })
    expect(next.reserve).toBe(361)
  })

  it("HOLDS the reserve through the hide and releases it when the hold expires", () => {
    const held = run(opened(), { type: "hide" })
    expect(held).toMatchObject({ holding: true, reserve: 361, overlap: 0 })
    expect(run(held, { type: "hold-expired" })).toMatchObject({ holding: false, reserve: 0 })
  })

  it("cancels the release when a hide is followed by a show — the keyboardType flip", () => {
    const next = run(
      opened(),
      { type: "hide" },
      { type: "focus", scope: MINE, version: 2 },
      { type: "show", overlap: 297, reserves: true },
    )
    expect(next).toMatchObject({ holding: false, reserve: 313 })
    expect(run(next, { type: "hold-expired" }).reserve).toBe(313)
  })

  it("re-reveals on content growth only while the keyboard is up and the scope is its own", () => {
    expect(run(opened(), { type: "content-grew" }).revealVersion).toBe(2)
    expect(
      run(opened(), { type: "focus", scope: "scope-other", version: 2 }, { type: "content-grew" })
        .revealVersion,
    ).toBe(1)
    expect(
      run(opened(), { type: "hide" }, { type: "hold-expired" }, { type: "content-grew" }).revealVersion,
    ).toBe(1)
  })

  it("still reveals for a host whose ANCESTOR reserves the space (reserves: false)", () => {
    const next = opened(false)
    expect(next.reserve).toBe(0)
    expect(next.revealVersion).toBe(1)
  })
})
