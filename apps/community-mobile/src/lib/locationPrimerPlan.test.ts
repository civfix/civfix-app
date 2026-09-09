import assert from "node:assert/strict"
import { test } from "node:test"
import {
  initialCenterPlan,
  locationPrimerDecision,
  settleAfterPrimerPlan,
  type InitialCenterInput,
  type LocationPrimerInput,
} from "./locationPrimerPlan.ts"

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

const centerBase: InitialCenterInput = {
  permission: "undetermined",
  permissionResolved: true,
  primerShown: false,
}

test("the initial center waits until the stored permission has settled", () => {
  for (const permission of ["undetermined", "granted", "denied"] as const) {
    for (const primerShown of [false, true]) {
      assert.equal(
        initialCenterPlan({ ...centerBase, permission, primerShown, permissionResolved: false }),
        "wait",
      )
    }
  }
})

test("a granted permission centers on the real fix, whatever the primer remembers", () => {
  assert.equal(initialCenterPlan({ ...centerBase, permission: "granted" }), "gps")
  assert.equal(
    initialCenterPlan({ ...centerBase, permission: "granted", primerShown: true }),
    "gps",
  )
})

test("a denied permission centers on the prompt-free point instead", () => {
  assert.equal(initialCenterPlan({ ...centerBase, permission: "denied" }), "ip")
  assert.equal(
    initialCenterPlan({ ...centerBase, permission: "denied", primerShown: true }),
    "ip",
  )
})

test("an unanswered primer owns the undetermined case; an answered one falls back to IP", () => {
  assert.equal(initialCenterPlan(centerBase), "wait")
  assert.equal(initialCenterPlan({ ...centerBase, primerShown: true }), "ip")
})

test("the initial center never reads the primer's presentation gating", () => {
  const gating = {
    gateActive: true,
    authStatus: "loading" as const,
    onboardingDone: false,
    tourPresenting: true,
    profileIncomplete: true,
    routeFocused: false,
  }
  for (const permission of ["undetermined", "granted", "denied"] as const) {
    for (const primerShown of [false, true]) {
      const input = { ...centerBase, permission, primerShown }
      const withGating = { ...input, ...gating }
      assert.equal(initialCenterPlan(input), initialCenterPlan(withGating))
    }
  }
})

test("once the primer is answered no permission state can strand the camera waiting", () => {
  for (const permission of ["undetermined", "granted", "denied"] as const) {
    assert.notEqual(initialCenterPlan({ ...centerBase, permission, primerShown: true }), "wait")
  }
})

test("answering the primer with Later still centers the map - a default frame is not a center", () => {
  assert.equal(settleAfterPrimerPlan({ landed: false }), "center")
})

test("a center that already landed is never overridden by the deferred settle", () => {
  assert.equal(settleAfterPrimerPlan({ landed: true }), "publish-only")
})

test("the deferred settle reads only the landing flag, never the primer answer", () => {
  for (const landed of [false, true]) {
    const once = settleAfterPrimerPlan({ landed })
    assert.equal(settleAfterPrimerPlan({ landed }), once)
    assert.equal(once, landed ? "publish-only" : "center")
  }
})

test("a recalled viewport is a landing, so Not now leaves that camera where it is", () => {
  const recalledViewport = true
  assert.equal(settleAfterPrimerPlan({ landed: recalledViewport }), "publish-only")
})

test("a fresh install that answers the primer before any center lands ends up on the IP fix", () => {
  const permission = "undetermined" as const
  assert.equal(initialCenterPlan({ permission, permissionResolved: true, primerShown: false }), "wait")
  assert.equal(settleAfterPrimerPlan({ landed: false }), "center")
  assert.equal(initialCenterPlan({ permission, permissionResolved: true, primerShown: true }), "ip")
})
