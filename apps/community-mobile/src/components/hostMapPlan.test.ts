import assert from "node:assert/strict"
import { test } from "node:test"
import { mobileHostMapPlan } from "./hostMapPlan.ts"

test("the host offers the map for EVERY compact view so the shared shell can retain it", () => {
  for (const view of ["home", "map", "report", "search", "messaging", "social"] as const) {
    assert.equal(mobileHostMapPlan("compact", view).renderMap, true, view)
  }
})

test("compact map CONTROLS stay on the bare map tab", () => {
  assert.deepEqual(mobileHostMapPlan("compact", "home"), {
    renderMap: true,
    renderMapControls: false,
  })
  assert.deepEqual(mobileHostMapPlan("compact", "map"), {
    renderMap: true,
    renderMapControls: true,
  })
  assert.deepEqual(mobileHostMapPlan("compact", "report"), {
    renderMap: true,
    renderMapControls: false,
  })
  assert.deepEqual(mobileHostMapPlan("compact", "search"), {
    renderMap: true,
    renderMapControls: false,
  })
})

test("expanded host map plan mounts the map for every view (it is the tablet backdrop)", () => {
  assert.deepEqual(mobileHostMapPlan("expanded", "home"), {
    renderMap: true,
    renderMapControls: true,
  })
  assert.deepEqual(mobileHostMapPlan("expanded", "report"), {
    renderMap: true,
    renderMapControls: true,
  })
})
