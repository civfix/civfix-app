import { test } from "node:test"
import assert from "node:assert/strict"
import { memoryKeyValueStore } from "./memoryKeyValueStore.ts"

test("the in-memory store sets, reads, deletes and clears like MMKV", () => {
  const store = memoryKeyValueStore()
  assert.equal(store.getString("a"), undefined)
  store.set("a", "1")
  store.set("b", "2")
  assert.equal(store.getString("a"), "1")
  store.delete("a")
  assert.equal(store.getString("a"), undefined)
  assert.equal(store.getString("b"), "2")
  store.clearAll()
  assert.equal(store.getString("b"), undefined)
})
