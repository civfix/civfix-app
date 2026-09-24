import { test } from "node:test"
import assert from "node:assert/strict"
import type { TokenRead } from "@/auth/storage"
import { carriedBearerToken, makeSessionTeardown, makeSingleFlight } from "./unauthorized.ts"

const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

test("the bearer VALUE is recovered whatever shape the headers arrived in", () => {
  assert.equal(carriedBearerToken({ Authorization: "Bearer abc.def" }), "abc.def")
  assert.equal(carriedBearerToken({ authorization: "bearer abc.def" }), "abc.def")
  assert.equal(carriedBearerToken(new Headers({ Authorization: "Bearer abc.def" })), "abc.def")
  assert.equal(carriedBearerToken([["authorization", "Bearer abc.def"]]), "abc.def")
})

test("an ANONYMOUS request is never mistaken for an expired session", () => {
  assert.equal(carriedBearerToken(undefined), null)
  assert.equal(carriedBearerToken({}), null)
  assert.equal(carriedBearerToken({ "X-Client": "mobile", accept: "application/json" }), null)
  assert.equal(carriedBearerToken(new Headers({ "X-Client": "mobile" })), null)
  assert.equal(carriedBearerToken([["x-client", "mobile"]]), null)
})

test("a malformed or empty Authorization value yields no bearer", () => {
  assert.equal(carriedBearerToken({ Authorization: "" }), null)
  assert.equal(carriedBearerToken({ Authorization: "Bearer" }), null)
  assert.equal(carriedBearerToken({ Authorization: "Bearer " }), null)
  assert.equal(carriedBearerToken({ Authorization: "Basic abc" }), null)
  assert.equal(carriedBearerToken({ Authorization: "Bearer abc def" }), null)
})

function teardownProbe(initial: TokenRead) {
  const state = { stored: initial, cleared: 0, tornDown: 0, errors: [] as unknown[] }
  const signal = makeSingleFlight(
    (bearer: string) => bearer,
    makeSessionTeardown({
      readToken: async () => state.stored,
      clearToken: async () => {
        state.cleared += 1
        state.stored = { ok: true, token: null }
      },
      onTornDown: () => {
        state.tornDown += 1
      },
    }),
    (err) => state.errors.push(err),
  )
  return { signal, state }
}

test("a STALE in-flight 401 from the PREVIOUS session leaves the fresh one alone", async () => {
  const { signal, state } = teardownProbe({ ok: true, token: "fresh-session-token" })

  signal("token-from-the-session-the-user-just-replaced")
  await tick()

  assert.equal(state.cleared, 0)
  assert.equal(state.tornDown, 0)
  assert.deepEqual(state.stored, { ok: true, token: "fresh-session-token" })
})

test("a 401 carrying the CURRENT bearer tears the session down exactly once", async () => {
  const { signal, state } = teardownProbe({ ok: true, token: "current" })

  signal("current")
  signal("current")
  await tick()
  assert.equal(state.cleared, 1)
  assert.equal(state.tornDown, 1)

  signal("current")
  await tick()
  assert.equal(state.cleared, 1)
  assert.equal(state.tornDown, 1)
  assert.deepEqual(state.errors, [])
})

test("a STALE 401 in flight cannot BLOCK the 401 that carries the current bearer", async () => {
  const { signal, state } = teardownProbe({ ok: true, token: "current" })

  signal("stale")
  signal("current")
  await tick()

  assert.equal(state.cleared, 1)
  assert.equal(state.tornDown, 1)
})

test("an UNREADABLE keychain during the compare never tears the session down", async () => {
  const { signal, state } = teardownProbe({ ok: false })

  signal("current")
  await tick()

  assert.equal(state.cleared, 0)
  assert.equal(state.tornDown, 0)
})

test("a burst of concurrent 401s runs the sign-out cascade exactly ONCE", async () => {
  let runs = 0
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const trigger = makeSingleFlight(
    (bearer: string) => bearer,
    async () => {
      runs++
      await gate
    },
    (err: unknown) => assert.fail(err as string | Error),
  )

  trigger("same")
  trigger("same")
  trigger("same")
  await tick()
  trigger("same")
  assert.equal(runs, 1)

  release()
  await tick()
  assert.equal(runs, 1)
})

test("the latch releases, so a genuinely later 401 signs out again", async () => {
  let runs = 0
  const trigger = makeSingleFlight(
    (bearer: string) => bearer,
    async () => {
      runs++
    },
    (err: unknown) => assert.fail(err as string | Error),
  )

  trigger("same")
  await tick()
  assert.equal(runs, 1)

  trigger("same")
  await tick()
  assert.equal(runs, 2)
})

test("two DIFFERENT keys never block each other, even in the same tick", async () => {
  const started: string[] = []
  const trigger = makeSingleFlight(
    (bearer: string) => bearer,
    async (bearer: string) => {
      started.push(bearer)
      await tick()
    },
    (err: unknown) => assert.fail(err as string | Error),
  )

  trigger("stale")
  trigger("current")
  trigger("stale")
  await tick()

  assert.deepEqual(started, ["stale", "current"])
})

test("a failing sign-out is reported and still releases the latch - it never wedges", async () => {
  const seen: unknown[] = []
  let runs = 0
  const trigger = makeSingleFlight(
    (bearer: string) => bearer,
    async () => {
      runs++
      throw new Error("keychain gone")
    },
    (err) => seen.push(err),
  )

  trigger("same")
  await tick()
  assert.equal(runs, 1)
  assert.equal(seen.length, 1)

  trigger("same")
  await tick()
  assert.equal(runs, 2)
  assert.equal(seen.length, 2)
})
