import { describe, expect, it } from "vitest"

import { step } from "./stage-tiles"

type Body = Parameters<typeof step>[0][number]

const body = (x: number, y: number): Body => ({
  x,
  y,
  vx: 0,
  vy: 0,
  angle: 0,
  spin: 0,
  grabbed: false,
  grabDx: 0,
  grabDy: 0,
  lastPointerX: 0,
  lastPointerY: 0,
  lastPointerT: 0,
})

describe("tiles step", () => {
  it("separates two tiles clamped onto the same spot when the stage narrows", () => {
    const box = { width: 350, height: 300, tile: 92 }
    const half = box.tile / 2
    const floor = box.height - half
    const wall = box.width - half
    const bodies = [body(150, floor), body(wall, floor), body(wall, floor)]

    for (let frame = 0; frame < 240; frame++) step(bodies, box, 1 / 60)

    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i]!
        const b = bodies[j]!
        expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(box.tile * 0.95)
      }
    }
    for (const b of bodies) {
      expect(b.x).toBeGreaterThanOrEqual(half - 0.5)
      expect(b.x).toBeLessThanOrEqual(wall + 0.5)
      expect(b.y).toBeCloseTo(floor, 0)
    }
  })
})
