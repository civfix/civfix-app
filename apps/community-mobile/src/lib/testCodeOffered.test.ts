import assert from "node:assert/strict"
import { test } from "node:test"
import { installModuleStubs } from "../../tests/helpers/moduleHooks.ts"

installModuleStubs({})

const { testCodeOffered } = await import("./developerScreen.ts")

const STAGING = "https://api.civfix.dev"
const PRODUCTION = "https://api.civfix.org"

test("T1: a staging build offers the test code to a civfix.org address", () => {
  assert.equal(testCodeOffered("test1@civfix.org", STAGING, false), true)
})

test("T2: a development build offers it, whatever its API", () => {
  assert.equal(testCodeOffered("test1@civfix.org", "http://localhost:8080", true), true)
  assert.equal(testCodeOffered("test1@civfix.org", PRODUCTION, true), true)
})

test("T3: a production build does not", () => {
  assert.equal(testCodeOffered("test1@civfix.org", PRODUCTION, false), false)
})

test("T4: a look-alike API host outside development does not", () => {
  for (const apiUrl of [
    "https://api.civfix.dev.example.com",
    "http://api.civfix.dev",
    "https://api.civfix.dev/",
    "http://localhost:8080",
  ]) {
    assert.equal(testCodeOffered("test1@civfix.org", apiUrl, false), false, apiUrl)
  }
})

test("T5: the reviewer address never gets it", () => {
  for (const email of ["reviewer@civfix.org", " Reviewer@CIVFIX.org "]) {
    assert.equal(testCodeOffered(email, STAGING, false), false, `${email} on staging`)
    assert.equal(testCodeOffered(email, PRODUCTION, true), false, `${email} in development`)
  }
})

test("T6: an address outside civfix.org does not get it", () => {
  for (const email of [
    "someone@gmail.com",
    "x@civfix.org.example.com",
    "x@sub.civfix.org",
    "x@civfix.dev",
    "civfix.org",
    "",
  ]) {
    assert.equal(testCodeOffered(email, STAGING, false), false, email)
  }
})

test("T7: the address is trimmed and lowercased first", () => {
  assert.equal(testCodeOffered("  Test1@CivFix.ORG  ", STAGING, false), true)
})
