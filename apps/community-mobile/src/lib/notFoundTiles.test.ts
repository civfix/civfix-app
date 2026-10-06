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
    assert.ok(b.x >= half && b.x <= box.width - half, `inside the walls: x=${b.x}`)
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
