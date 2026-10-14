import { beforeEach, test } from "node:test"
import assert from "node:assert/strict"
import { installModuleStubs } from "../../tests/helpers/moduleHooks.ts"

const STUBS = new URL("../../tests/helpers/nativeStubs.ts", import.meta.url)
installModuleStubs({
  "@civfix/ui": STUBS,
  "@civfix/ui/data": STUBS,
  "@/api/client": STUBS,
  "@/auth/storage": STUBS,
  "@/lib/mmkv": STUBS,
  "@/lib/nativeSecureStore": STUBS,
  "@/lib/ws": STUBS,
  "@/query/client": STUBS,
  "@/query/mmkvPersister": STUBS,
})

const { calls, control, resetStubs } = await import("../../tests/helpers/nativeStubs.ts")
const { useAuthStore } = await import("../store/authStore.ts")
const { retrySessionRestore } = await import("./useBootGate.ts")

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setImmediate(resolve))
}

beforeEach(() => {
  resetStubs()
})

test("the boot gate's retry re-runs one boot hydration however often it is tapped", async () => {
  control.token = { ok: true, token: "tok" }
  control.session = async () => ({ authenticated: true, user: { id: "u-1" }, guestSmsEnabled: false })
  retrySessionRestore()
  retrySessionRestore()
  await settle()
  assert.deepEqual(calls, ["readToken", "api.session"])
  assert.equal(useAuthStore.getState().status, "authed")
  assert.equal(useAuthStore.getState().networkOutcome, "ok")
})
