import { describe, expect, it } from "vitest"
import { EASE_STANDARD, EASE_STANDARD_CSS, MOTION, type TimingRecipe } from "../motion"

function easeY(x: number, ease: readonly [number, number, number, number] = EASE_STANDARD): number {
  const [x1, y1, x2, y2] = ease
  const bez = (t: number, a: number, b: number) =>
    3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t
  let lo = 0
  let hi = 1
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (bez(mid, x1, x2) < x) lo = mid
    else hi = mid
  }
  return bez((lo + hi) / 2, y1, y2)
}

const OPENS: ReadonlyArray<[string, TimingRecipe]> = [
  ["sheetMove", MOTION.sheetMove],
  ["bodyPush", MOTION.bodyPush],
  ["dockMount", MOTION.dockMount],
  ["tabPill", MOTION.tabPill],
  ["pagePush", MOTION.pagePush],
]
const DISMISSALS: ReadonlyArray<[string, TimingRecipe]> = [
  ["sheetDismiss", MOTION.sheetDismiss],
  ["bodyExit", MOTION.bodyExit],
  ["dockMorphOut", MOTION.dockMorphOut],
  ["pagePop", MOTION.pagePop],
  ["pageSwipeSettle", MOTION.pageSwipeSettle],
]
const EXIT_PAIRS: ReadonlyArray<[string, TimingRecipe, TimingRecipe]> = [
  ["sheet", MOTION.sheetDismiss, MOTION.sheetMove],
  ["body drill", MOTION.bodyExit, MOTION.bodyPush],
  ["body replace", MOTION.bodyExit, MOTION.bodyReplace],
  ["dock morph", MOTION.dockMorphOut, MOTION.dockMount],
  ["page drill", MOTION.pagePop, MOTION.pagePush],
]

describe("motion vocabulary — perceived latency", () => {
  it("lands every OPEN between 200ms and 260ms", () => {
    for (const [, r] of OPENS) {
      expect(r.duration).toBeGreaterThanOrEqual(200)
      expect(r.duration).toBeLessThanOrEqual(260)
    }
  })

  it("finishes every DISMISSAL by 200ms without cutting to nothing", () => {
    for (const [, r] of DISMISSALS) {
      expect(r.duration).toBeLessThanOrEqual(200)
      expect(r.duration).toBeGreaterThanOrEqual(140)
    }
  })

  it("never lets an exit outlast the entrance it reverses", () => {
    for (const [, exit, entrance] of EXIT_PAIRS) {
      expect(exit.duration).toBeLessThanOrEqual(entrance.duration)
    }
  })
})

describe("motion vocabulary — the standard curve is genuinely front-loaded", () => {
  it("covers over 60% of the travel in the first 30% of the duration", () => {
    expect(easeY(0.3)).toBeGreaterThan(0.6)
  })
  it("covers over 85% of the travel by the halfway point", () => {
    expect(easeY(0.5)).toBeGreaterThan(0.85)
  })
  it("is a well-formed 0->1 easing", () => {
    expect(easeY(0)).toBeCloseTo(0, 5)
    expect(easeY(1)).toBeCloseTo(1, 5)
    let prev = -1
    for (let x = 0; x <= 1.0001; x += 0.02) {
      const y = easeY(x)
      expect(y).toBeGreaterThan(prev)
      prev = y
    }
  })
  it("keeps the CSS string and the RN tuple in lockstep", () => {
    expect(EASE_STANDARD_CSS).toBe(`cubic-bezier(${EASE_STANDARD.join(",")})`)
    expect(MOTION.easing).toBe(EASE_STANDARD)
    expect(MOTION.easingCss).toBe(EASE_STANDARD_CSS)
  })
  it("uses the standard curve for every timing recipe", () => {
    for (const [, r] of [...OPENS, ...DISMISSALS]) {
      expect(r.easing).toEqual(EASE_STANDARD)
    }
  })
})

