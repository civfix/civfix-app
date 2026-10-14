import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { URL } from "node:url"

const CLIENT = readFileSync(new URL("./client.ts", import.meta.url), "utf8")

test("a returning screen reads the cache instead of refetching", () => {
  assert.match(CLIENT, /staleTime: 5 \* 60_000/)
  assert.match(CLIENT, /refetchOnWindowFocus: false/)
})

test("the persisted families refetch on foreground even while fresh, which staleness alone would not trigger", () => {
  assert.match(CLIENT, /setQueryDefaults\(queryKey, \{ refetchOnWindowFocus: "always" \}\)/)
  assert.doesNotMatch(CLIENT, /setQueryDefaults\(queryKey, \{ refetchOnWindowFocus: true \}\)/)
})
