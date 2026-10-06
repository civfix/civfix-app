import assert from "node:assert/strict"
import { test } from "node:test"
import { POTHOLE_PIECES, dropPothole, restingPothole, stepPothole } from "./notFoundPothole.ts"

test("the pieces fall once and stop in exactly the resting pose", () => {
  const scene = dropPothole(280)
  let frames = 0
  while (stepPothole(scene, 1 / 60)) {
    frames += 1
    assert.ok(frames < 60 * 5, "the fall stops within five seconds")
  }
  assert.ok(frames > 30, `the fall is seen: ${frames} frames`)
  const rest = restingPothole()
  for (const name of POTHOLE_PIECES) {
    const { dy, vy, angle, spin, squash } = scene.pieces[name]
    const want = rest.pieces[name]
    assert.deepEqual({ dy, vy, angle, spin, squash }, { dy: want.dy, vy: want.vy, angle: want.angle, spin: want.spin, squash: want.squash })
  }
  assert.equal(rest.pieces.zero.angle, -9, "the 0 rests crooked in the hole")
  assert.equal(rest.pieces.firstFour.angle, 0)
})

test("the 0 waits for its delay above the stage while the first 4 falls", () => {
  const scene = dropPothole(280)
  for (let i = 0; i < 12; i++) stepPothole(scene, 1 / 60)
  assert.equal(scene.pieces.zero.dy, -280)
  assert.ok(scene.pieces.firstFour.dy > -280)
})
