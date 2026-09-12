import assert from "node:assert/strict"
import { test } from "node:test"
import { conversationExitPlan } from "./conversationExit.ts"

test("a COLD deep link has no previous screen, so Back seeds the inbox it belongs under", () => {
  assert.deepEqual(conversationExitPlan({ canGoBack: true, rootShellSeen: false }), {
    type: "back",
    seedView: "messaging",
  })
})

test("a WARM conversation returns to whatever screen was actually up", () => {
  assert.deepEqual(conversationExitPlan({ canGoBack: true, rootShellSeen: true }), {
    type: "back",
    seedView: null,
  })
})

test("with no route to pop at all the exit is home, still anchored on the inbox", () => {
  assert.deepEqual(conversationExitPlan({ canGoBack: false, rootShellSeen: false }), {
    type: "home",
    seedView: "messaging",
  })
  assert.deepEqual(conversationExitPlan({ canGoBack: false, rootShellSeen: true }), {
    type: "home",
    seedView: "messaging",
  })
})