describe("motion vocabulary — the sheet teardown guard is a fallback, not the driver", () => {
  it("outlasts the dismissal it backstops, but by no more than 150ms", () => {
    expect(MOTION.sheetTeardownGuardMs).toBeGreaterThan(MOTION.sheetDismiss.duration)
    expect(MOTION.sheetTeardownGuardMs - MOTION.sheetDismiss.duration).toBeLessThanOrEqual(150)
  })
})

describe("motion vocabulary — springs", () => {
  it("gives every spring an explicit energyThreshold and no reanimated-3 rest keys", () => {
    const springs = (Object.entries(MOTION) as ReadonlyArray<[string, unknown]>).filter(
      (entry): entry is [string, Record<string, unknown>] =>
        typeof entry[1] === "object" && entry[1] !== null && "stiffness" in entry[1],
    )
    expect(springs.length).toBeGreaterThan(0)
    for (const [, s] of springs) {
      expect(typeof s.energyThreshold).toBe("number")
      expect(s.energyThreshold as number).toBeGreaterThan(0)
      expect(s.restDisplacementThreshold).toBeUndefined()
      expect(s.restSpeedThreshold).toBeUndefined()
    }
  })

  it("keeps the dock morph spring underdamped so the liquid settle survives", () => {
    const { mass, stiffness, damping, overshootClamping } = MOTION.dockMorphIn
    const zeta = damping / (2 * Math.sqrt(stiffness * mass))
    const omegaN = Math.sqrt(stiffness / mass)
    expect(zeta).toBeGreaterThan(0.55)
    expect(zeta).toBeLessThan(0.75)
    expect(omegaN).toBeGreaterThan(8)
    expect(omegaN).toBeLessThan(12)
    expect(overshootClamping).toBe(false)
  })
})

describe("motion vocabulary — the native page stack", () => {
  it("cancels a swipe at least as fast as it completes one", () => {
    expect(MOTION.pageSwipeCancel.duration).toBeLessThanOrEqual(MOTION.pageSwipeSettle.duration)
    expect(MOTION.pageSwipeCancel.duration).toBeGreaterThanOrEqual(140)
  })

  it("keeps the whole page family on the standard curve", () => {
    for (const r of [
      MOTION.pagePush,
      MOTION.pagePop,
      MOTION.pageSwipeSettle,
      MOTION.pageSwipeCancel,
    ]) {
      expect(r.easing).toEqual(EASE_STANDARD)
    }
  })

  it("parallaxes the under-page a visible but sub-half fraction of the width", () => {
    expect(MOTION.pageParallaxRatio).toBeGreaterThan(0)
    expect(MOTION.pageParallaxRatio).toBeLessThan(0.5)
  })

  it("travels an incoming page a QUARTER-ish of the width, not the whole of it", () => {
    expect(MOTION.pageTravelRatio).toBeGreaterThanOrEqual(0.2)
    expect(MOTION.pageTravelRatio).toBeLessThanOrEqual(0.35)
  })

  it("moves the under-page LESS than the page arriving over it - parallax, not two pages sliding", () => {
    expect(MOTION.pageParallaxRatio).toBeLessThan(MOTION.pageTravelRatio)
  })

  it("keeps the covered-page dim a hint, not a scrim", () => {
    expect(MOTION.pageScrimOpacity).toBeGreaterThan(0)
    expect(MOTION.pageScrimOpacity).toBeLessThan(0.25)
  })

  it("arms the edge swipe on a strip wide enough to catch and narrow enough to stay out of the way", () => {
    expect(MOTION.pageEdgeWidth).toBeGreaterThanOrEqual(16)
    expect(MOTION.pageEdgeWidth).toBeLessThanOrEqual(44)
  })

  it("sets a swipe threshold that neither triggers by accident nor demands the whole screen", () => {
    expect(MOTION.pageCompleteFraction).toBeGreaterThanOrEqual(0.3)
    expect(MOTION.pageCompleteFraction).toBeLessThanOrEqual(0.6)
    expect(MOTION.pageCompleteVelocity).toBeGreaterThanOrEqual(400)
    expect(MOTION.pageCompleteVelocity).toBeLessThanOrEqual(1500)
  })
})
