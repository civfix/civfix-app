import assert from "node:assert/strict"
import { test } from "node:test"
import { locationPrimerDecision, type LocationPrimerInput } from "./locationPrimerPlan.ts"

const base: LocationPrimerInput = {
  permission: "undetermined",
  permissionResolved: true,
  primerShown: false,
  gateActive: false,
  authStatus: "unauthed",
  onboardingDone: true,
  tourPresenting: false,
  profileIncomplete: false,
  routeFocused: true,
}

test("waits until the stored permission has settled, whatever else is true", () => {
  for (const permission of ["undetermined", "granted", "denied"] as const) {
    assert.equal(
      locationPrimerDecision({ ...base, permission, permissionResolved: false }),
      "wait",
    )
  }
})

test("granted resolves the full ladder without waiting for the tour", () => {
  assert.equal(locationPrimerDecision({ ...base, permission: "granted" }), "resolve")
  assert.equal(
    locationPrimerDecision({ ...base, permission: "granted", onboardingDone: false }),
    "resolve",
  )
  assert.equal(
    locationPrimerDecision({ ...base, permission: "granted", primerShown: true }),
    "resolve",
  )
})

test("denied never touches GPS again - IP only, tour or no tour", () => {
  assert.equal(locationPrimerDecision({ ...base, permission: "denied" }), "ip-only")
  assert.equal(
    locationPrimerDecision({ ...base, permission: "denied", onboardingDone: false }),
    "ip-only",
  )
})

test("undetermined primes exactly once, and only after the tour is done", () => {
  assert.equal(locationPrimerDecision(base), "prompt")
  assert.equal(locationPrimerDecision({ ...base, onboardingDone: false }), "wait")
  assert.equal(locationPrimerDecision({ ...base, primerShown: true }), "ip-only")
  assert.equal(
    locationPrimerDecision({ ...base, primerShown: true, onboardingDone: false }),
    "wait",
  )
})

test("no input combination asks for GPS while the permission is undetermined", () => {
  for (const permissionResolved of [false, true]) {
    for (const primerShown of [false, true]) {
      for (const onboardingDone of [false, true]) {
        for (const tourPresenting of [false, true]) {
          for (const profileIncomplete of [false, true]) {
            for (const routeFocused of [false, true]) {
              assert.notEqual(
                locationPrimerDecision({
                  ...base,
                  permission: "undetermined",
                  permissionResolved,
                  primerShown,
                  onboardingDone,
                  tourPresenting,
                  profileIncomplete,
                  routeFocused,
                }),
                "resolve",
              )
            }
          }
        }
      }
    }
  }
})

test("the tour overlay outlasts its completion flag, so the primer waits for the exit too", () => {
  assert.equal(locationPrimerDecision({ ...base, tourPresenting: true }), "wait")
  assert.equal(
    locationPrimerDecision({ ...base, tourPresenting: true, primerShown: true }),
    "wait",
  )
})

test("the boot gate outranks every settled permission, so nothing runs behind the splash", () => {
  for (const permission of ["undetermined", "granted", "denied"] as const) {
    assert.equal(locationPrimerDecision({ ...base, permission, gateActive: true }), "wait")
  }
})

test("an unsettled session waits, exactly as the tour does", () => {
  for (const authStatus of ["idle", "loading"] as const) {
    for (const permission of ["undetermined", "granted", "denied"] as const) {
      assert.equal(locationPrimerDecision({ ...base, permission, authStatus }), "wait")
    }
  }
  assert.equal(locationPrimerDecision({ ...base, authStatus: "authed" }), "prompt")
  assert.equal(locationPrimerDecision({ ...base, authStatus: "unauthed" }), "prompt")
})

test("registration owns the screen before the primer does", () => {
  assert.equal(locationPrimerDecision({ ...base, profileIncomplete: true }), "wait")
})

test("the primer never fires behind another route, such as the OTP card", () => {
  assert.equal(locationPrimerDecision({ ...base, routeFocused: false }), "wait")
})

test("the primer prompts once the tour, registration and the route have all settled", () => {
  assert.equal(locationPrimerDecision(base), "prompt")
  for (const blocked of [
    { tourPresenting: true },
    { profileIncomplete: true },
    { routeFocused: false },
    { onboardingDone: false },
    { gateActive: true },
    { authStatus: "loading" as const },
  ]) {
    assert.equal(locationPrimerDecision({ ...base, ...blocked }), "wait")
  }
})

test("a settled permission keeps its answer whatever is on screen", () => {
  const blocked = { tourPresenting: true, profileIncomplete: true, routeFocused: false }
  assert.equal(locationPrimerDecision({ ...base, ...blocked, permission: "granted" }), "resolve")
  assert.equal(locationPrimerDecision({ ...base, ...blocked, permission: "denied" }), "ip-only")
})
