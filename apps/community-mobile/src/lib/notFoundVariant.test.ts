import assert from "node:assert/strict"
import { test } from "node:test"
import { NOT_FOUND_VARIANTS, pickNotFoundVariant } from "./notFoundVariant.ts"

test("a pick draws from the injected random once", () => {
  let calls = 0
  const variant = pickNotFoundVariant(() => {
    calls += 1
    return 0.5
  })
  assert.equal(variant, "pothole")
  assert.equal(calls, 1)
})

test("[0, 1) splits into three equal bands", () => {
  assert.equal(pickNotFoundVariant(() => 0), "tiles")
  assert.equal(pickNotFoundVariant(() => 1 / 3 - 1e-9), "tiles")
  assert.equal(pickNotFoundVariant(() => 1 / 3), "pothole")
  assert.equal(pickNotFoundVariant(() => 2 / 3 - 1e-9), "pothole")
  assert.equal(pickNotFoundVariant(() => 2 / 3), "sign")
  assert.equal(pickNotFoundVariant(() => 1 - Number.EPSILON), "sign")
})

test("the pick is uniform over the three variants", () => {
  const draws = 3000
  const counts = new Map<string, number>()
  for (let i = 0; i < draws; i++) {
    const variant = pickNotFoundVariant(() => (i + 0.5) / draws)
    counts.set(variant, (counts.get(variant) ?? 0) + 1)
  }
  assert.deepEqual(
    Object.fromEntries(counts),
    Object.fromEntries(NOT_FOUND_VARIANTS.map((v) => [v, draws / NOT_FOUND_VARIANTS.length])),
  )
})

test("without an injected random the pick uses Math.random", (t) => {
  t.mock.method(Math, "random", () => 0.9)
  assert.equal(pickNotFoundVariant(), "sign")
})
