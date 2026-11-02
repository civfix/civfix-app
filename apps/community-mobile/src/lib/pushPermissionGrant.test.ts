import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { makeNativePushPermission, type NativePushPermissionDeps } from "./pushPermission.ts"

type PermissionResponse = Awaited<ReturnType<NativePushPermissionDeps["requestPermissionsAsync"]>>

function deps(appId: string, answer: PermissionResponse) {
  return {
    appId,
    getPermissionsAsync: mock.fn(async (): Promise<PermissionResponse> => answer),
    requestPermissionsAsync: mock.fn(async (): Promise<PermissionResponse> => answer),
    openSettings: mock.fn(async (): Promise<void> => {}),
    onGranted: mock.fn((): void => {}),
  }
}

test("T13: a grant from request() runs onGranted once; a denial or the .dev variant never does", async () => {
  const granted = deps("org.civfix.community", { status: "granted" })
  assert.equal(await makeNativePushPermission(granted).request(), "granted")
  assert.equal(granted.onGranted.mock.callCount(), 1)

  const denied = deps("org.civfix.community", { status: "denied" })
  assert.equal(await makeNativePushPermission(denied).request(), "denied")
  assert.equal(denied.onGranted.mock.callCount(), 0)

  const dev = deps("org.civfix.community.dev", { status: "granted" })
  assert.equal(await makeNativePushPermission(dev).request(), "unsupported")
  assert.equal(dev.requestPermissionsAsync.mock.callCount(), 0)
  assert.equal(dev.onGranted.mock.callCount(), 0)
})
