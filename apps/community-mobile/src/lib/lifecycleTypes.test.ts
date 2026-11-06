import assert from "node:assert/strict"
import { test } from "node:test"
import { appLifecycleState } from "./lifecycleTypes.ts"

test("a state React Native reports passes through", () => {
  for (const state of ["active", "background", "inactive", "unknown", "extension"] as const) {
    assert.equal(appLifecycleState(state), state)
  }
})

test("no report yet, or one this app does not know, reads as unknown", () => {
  assert.equal(appLifecycleState(null), "unknown")
  assert.equal(appLifecycleState(undefined), "unknown")
  assert.equal(appLifecycleState("suspended"), "unknown")
})
