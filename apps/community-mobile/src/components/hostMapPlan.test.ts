import assert from "node:assert/strict"
import { test } from "node:test"
import { mobileHostMapPlan } from "./hostMapPlan.ts"

test("compact map CONTROLS stay on the bare map tab", () => {
  assert.deepEqual(mobileHostMapPlan("compact", "home"), { renderMapControls: false })
  assert.deepEqual(mobileHostMapPlan("compact", "map"), { renderMapControls: true })
  assert.deepEqual(mobileHostMapPlan("compact", "report"), { renderMapControls: false })
  assert.deepEqual(mobileHostMapPlan("compact", "search"), { renderMapControls: false })
})

test("expanded host map plan shows the controls for every view (the map is the tablet backdrop)", () => {
  assert.deepEqual(mobileHostMapPlan("expanded", "home"), { renderMapControls: true })
  assert.deepEqual(mobileHostMapPlan("expanded", "report"), { renderMapControls: true })
})
