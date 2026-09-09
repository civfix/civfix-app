/**
 * PURE decisions for LEAVING Search (shell/searchExitModel.ts). The seams only wire reanimated around
 * these, so this file is where the exit's semantics are pinned.
 */
import { describe, expect, it } from "vitest"
import { focusSettleCommand, FOCUS_SETTLE_P_EPSILON, searchExitPublish } from "../searchExitModel"

describe("focusSettleCommand — the exit is carried by ONE curve", () => {
  it("animates the focus RISE when the docked field pins", () => {
    // GUARD (green before this task): searchActive stays true here, so this branch never consults `p`.
    expect(focusSettleCommand(true, true, 1)).toEqual({ target: 1, animated: true })
  })

  it("animates the focus COLLAPSE while STAYING in Search — the ✕ keeps its own dockFocus curve", () => {
    // GUARD (green before this task): onClearSearch never touches `view`, so searchActive stays true and
    // `p` is irrelevant here. Its meaning is unchanged by this workstream: `animated` MUST be true. If
    // this line is ever relaxed to `animated: false`, the trailing ✕'s dockFocus collapse silently
    // becomes a hard jump.
    expect(focusSettleCommand(false, true, 1)).toEqual({ target: 0, animated: true })
  })

  it("the ✕-clear / pin-unpin path (searchActive=true) ignores p entirely — byte-identical at any morph progress", () => {
    for (const p of [0, 0.3, 0.5, 0.99, 1]) {
      expect(focusSettleCommand(true, true, p)).toEqual({ target: 1, animated: true })
      expect(focusSettleCommand(false, true, p)).toEqual({ target: 0, animated: true })
    }
  })

  it("SETTLES focus instantly on exit ONLY once the enter-morph has effectively finished (p >= 1 - EPSILON)", () => {
    // dockShapes composes both: rightW = lerp(f, rightWp(p), fieldFocusW). At p=1, (regionW - rightWp) ==
    // (u + gap) for every f, so settling f 1->0 on dockFocus at the same moment p times 1->0 on
    // dockMorphOut is geometrically free — only this case gets the instant settle.
    expect(focusSettleCommand(true, false, 1)).toEqual({ target: 0, animated: false })
    expect(focusSettleCommand(false, false, 1)).toEqual({ target: 0, animated: false })
    // The threshold boundary itself settles (inclusive).
    expect(focusSettleCommand(true, false, 1 - FOCUS_SETTLE_P_EPSILON)).toEqual({ target: 0, animated: false })
    // A spring's overshoot bounce can push the raw shared value slightly past 1 (dockMorphIn has
    // overshootClamping: false) — dockShapes clamps to 1 internally, so the geometry is identical to p=1
    // and the settle must still fire.
    expect(focusSettleCommand(true, false, 1.05)).toEqual({ target: 0, animated: false })
  })

  it("FALLS BACK to the animated dockFocus retarget on exit when p has not settled (the fast tap-focus-then-exit case)", () => {
    // Re-derived from dockShapes: at p < 1, (regionW - rightWp) != (u + gap) in general, so settling f
    // instantly steps rightX sideways (worked example: regionW=300, p=0.5 -> an 88pt jump). Falling back to
    // the animated retarget keeps this smooth at any p — exactly the pre-Task-4.3 behavior, preserved only
    // for the case the instant settle cannot safely handle.
    expect(focusSettleCommand(true, false, 0.5)).toEqual({ target: 0, animated: true })
    expect(focusSettleCommand(false, false, 0.5)).toEqual({ target: 0, animated: true })
    expect(focusSettleCommand(true, false, 0)).toEqual({ target: 0, animated: true })
    // Just below the threshold boundary (exclusive).
    expect(focusSettleCommand(true, false, 1 - FOCUS_SETTLE_P_EPSILON - 0.001)).toEqual({
      target: 0,
      animated: true,
    })
  })

  it("is total over the three inputs (no undefined cell)", () => {
    for (const pinned of [true, false]) {
      for (const searchActive of [true, false]) {
        for (const p of [0, 0.5, 0.99, 1]) {
          const cmd = focusSettleCommand(pinned, searchActive, p)
          expect([0, 1]).toContain(cmd.target)
          expect(typeof cmd.animated).toBe("boolean")
        }
      }
    }
  })
})

describe("searchExitPublish — when the search body's exit freeze is armed and released", () => {
  it("RE-ARMS the freeze on every Search ENTER", () => {
    // The freeze must be live on the first frame of the NEXT exit — the frame selectView clears the query
    // in — so it is armed on entry, never at exit time.
    expect(searchExitPublish(1, true)).toBe("reset")
    expect(searchExitPublish(1, false)).toBe("reset")
  })
  it("HOLDS the freeze across an animated exit, to be released when the timing lands", () => {
    expect(searchExitPublish(0, true)).toBe("hold")
  })
  it("SETTLES immediately when there is no fade to protect (reduce-motion, or pre-measurement)", () => {
    // Reduce-motion jumps p straight to the target: there are no fade frames, so freezing content would
    // only strand a stale surface.
    expect(searchExitPublish(0, false)).toBe("settle")
  })
})
