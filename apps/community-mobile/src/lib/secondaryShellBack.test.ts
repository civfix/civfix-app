import assert from "node:assert/strict"
import { test } from "node:test"
import { secondaryShellBackAction } from "./secondaryShellBack.ts"

test("hardware back pops the store stack while a parent page remains beneath the top one", () => {
  assert.equal(secondaryShellBackAction(2, true), "pop-detail")
  assert.equal(secondaryShellBackAction(3, true), "pop-detail")
  assert.equal(secondaryShellBackAction(7, false), "pop-detail")
})

test("at the seeded root of a poppable route the NATIVE stack owns the pop - one press dismisses entry and route together", () => {
  assert.equal(secondaryShellBackAction(1, true), "system")
})

test("at the seeded root of a COLD deep link (route not poppable) the press pops the detail so the leave() fallback can go home instead of exiting the app", () => {
  assert.equal(secondaryShellBackAction(1, false), "pop-detail")
})

test("an empty store stack has nothing to pop, so the press falls through to the route", () => {
  assert.equal(secondaryShellBackAction(0, true), "system")
  assert.equal(secondaryShellBackAction(0, false), "system")
})
