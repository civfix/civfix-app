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

test("T13: the store app reads a denial the OS can still ask about as undetermined, and never prompts to read it", async () => {
  const d = deps(STORE_APP_ID, [
    { status: "granted" },
    { status: "denied", canAskAgain: true },
    { status: "denied", canAskAgain: false },
    { status: "denied" },
    { status: "undetermined" },
  ])
  const cap = makeNativePushPermission(d)
  assert.equal(await cap.status(), "granted")
  assert.equal(await cap.status(), "undetermined")
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

// Turn on's ask, timed by a scripted clock: now() returns `times` in order around requestPermissionsAsync.
function turnOnDeps(answer: PermissionResponse | Error, times: number[]) {
  const calls: string[] = []
  return {
    calls,
    appId: STORE_APP_ID,
    getPermissionsAsync: mock.fn(async (): Promise<PermissionResponse> => {
      throw new Error("Turn on does not read the permission")
    }),
    requestPermissionsAsync: mock.fn(async (): Promise<PermissionResponse> => {
      calls.push("request")
      if (answer instanceof Error) throw answer
      return answer
    }),
    openSettings: mock.fn(async (): Promise<void> => {
      calls.push("openSettings")
    }),
    onGranted: mock.fn((): void => {}),
    now: mock.fn((): number => {
      const next = times.shift()
      assert.ok(next !== undefined, "now() called more often than the test scripted")
      return next
    }),
  }
}

test("T16: openSettings() asks first, and opens civfix's system settings page when no dialog showed", async () => {
  const d = turnOnDeps({ status: "denied", canAskAgain: false }, [1000, 1050])
  const cap = makeNativePushPermission(d)
  assert.ok(cap.openSettings)
  assert.equal(await cap.openSettings(), undefined)
  assert.equal(d.requestPermissionsAsync.mock.callCount(), 1)
  assert.equal(d.openSettings.mock.callCount(), 1)
  assert.deepEqual(d.calls, ["request", "openSettings"])
  assert.equal(d.onGranted.mock.callCount(), 0)
})

test("G1: openSettings() leaves settings closed when the dialog showed and was dismissed", async () => {
  const d = turnOnDeps({ status: "denied", canAskAgain: false }, [1000, 4000])
  await makeNativePushPermission(d).openSettings?.()
  assert.equal(d.openSettings.mock.callCount(), 0)
  assert.equal(d.onGranted.mock.callCount(), 0)
})

test("G2: openSettings() leaves settings closed after an explicit Don't allow in the dialog", async () => {
  const d = turnOnDeps({ status: "denied", canAskAgain: true }, [1000, 4000])
  await makeNativePushPermission(d).openSettings?.()
  assert.equal(d.openSettings.mock.callCount(), 0)
})

test("G3: openSettings() runs onGranted once on a grant from the dialog, and opens no settings", async () => {
  const d = turnOnDeps({ status: "granted" }, [1000, 4000])
  await makeNativePushPermission(d).openSettings?.()
  assert.equal(d.onGranted.mock.callCount(), 1)
  assert.equal(d.openSettings.mock.callCount(), 0)
})

test("G4: a denial 999 ms after the ask means no dialog showed, so settings open", async () => {
  const d = turnOnDeps({ status: "denied", canAskAgain: false }, [1000, 1999])
  await makeNativePushPermission(d).openSettings?.()
  assert.equal(d.openSettings.mock.callCount(), 1)
})

test("G5: a denial exactly 1000 ms after the ask counts as a dialog, so settings stay closed", async () => {
  const d = turnOnDeps({ status: "denied", canAskAgain: false }, [1000, 2000])
  await makeNativePushPermission(d).openSettings?.()
  assert.equal(d.openSettings.mock.callCount(), 0)
})

test("G6: openSettings() opens settings when the ask itself fails, and does not throw", async () => {
  const d = turnOnDeps(new Error("permission request failed"), [1000, 1050])
  await assert.doesNotReject(async () => {
    await makeNativePushPermission(d).openSettings?.()
  })
  assert.equal(d.openSettings.mock.callCount(), 1)
})

test("F1: request() reads a denial the OS can still ask about as undetermined, and runs onGranted on the grant only", async () => {
  const d = {
    ...deps(
      STORE_APP_ID,
      [],
      [
        { status: "denied", canAskAgain: true },
        { status: "denied", canAskAgain: false },
        { status: "granted" },
      ],
    ),
    onGranted: mock.fn((): void => {}),
  }
  const cap = makeNativePushPermission(d)
  assert.equal(await cap.request(), "undetermined")
  assert.equal(d.onGranted.mock.callCount(), 0)
  assert.equal(await cap.request(), "denied")
  assert.equal(d.onGranted.mock.callCount(), 0)
  assert.equal(await cap.request(), "granted")
  assert.equal(d.onGranted.mock.callCount(), 1)
})
