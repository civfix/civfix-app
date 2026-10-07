import { test } from "node:test"
import assert from "node:assert/strict"
import { composerParams } from "./composerParams.ts"

test("the in-app bridge's composer params are honoured unchanged", () => {
  assert.deepEqual(composerParams({ mode: "post" }), { mode: "post" })
  assert.deepEqual(composerParams({ mode: "quote", targetPostId: "p1" }), { mode: "quote", targetPostId: "p1" })
  assert.deepEqual(composerParams({ mode: "reply", targetPostId: "p1" }), { mode: "reply", targetPostId: "p1" })
  assert.deepEqual(composerParams({}), { mode: "post" })
})

test("an unknown or malformed mode falls back to a plain post with no target", () => {
  assert.deepEqual(composerParams({ mode: "edit", targetPostId: "p1" }), { mode: "post" })
  assert.deepEqual(composerParams({ mode: ["reply", "quote"], targetPostId: "p1" }), { mode: "post" })
  assert.deepEqual(composerParams({ mode: "", targetPostId: "p1" }), { mode: "post" })
})

test("a target is only honoured for a reply or quote", () => {
  assert.deepEqual(composerParams({ mode: "post", targetPostId: "p1" }), { mode: "post" })
  assert.deepEqual(composerParams({ targetPostId: "p1" }), { mode: "post" })
  assert.deepEqual(composerParams({ mode: "reply", targetPostId: ["p1", "p2"] }), { mode: "reply" })
  assert.deepEqual(composerParams({ mode: "quote", targetPostId: "" }), { mode: "quote" })
})
