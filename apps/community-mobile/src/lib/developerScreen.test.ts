import assert from "node:assert/strict"
import { test } from "node:test"
import { installModuleStubs } from "../../tests/helpers/moduleHooks.ts"

installModuleStubs({})

const { developerScreenEnabled } = await import("./developerScreen.ts")

test("T1: a staging build shows the Developer screen", () => {
  assert.equal(developerScreenEnabled("https://api.civfix.dev", false), true)
})

test("T2: a production build does not", () => {
  assert.equal(developerScreenEnabled("https://api.civfix.org", false), false)
})

test("T3: a development build does, whatever its API", () => {
  assert.equal(developerScreenEnabled("https://api.civfix.org", true), true)
})

test("T4: only the exact staging API URL counts outside development", () => {
  for (const apiUrl of [
    "http://localhost:8080",
    "http://api.civfix.dev",
    "https://api.civfix.dev.example.com",
    "https://api.civfix.dev/",
  ]) {
    assert.equal(developerScreenEnabled(apiUrl, false), false, apiUrl)
  }
})
