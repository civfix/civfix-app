import assert from "node:assert/strict"
import { test } from "node:test"
import {
  dragTile,
  dropTiles,
  grabTile,
  releaseTile,
  stepTiles,
  tileAt,
  type TileBody,
  type TileBox,
} from "./notFoundTiles.ts"

const BOX: TileBox = { width: 350, height: 234, tile: 92 }
const FRAME = 1 / 60

function run(bodies: TileBody[], box: TileBox, frames: number): void {
  for (let i = 0; i < frames; i++) stepTiles(bodies, box, FRAME)
}

function assertSettledRow(bodies: readonly TileBody[], box: TileBox): void {
  const half = box.tile / 2
  for (const b of bodies) {
    assert.ok(Math.abs(b.y - (box.height - half)) < 0.5, `on the floor: y=${b.y}`)
    assert.ok(b.x >= half - 0.5 && b.x <= box.width - half + 0.5, `inside the walls: x=${b.x}`)
    const upright = ((b.angle % 360) + 360) % 360
    assert.ok(Math.min(upright, 360 - upright) < 1, `upright: angle=${b.angle}`)
  }
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const d = Math.hypot(bodies[j]!.x - bodies[i]!.x, bodies[j]!.y - bodies[i]!.y)
      assert.ok(d > box.tile * 0.95, `tiles ${i} and ${j} are ${d} apart`)
    }
  }
}

test("the tiles start above the stage and land upright, side by side, in reading order", () => {
  const bodies = dropTiles(BOX)
  for (const b of bodies) assert.ok(b.y + BOX.tile / 2 < 0, "starts above the stage")
  run(bodies, BOX, 240)
  assertSettledRow(bodies, BOX)
  assert.ok(bodies[0]!.x < bodies[1]!.x && bodies[1]!.x < bodies[2]!.x)
})

test("a touch finds the topmost tile under it, through the tile's tilt", () => {
  const bodies = dropTiles(BOX)
  run(bodies, BOX, 240)
  const middle = bodies[1]!
  assert.equal(tileAt(bodies, BOX.tile, middle.x, middle.y), 1)
  assert.equal(tileAt(bodies, BOX.tile, middle.x, middle.y - BOX.tile), -1)
  bodies[0]!.x = middle.x
  bodies[0]!.y = middle.y
  assert.equal(tileAt(bodies, BOX.tile, middle.x, middle.y), 1, "the later tile is drawn on top")

  const tilted: TileBody[] = [{ ...middle, x: 100, y: 100, angle: 45 }]
  const corner = BOX.tile / 2 - 2
  assert.equal(tileAt(tilted, BOX.tile, 100 + corner, 100 + corner), -1, "an unrotated corner is outside a 45° tile")
  assert.equal(tileAt(tilted, BOX.tile, 100, 100 + corner * Math.SQRT2 - 2), 0, "its rotated corner is inside")
})

test("a thrown tile follows the finger, flies, and the row settles again", () => {
  const bodies = dropTiles(BOX)
  run(bodies, BOX, 240)
  const tile = bodies[1]!
  grabTile(tile, tile.x + 10, tile.y + 10)
  dragTile(tile, 60, 40, -3000, -4000)
  assert.equal(tile.x, 50)
  assert.equal(tile.y, 30)
  stepTiles(bodies, BOX, FRAME)
  assert.equal(tile.x, 50, "a grabbed tile stays under the finger")
  releaseTile(tile)
  assert.ok(Math.abs(Math.hypot(tile.vx, tile.vy) - 2800) < 1e-6, "the fling is capped")
  run(bodies, BOX, 6)
  assert.ok(tile.y < 30, "it flies up after the release")
  run(bodies, BOX, 600)
  assertSettledRow(bodies, BOX)
})

test("tiles clamped onto one wall spot after the stage narrows separate again", () => {
  const bodies = dropTiles(BOX)
  run(bodies, BOX, 240)
  const narrow: TileBox = { ...BOX, width: 300 }
  bodies[1]!.x = narrow.width - BOX.tile / 2
  bodies[2]!.x = narrow.width - BOX.tile / 2
  run(bodies, narrow, 240)
  assertSettledRow(bodies, narrow)
})

// The smallest normal 32-bit float: Reanimated's `std::stof` throws below it.
const FLT_MIN = 1.1754943508222875e-38

function assertRenderable(bodies: readonly TileBody[]): void {
  for (const b of bodies) {
    for (const value of [b.x, b.y, b.angle]) {
      assert.ok(value === 0 || Math.abs(value) >= FLT_MIN, `renders a subnormal float: ${value}`)
    }
  }
}

// The stage loop clamps its step to 1/30 s, so a slower device still steps at 30 fps.
test("left alone for a minute, the tiles snap to an exact rest and report it", () => {
  for (const fps of [30, 60, 120]) {
    const bodies = dropTiles(BOX)
    let moving = true
    for (let i = 0; i < fps * 60; i++) {
      moving = stepTiles(bodies, BOX, 1 / fps)
      assertRenderable(bodies)
    }
    assert.equal(moving, false, `at rest at ${fps} fps`)
    assertSettledRow(bodies, BOX)
    for (const b of bodies) {
      assert.equal(b.angle % 360, 0, `exactly upright at ${fps} fps: ${b.angle}`)
      assert.equal(b.y, BOX.height - BOX.tile / 2)
    }
    const rest = bodies.map((b) => ({ ...b }))
    assert.equal(stepTiles(bodies, BOX, 1 / fps), false)
    assert.deepEqual(bodies, rest, "a resting row stays exactly where it is")
  }
})

test("the tiles report motion while they fall and while one is held, even held still", () => {
  const bodies = dropTiles(BOX)
  assert.equal(stepTiles(bodies, BOX, FRAME), true, "falling")
  run(bodies, BOX, 600)
  assert.equal(stepTiles(bodies, BOX, FRAME), false)
  const tile = bodies[0]!
  grabTile(tile, tile.x, tile.y)
  dragTile(tile, tile.x, tile.y - 40, 0, 0)
  for (let i = 0; i < 3600; i++) {
    assert.equal(stepTiles(bodies, BOX, FRAME), true, "held")
    assertRenderable(bodies)
  }
  releaseTile(tile)
  assert.equal(stepTiles(bodies, BOX, FRAME), true, "dropped")
  run(bodies, BOX, 600)
  assert.equal(stepTiles(bodies, BOX, FRAME), false, "back at rest")
  assertRenderable(bodies)
})

// The wall clamp and the pair separation take turns after the stage narrows; the
// loop stops on the first step that reports rest, so that step's pose is what stays drawn.
test("after the stage narrows under a resting row, rest is only reported once the tiles stop moving", () => {
  for (const [from, to] of [
    [320, 280],
    [320, 290],
    [312, 272],
  ] as const) {
    const wide: TileBox = { ...BOX, width: from }
    const bodies = dropTiles(wide)
    run(bodies, wide, 600)
    assert.equal(stepTiles(bodies, wide, FRAME), false)
    const narrow: TileBox = { ...BOX, width: to }
    let steps = 0
    while (stepTiles(bodies, narrow, FRAME)) assert.ok(++steps < 600, `${from}→${to} comes to rest`)
    const rest = bodies.map((b) => ({ ...b }))
    run(bodies, narrow, 600)
    bodies.forEach((b, i) => {
      const shift = Math.hypot(b.x - rest[i]!.x, b.y - rest[i]!.y)
      assert.ok(shift < 0.05, `${from}→${to}: tile ${i} moves ${shift} after reporting rest`)
    })
    assertSettledRow(rest, narrow)
  }
})
