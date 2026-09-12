import assert from "node:assert/strict"
import { test } from "node:test"
import { androidBackPlan } from "./androidBackPlan.ts"

test("the transient layers popover is dismissed before anything else", () => {
  assert.equal(
    androidBackPlan({ layersOpen: true, active: { kind: "pin", id: "a" }, view: "report" }),
    "close-layers",
  )
})

test("an open detail is popped, whatever view is underneath it", () => {
  assert.equal(
    androidBackPlan({ layersOpen: false, active: { kind: "pin", id: "a" }, view: "home" }),
    "pop-detail",
  )
  assert.equal(
    androidBackPlan({ layersOpen: false, active: { kind: "drop-pin" }, view: "report" }),
    "pop-detail",
  )
})

test("the report wizard leaves for the surface it was launched from instead of exiting the app", () => {
  assert.equal(androidBackPlan({ layersOpen: false, active: null, view: "report" }), "leave-report")
})

test("a bare tab root falls through to the OS default", () => {
  assert.equal(androidBackPlan({ layersOpen: false, active: null, view: "home" }), "system")
  assert.equal(androidBackPlan({ layersOpen: false, active: null, view: "map" }), "system")
  assert.equal(androidBackPlan({ layersOpen: false, active: null, view: "search" }), "system")
})
