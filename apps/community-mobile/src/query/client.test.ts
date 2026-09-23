import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const CLIENT = readFileSync(new URL("./client.ts", import.meta.url), "utf8")

test("a returning screen reads the cache instead of refetching", () => {
  assert.match(CLIENT, /staleTime: 5 \* 60_000/)
  assert.match(CLIENT, /refetchOnWindowFocus: false/)
})

test("the persisted families still catch up on foreground, which staleness alone no longer triggers", () => {
  assert.match(CLIENT, /setQueryDefaults\(queryKey, \{ refetchOnWindowFocus: "always" \}\)/)
  assert.doesNotMatch(CLIENT, /setQueryDefaults\(queryKey, \{ refetchOnWindowFocus: true \}\)/)
})
