import assert from "node:assert/strict"
import { test } from "node:test"
import type { Href } from "expo-router"
import { HOME_HREF, goHome, navTeardownEpoch, shimNavPlan } from "./goHome.ts"

test("goHome dismisses TO the home route and never replaces onto it", () => {
  const calls: Href[] = []
  goHome({ dismissTo: (href) => calls.push(href) })
  assert.deepEqual(calls, [HOME_HREF])
})

test("goHome marks a nav teardown, the signal the refocused root reads to drop a shell-hosted seed", () => {
  const before = navTeardownEpoch()
  goHome({ dismissTo: () => undefined })
  assert.equal(navTeardownEpoch(), before + 1)
})

test("a shim with no explicit target goes home", () => {
  assert.deepEqual(shimNavPlan(undefined), { type: "home" })
})

test("a shim whose target IS home goes home, so it cannot duplicate the index route", () => {
  assert.deepEqual(shimNavPlan("/"), { type: "home" })
})

test("a shim with a real target still replaces itself with it", () => {
  const href: Href = { pathname: "/messages/[id]", params: { id: "r1", roomKind: "report" } }
  assert.deepEqual(shimNavPlan(href), { type: "replace", href })
  assert.deepEqual(shimNavPlan("/people/u1"), { type: "replace", href: "/people/u1" })
})
