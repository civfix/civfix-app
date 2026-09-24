import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import {
  ONBOARDING_LAST_INDEX,
  ONBOARDING_PAGES,
  ONBOARDING_PAGE_COUNT,
  clampPageIndex,
  demoChatAt,
  demoEventAt,
  onboardingBackPlan,
  onboardingEnterPlan,
  pageIndexForOffset,
  railSegmentState,
  shouldShowOnboarding,
  skipVisible,
  type OnboardingEligibility,
} from "./onboardingPlan.ts"

const ELIGIBLE: OnboardingEligibility = {
  completedVersion: 0,
  currentVersion: 1,
  replayRequested: false,
  gateActive: false,
  authStatus: "unauthed",
  profileIncomplete: false,
}

test("the page list matches the declared page count", () => {
  assert.equal(ONBOARDING_PAGES.length, ONBOARDING_PAGE_COUNT)
  assert.deepEqual([...ONBOARDING_PAGES], ["report", "track", "together", "theme", "ready"])
  assert.equal(ONBOARDING_LAST_INDEX, 4)
})

test("a cold first launch past the splash shows the tour", () => {
  assert.equal(shouldShowOnboarding(ELIGIBLE), true)
  assert.equal(shouldShowOnboarding({ ...ELIGIBLE, authStatus: "authed" }), true)
})

test("a warm launch never shows the tour again", () => {
  assert.equal(shouldShowOnboarding({ ...ELIGIBLE, completedVersion: 1 }), false)
  assert.equal(shouldShowOnboarding({ ...ELIGIBLE, completedVersion: 2 }), false)
})

test("a newer tour version shows again to someone who saw the older one", () => {
  assert.equal(shouldShowOnboarding({ ...ELIGIBLE, completedVersion: 1, currentVersion: 2 }), true)
})

test("the tour waits for the fonts and for the loading gate to clear", () => {
  const launchGate = readFileSync(new URL("../boot/useLaunchGate.ts", import.meta.url), "utf8")
  assert.match(launchGate, /const gateActive =\n\s+!fontsReady \|\|/, "unloaded fonts hold the loading gate up")
  assert.equal(shouldShowOnboarding({ ...ELIGIBLE, gateActive: true }), false)
})

test("an unsettled session never flashes the tour", () => {
  assert.equal(shouldShowOnboarding({ ...ELIGIBLE, authStatus: "idle" }), false)
  assert.equal(shouldShowOnboarding({ ...ELIGIBLE, authStatus: "loading" }), false)
})

test("registration wins over the tour, so the two are never on screen together", () => {
  assert.equal(
    shouldShowOnboarding({ ...ELIGIBLE, authStatus: "authed", profileIncomplete: true }),
    false,
  )
})

test("a replay from settings shows the tour again without unwriting the completion flag", () => {
  assert.equal(shouldShowOnboarding({ ...ELIGIBLE, completedVersion: 1, replayRequested: true }), true)
  assert.equal(shouldShowOnboarding({ ...ELIGIBLE, completedVersion: 9, replayRequested: true }), true)
})

test("a replay request still waits for the fonts, the gate, the session and registration", () => {
  const replaying = { ...ELIGIBLE, completedVersion: 1, replayRequested: true }
  assert.equal(shouldShowOnboarding({ ...replaying, gateActive: true }), false)
  assert.equal(shouldShowOnboarding({ ...replaying, authStatus: "idle" }), false)
  assert.equal(shouldShowOnboarding({ ...replaying, authStatus: "loading" }), false)
  assert.equal(
    shouldShowOnboarding({ ...replaying, authStatus: "authed", profileIncomplete: true }),
    false,
  )
})

test("a completed replay leaves a warm launch warm - the request is not persisted", () => {
  assert.equal(shouldShowOnboarding({ ...ELIGIBLE, completedVersion: 1, replayRequested: false }), false)
})

test("the settled page index is the clamped rounded offset", () => {
  assert.equal(pageIndexForOffset(0, 400), 0)
  assert.equal(pageIndexForOffset(180, 400), 0)
  assert.equal(pageIndexForOffset(220, 400), 1)
  assert.equal(pageIndexForOffset(1200, 400), 3)
  assert.equal(pageIndexForOffset(1600, 400), 4)
})

