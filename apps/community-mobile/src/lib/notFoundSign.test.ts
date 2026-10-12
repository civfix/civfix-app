import assert from "node:assert/strict"
import { test } from "node:test"
import { SIGN_SAG, hangSign, leftChain, stepSign, type SignSize } from "./notFoundSign.ts"

const SIGN: SignSize = { width: 230, height: 116, boltInset: 22, chain: 38 }

test("the sign hangs level, falls once to the sag and then stops", () => {
  const swing = hangSign()
  for (let i = 0; i < 40; i++) assert.ok(stepSign(swing, SIGN, 1 / 60))
  assert.equal(swing.angle, 0, "level until the chain gives")
  let frames = 0
  while (stepSign(swing, SIGN, 1 / 60)) {
    frames += 1
    assert.ok(swing.angle >= SIGN_SAG, "never past the sag")
    assert.ok(frames < 60 * 6, "settles within six seconds")
  }
  assert.equal(swing.angle, SIGN_SAG)
  assert.equal(swing.spin, 0)
})

test("the left chain hangs straight while the sign is level and stretches to the tilted bolt", () => {
  assert.deepEqual(leftChain(SIGN, 0), { length: SIGN.chain, angle: 0 })
  const sagged = leftChain(SIGN, SIGN_SAG)
  const reach = SIGN.width - 2 * SIGN.boltInset
  const boltX = reach - reach * Math.cos(SIGN_SAG)
  const boltY = SIGN.chain - reach * Math.sin(SIGN_SAG)
  assert.ok(Math.abs(sagged.length - Math.hypot(boltX, boltY)) < 1e-9)
  assert.ok(sagged.angle < 0, "leans toward the bolt that swung away")
})
