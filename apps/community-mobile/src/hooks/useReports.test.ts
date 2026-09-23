import { beforeEach, test } from "node:test"
import assert from "node:assert/strict"
import { installModuleStubs } from "../../tests/helpers/moduleHooks.ts"

const STUBS = new URL("../../tests/helpers/nativeStubs.ts", import.meta.url)
installModuleStubs({ "@/api/client": STUBS })

const { calls, control, resetStubs } = await import("../../tests/helpers/nativeStubs.ts")
const { reverseLabel } = await import("./useReports.ts")

beforeEach(() => {
  resetStubs()
})

test("the reverse-geocoded label is trimmed and the rest of the response kept", async () => {
  control.endpoint = async () => ({ cityStateLabel: "  Los Angeles, CA \n", jurisdictionId: "j1" })
  assert.deepEqual(await reverseLabel(34.05, -118.25), {
    cityStateLabel: "Los Angeles, CA",
    jurisdictionId: "j1",
  })
  assert.deepEqual(calls, ['api.reverseLabel:{"lat":34.05,"lng":-118.25}'])
})

test("an unplaceable point yields an empty label", async () => {
  for (const cityStateLabel of ["", "   ", undefined, null]) {
    control.endpoint = async () => ({ cityStateLabel })
    assert.equal((await reverseLabel(0, 0)).cityStateLabel, "", String(cityStateLabel))
  }
})
