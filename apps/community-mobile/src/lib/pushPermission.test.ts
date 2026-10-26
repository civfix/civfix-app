import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { makeNativePushPermission, type NativePushPermissionDeps } from "./pushPermission.ts"

type PermissionResponse = Awaited<ReturnType<NativePushPermissionDeps["getPermissionsAsync"]>>

const STORE_APP_ID = "org.civfix.community"
const DEV_APP_ID = "org.civfix.community.dev"

function deps(appId: string, reads: PermissionResponse[] = [], asks: PermissionResponse[] = []) {
  return {
    appId,
    getPermissionsAsync: mock.fn(async (): Promise<PermissionResponse> => {
      const next = reads.shift()
      assert.ok(next, "getPermissionsAsync called more often than the test scripted")
      return next
    }),
    requestPermissionsAsync: mock.fn(async (): Promise<PermissionResponse> => {
      const next = asks.shift()
      assert.ok(next, "requestPermissionsAsync called more often than the test scripted")
      return next
    }),
    openSettings: mock.fn(async (): Promise<void> => {}),
  }
}

test("T13: the store app maps the OS status, whatever canAskAgain says, and never prompts to read it", async () => {
  const d = deps(STORE_APP_ID, [
    { status: "granted" },
    { status: "denied", canAskAgain: true },
    { status: "denied", canAskAgain: false },
    { status: "undetermined" },
  ])
  const cap = makeNativePushPermission(d)
  assert.equal(await cap.status(), "granted")
  assert.equal(await cap.status(), "denied")
  assert.equal(await cap.status(), "denied")
  assert.equal(await cap.status(), "undetermined")
  assert.equal(d.requestPermissionsAsync.mock.callCount(), 0)
})

test("T14: request() asks the OS each time and resolves its answer", async () => {
  const d = deps(STORE_APP_ID, [], [{ status: "granted" }, { status: "denied" }])
  const cap = makeNativePushPermission(d)
  assert.equal(await cap.request(), "granted")
  assert.equal(await cap.request(), "denied")
  assert.equal(d.requestPermissionsAsync.mock.callCount(), 2)
})

test("T15: the .dev variant reports unsupported without asking the OS", async () => {
  const d = deps(DEV_APP_ID)
  const cap = makeNativePushPermission(d)
  assert.equal(await cap.status(), "unsupported")
  assert.equal(await cap.request(), "unsupported")
  assert.equal(d.getPermissionsAsync.mock.callCount(), 0)
  assert.equal(d.requestPermissionsAsync.mock.callCount(), 0)
})

test("T16: openSettings() opens civfix's system settings page once", async () => {
  const d = deps(STORE_APP_ID)
  const cap = makeNativePushPermission(d)
  assert.ok(cap.openSettings)
  assert.equal(await cap.openSettings(), undefined)
  assert.equal(d.openSettings.mock.callCount(), 1)
})