test("an overscrolled or unmeasured pager never reports a page off the ends", () => {
  assert.equal(pageIndexForOffset(-90, 400), 0)
  assert.equal(pageIndexForOffset(9000, 400), ONBOARDING_LAST_INDEX)
  assert.equal(pageIndexForOffset(400, 0), 0)
  assert.equal(pageIndexForOffset(Number.NaN, 400), 0)
})

test("clamping keeps every index inside the five pages", () => {
  assert.equal(clampPageIndex(-3), 0)
  assert.equal(clampPageIndex(2.4), 2)
  assert.equal(clampPageIndex(99), ONBOARDING_LAST_INDEX)
})

test("the rail reads done behind the current page, active on it, todo ahead", () => {
  assert.equal(railSegmentState(0, 2), "done")
  assert.equal(railSegmentState(1, 2), "done")
  assert.equal(railSegmentState(2, 2), "active")
  assert.equal(railSegmentState(3, 2), "todo")
  assert.equal(railSegmentState(4, 2), "todo")
})

test("android back walks the pages, then stops swallowing nothing on the first", () => {
  assert.deepEqual(onboardingBackPlan(0), { type: "swallow" })
  assert.deepEqual(onboardingBackPlan(1), { type: "previous", to: 0 })
  assert.deepEqual(onboardingBackPlan(ONBOARDING_LAST_INDEX), { type: "previous", to: 3 })
  assert.deepEqual(onboardingBackPlan(-1), { type: "swallow" })
  assert.deepEqual(onboardingBackPlan(99), { type: "previous", to: 3 })
})

test("skip is offered on every page except the last, where there is nothing to skip", () => {
  assert.equal(skipVisible(0), true)
  assert.equal(skipVisible(1), true)
  assert.equal(skipVisible(2), true)
  assert.equal(skipVisible(3), true)
  assert.equal(skipVisible(ONBOARDING_LAST_INDEX), false)
  assert.equal(skipVisible(99), false)
  assert.equal(skipVisible(-1), true)
})

test("the tour appears instantly when it takes the screen from the loading gate", () => {
  assert.equal(onboardingEnterPlan({ loadingGateMounted: true, reduceMotion: false }), "instant")
  assert.equal(onboardingEnterPlan({ loadingGateMounted: true, reduceMotion: true }), "instant")
})

test("a replay from settings runs the enter fade - no loading gate to hand off from", () => {
  assert.equal(onboardingEnterPlan({ loadingGateMounted: false, reduceMotion: false }), "fade")
})

test("a reduced-motion viewer never gets the enter animation", () => {
  assert.equal(onboardingEnterPlan({ loadingGateMounted: false, reduceMotion: true }), "instant")
})

test("the decision reads nothing but the two inputs, so it cannot go sticky", () => {
  for (const loadingGateMounted of [false, true]) {
    for (const reduceMotion of [false, true]) {
      const once = onboardingEnterPlan({ loadingGateMounted, reduceMotion })
      assert.equal(onboardingEnterPlan({ loadingGateMounted, reduceMotion }), once)
    }
  }
})

test("the tour's demo event is always the coming Saturday at 09:00 local, never in the past", () => {
  const days = [0, 1, 2, 3, 4, 5, 6]
  for (const offset of days) {
    for (const hour of [0, 8, 9, 10, 23]) {
      const now = new Date(2026, 8, 20 + offset, hour, 30)
      const at = new Date(demoEventAt(now))
      assert.equal(at.getDay(), 6, now.toString())
      assert.equal(at.getHours(), 9, now.toString())
      assert.equal(at.getMinutes(), 0, now.toString())
      assert.ok(at.getTime() > now.getTime(), now.toString())
      assert.ok(at.getTime() - now.getTime() <= 7 * 24 * 60 * 60_000, now.toString())
    }
  }
  assert.ok(new Date(demoEventAt(new Date(2026, 8, 23, 12))).getTime() > Date.parse("2026-09-12T16:00:00.000Z"))
})

test("the demo chat was sent moments ago, oldest first", () => {
  const now = new Date(2026, 8, 23, 18, 44)
  const [ask, reply] = demoChatAt(now)
  assert.ok(Date.parse(ask) < Date.parse(reply))
  assert.ok(Date.parse(reply) < now.getTime())
  assert.ok(now.getTime() - Date.parse(ask) <= 10 * 60_000)
})
