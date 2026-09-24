import { beforeEach, test } from "node:test"
import assert from "node:assert/strict"
import { installModuleStubs } from "../../tests/helpers/moduleHooks.ts"

const STUBS = new URL("../../tests/helpers/nativeStubs.ts", import.meta.url)
installModuleStubs({
  "@/api/client": STUBS,
  "@/auth/storage": STUBS,
  "@/lib/mmkv": STUBS,
  "@/lib/nativeSecureStore": STUBS,
  "@/lib/ws": STUBS,
  "@/query/client": STUBS,
  "@/query/mmkv-persister": STUBS,
})

const { calls, control, resetStubs } = await import("../../tests/helpers/nativeStubs.ts")
const { useAuthStore } = await import("../store/authStore.ts")
const { requestEmailOtp, signInWithApple, signInWithGoogle, verifyEmailOtp } = await import("./useAuthFlow.ts")

const USER = { id: "u-1", name: "Ada" }

beforeEach(() => {
  resetStubs()
  useAuthStore.setState({ status: "unauthed", user: null, sessionPresent: false })
})

test("each sign-in exchange stores the returned bearer and signs the user in", async () => {
  const flows: [string, () => Promise<void>][] = [
    ["appleSignIn", () => signInWithApple({ identityToken: "apple-id" } as never)],
    ["googleSignIn", () => signInWithGoogle({ idToken: "google-id" } as never)],
    ["otpVerify", () => verifyEmailOtp({ email: "a@b.c", code: "123456" } as never)],
  ]
  for (const [name, run] of flows) {
    resetStubs()
    useAuthStore.setState({ status: "unauthed", user: null })
    control.endpoint = async () => ({ token: `bearer-${name}`, user: USER })
    await run()
    assert.equal(calls[0]?.startsWith(`api.${name}:`), true, name)
    assert.equal(calls.at(-1), `setToken:bearer-${name}`)
    assert.equal(useAuthStore.getState().status, "authed")
    assert.deepEqual(useAuthStore.getState().user, USER)
  }
})

test("an exchange that returns no bearer fails with an internal error and stores nothing", async () => {
  for (const token of [undefined, null, ""]) {
    resetStubs()
    control.endpoint = async () => ({ token, user: USER })
    await assert.rejects(verifyEmailOtp({ email: "a@b.c", code: "123456" } as never), {
      name: "AppError",
      code: "INTERNAL",
      message: "Sign-in did not return a token. Please try again.",
    })
    assert.equal(calls.some((call) => call.startsWith("setToken")), false)
    assert.equal(useAuthStore.getState().status, "unauthed")
  }
})

test("an exchange that fails upstream propagates the error untouched", async () => {
  const failure = new TypeError("offline")
  control.endpoint = async () => {
    throw failure
  }
  await assert.rejects(signInWithApple({ identityToken: "apple-id" } as never), failure)
  assert.equal(useAuthStore.getState().status, "unauthed")
})

test("requesting a code returns the server's resend cooldown", async () => {
  control.endpoint = async () => ({ resendAfterSec: 45 })
  assert.equal(await requestEmailOtp({ email: "a@b.c" } as never), 45)
  assert.deepEqual(calls, ['api.otpRequest:{"email":"a@b.c"}'])
})
