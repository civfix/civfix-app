import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  SESSION_REVOKE_TIMEOUT_MS,
  revokeServerSession,
  type SessionRevokeDeps,
} from "./sessionRevoke.ts"

function revokeProbe(overrides: Partial<SessionRevokeDeps> = {}) {
  const sent: string[] = []
  const deps: SessionRevokeDeps = {
    readBearer: async () => "live-bearer",
    revoke: async (bearer) => {
      sent.push(bearer)
    },
    ...overrides,
  }
  return { deps, sent }
}

test("an explicit sign-out tells the server to drop the session, with the bearer it still holds", async () => {
  const { deps, sent } = revokeProbe()

  assert.equal(await revokeServerSession(deps), true)
  assert.deepEqual(sent, ["live-bearer"])
})

test("a REJECTED logout never escapes sign-out, it only reports that the session outlived it", async () => {
  let attempts = 0
  const { deps } = revokeProbe({
    revoke: async () => {
      attempts += 1
      throw new Error("503 service unavailable")
    },
  })

  assert.equal(await revokeServerSession(deps), false)
  assert.equal(attempts, 1)
})

test("a logout that THROWS synchronously is caught the same way", async () => {
  const { deps } = revokeProbe({
    revoke: () => {
      throw new Error("no network stack")
    },
  })

  assert.equal(await revokeServerSession(deps), false)
})

test("an unreachable server cannot hold sign-out open: the call is bounded and aborted", async (t) => {
  assert.ok(SESSION_REVOKE_TIMEOUT_MS > 0 && SESSION_REVOKE_TIMEOUT_MS <= 5000)

  t.mock.timers.enable({ apis: ["setTimeout"] })
  let aborted = false
  const { deps } = revokeProbe({
    revoke: (_bearer, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          aborted = true
          reject(new Error("aborted"))
        })
      }),
  })

  const revoking = revokeServerSession(deps)
  await Promise.resolve()
  assert.equal(aborted, false, "the call was abandoned before its bound elapsed")

  t.mock.timers.tick(SESSION_REVOKE_TIMEOUT_MS)
  assert.equal(await revoking, false)
  assert.equal(aborted, true)
})

test("a THROWING or EMPTY keychain read sends nothing and still lets sign-out finish", async () => {
  const thrower = revokeProbe({
    readBearer: () => {
      throw new Error("keychain gone")
    },
  })
  assert.equal(await revokeServerSession(thrower.deps), false)
  assert.deepEqual(thrower.sent, [])

  const empty = revokeProbe({ readBearer: async () => null })
  assert.equal(await revokeServerSession(empty.deps), false)
  assert.deepEqual(empty.sent, [])
})

test("the store revokes on the EXPLICIT sign-out only, ahead of the local teardown", () => {
  const source = readFileSync(new URL("../store/authStore.ts", import.meta.url), "utf8")
  const signOut = source.slice(source.indexOf("  signOut: async () => {"))
  const body = signOut.slice(0, signOut.indexOf("\n  },"))
  const revoked = body.indexOf("await revokeServerSession(sessionRevokeDeps())")
  const tornDown = body.indexOf("await tearDownIdentity(set)")
  const cleared = body.indexOf("await clearToken()")
  assert.ok(revoked > -1, "sign-out never revokes the server session")
  assert.ok(tornDown > revoked, "the local teardown runs before the revoke")
  assert.ok(cleared > revoked, "the bearer is cleared before the revoke can use it")
  assert.match(body, /api\.logout|sessionRevokeDeps/)

  const lapsed = source.slice(source.indexOf("  markUnauthed: () => {"))
  assert.doesNotMatch(lapsed.slice(0, lapsed.indexOf("\n  },")), /revokeServerSession/)
  assert.equal(source.match(/revokeServerSession\(/g)?.length, 1)
})
