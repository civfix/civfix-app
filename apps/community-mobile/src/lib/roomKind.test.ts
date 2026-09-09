import { test } from "node:test"
import assert from "node:assert/strict"
import { parseRoomKind } from "./roomKind.ts"

test("keeps a valid report room kind", () => {
  assert.equal(parseRoomKind("report"), "report")
})

test("keeps a valid dm room kind", () => {
  assert.equal(parseRoomKind("dm"), "dm")
})

test("keeps a valid cleanup room kind", () => {
  assert.equal(parseRoomKind("cleanup"), "cleanup")
})

test("falls back to cleanup for an undefined param", () => {
  assert.equal(parseRoomKind(undefined), "cleanup")
})

test("falls back to cleanup for a garbage param", () => {
  assert.equal(parseRoomKind("nonsense"), "cleanup")
})

test("unwraps a duplicated array param to the first value", () => {
  assert.equal(parseRoomKind(["report", "report"]), "report")
})

test("falls back to cleanup for an empty array param", () => {
  assert.equal(parseRoomKind([]), "cleanup")
})
