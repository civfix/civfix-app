import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import {
  BOOT_DEADLINE_MS,
  BOOT_GATE_THRESHOLDS_MS,
  BOOT_NOTICE_MS,
  BOOT_PHASE_THRESHOLDS_MS,
  bootGateState,
  reachedThreshold,
  type BootGateInput,
} from "../src/boot/bootGateModel.ts"
import {
  RequestDeadlineError,
  SESSION_RESTORE_DEADLINE_MS,
  isRequestDeadlineError,
  sharedDeadlineRequest,
} from "../src/api/deadline.ts"

const layout = readFileSync(new URL("../app/_layout.tsx", import.meta.url), "utf8")
const store = readFileSync(new URL("../src/store/authStore.ts", import.meta.url), "utf8")
const sessionCheckSource = readFileSync(new URL("../src/api/sessionCheck.ts", import.meta.url), "utf8")
const authFlow = readFileSync(new URL("../src/hooks/useAuthFlow.ts", import.meta.url), "utf8")
const splash = readFileSync(
  new URL("../src/components/LoadingSplash.tsx", import.meta.url),
  "utf8",
)

function gate(over: Partial<BootGateInput>) {
  return bootGateState({
    sessionPresent: true,
    cachedUser: false,
    networkOutcome: "pending",
    elapsedMs: 0,
    ...over,
  })
}

test("a restore still in flight holds the gate, silently at first", () => {
  assert.deepEqual(gate({ elapsedMs: 0 }), {
    phase: "connecting",
    showNotice: false,
    showRetry: false,
  })
})

test("the notice appears once the restore has been waiting, the retry only at the deadline", () => {
  assert.deepEqual(gate({ elapsedMs: BOOT_NOTICE_MS }), {
    phase: "connecting",
    showNotice: true,
    showRetry: false,
  })
  assert.deepEqual(gate({ elapsedMs: BOOT_DEADLINE_MS }), {
    phase: "connecting",
    showNotice: true,
    showRetry: true,
  })
})

test("an unread token keeps the gate up, but never past the deadline", () => {
  assert.equal(gate({ sessionPresent: null, elapsedMs: 0 }).phase, "connecting")
  assert.deepEqual(gate({ sessionPresent: null, elapsedMs: BOOT_DEADLINE_MS }), {
    phase: "signin",
    showNotice: true,
    showRetry: true,
  })
})

test("a cached user enters the app immediately instead of waiting on the network", () => {
  assert.deepEqual(gate({ cachedUser: true, elapsedMs: BOOT_DEADLINE_MS * 4 }), {
    phase: "ready",
    showNotice: false,
    showRetry: false,
  })
})

test("an unreachable server with a cached user enters the app in a degraded state", () => {
  for (const outcome of ["timeout", "error"] as const) {
    assert.deepEqual(gate({ cachedUser: true, networkOutcome: outcome }), {
      phase: "ready",
      showNotice: true,
      showRetry: true,
    })
  }
})

test("an unreachable server with a token and no cache lands on the offline screen", () => {
  for (const outcome of ["timeout", "error"] as const) {
    assert.deepEqual(gate({ networkOutcome: outcome }), {
      phase: "offline",
      showNotice: true,
      showRetry: true,
    })
  }
})

test("an unreachable server with no token settles on sign-in, carrying the notice", () => {
  assert.deepEqual(gate({ sessionPresent: false, networkOutcome: "error" }), {
    phase: "signin",
    showNotice: true,
    showRetry: true,
  })
})

test("no token and nothing in flight goes straight to sign-in, never the gate", () => {
  assert.deepEqual(gate({ sessionPresent: false, elapsedMs: BOOT_DEADLINE_MS * 4 }), {
    phase: "signin",
    showNotice: false,
    showRetry: false,
  })
})

test("a reachable server settles both ways with no notice", () => {
  assert.deepEqual(gate({ networkOutcome: "ok" }), {
    phase: "ready",
    showNotice: false,
    showRetry: false,
  })
  assert.deepEqual(gate({ sessionPresent: false, networkOutcome: "ok" }), {
    phase: "signin",
    showNotice: false,
    showRetry: false,
  })
})

test("the gate never returns a phase outside the four it declares", () => {
  const phases = new Set<string>()
  for (const sessionPresent of [true, false, null]) {
    for (const cachedUser of [true, false]) {
      for (const networkOutcome of ["pending", "ok", "timeout", "error"] as const) {
        for (const elapsedMs of [0, BOOT_NOTICE_MS, BOOT_DEADLINE_MS, 60_000]) {
          phases.add(gate({ sessionPresent, cachedUser, networkOutcome, elapsedMs }).phase)
        }
      }
    }
  }
  assert.deepEqual([...phases].sort(), ["connecting", "offline", "ready", "signin"])
})

test("an elapsed time reads as the largest threshold it has reached", () => {
  assert.equal(reachedThreshold(0, BOOT_GATE_THRESHOLDS_MS), 0)
  assert.equal(reachedThreshold(BOOT_NOTICE_MS - 1, BOOT_GATE_THRESHOLDS_MS), 0)
  assert.equal(reachedThreshold(BOOT_NOTICE_MS, BOOT_GATE_THRESHOLDS_MS), BOOT_NOTICE_MS)
  assert.equal(reachedThreshold(BOOT_DEADLINE_MS + 5, BOOT_GATE_THRESHOLDS_MS), BOOT_DEADLINE_MS)
  assert.equal(reachedThreshold(BOOT_NOTICE_MS, BOOT_PHASE_THRESHOLDS_MS), 0)
})

test("the gate reads the same at any elapsed time as at the threshold it has reached", () => {
  const elapsed = [0, 1, BOOT_NOTICE_MS - 1, BOOT_NOTICE_MS, BOOT_NOTICE_MS + 1, BOOT_DEADLINE_MS - 1]
  elapsed.push(BOOT_DEADLINE_MS, BOOT_DEADLINE_MS + 1, 60_000)
  for (let ms = 0; ms <= 2 * BOOT_DEADLINE_MS; ms += 250) elapsed.push(ms)
  for (const sessionPresent of [true, false, null]) {
    for (const cachedUser of [true, false]) {
      for (const networkOutcome of ["pending", "ok", "timeout", "error"] as const) {
        for (const elapsedMs of elapsed) {
          const input = { sessionPresent, cachedUser, networkOutcome }
          assert.deepEqual(
            gate({ ...input, elapsedMs: reachedThreshold(elapsedMs, BOOT_GATE_THRESHOLDS_MS) }),
            gate({ ...input, elapsedMs }),
          )
          assert.equal(
            gate({ ...input, elapsedMs: reachedThreshold(elapsedMs, BOOT_PHASE_THRESHOLDS_MS) }).phase,
            gate({ ...input, elapsedMs }).phase,
          )
        }
      }
    }
  }
})

test("a request that never answers is aborted and reported as a deadline miss", async () => {
  let aborted = false
  const err = await sharedDeadlineRequest(
    (signal) =>
      new Promise<never>((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          aborted = true
          reject(new Error("Aborted"))
        })
      }),
  )(10).catch((e: unknown) => e)

  assert.ok(aborted)
  assert.ok(err instanceof RequestDeadlineError)
  assert.ok(isRequestDeadlineError(err))
})

test("a request that answers in time keeps its own value and its own failures", async () => {
  assert.equal(await sharedDeadlineRequest(async () => "session")(1000), "session")

  const original = new Error("network request failed")
  const err = await sharedDeadlineRequest(async () => {
    throw original
  })(1000).catch((e: unknown) => e)
  assert.equal(err, original)
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

test("callers that overlap share one request and each receive its answer", async () => {
  const answer = deferred<string>()
  let sent = 0
  const check = sharedDeadlineRequest(() => {
    sent += 1
    return answer.promise
  })
  const restore = check(1000)
  const providers = check(500)
  answer.resolve("session")
  assert.deepEqual(await Promise.all([restore, providers]), ["session", "session"])
  assert.equal(sent, 1)
})

test("a settled request is never reused: the next caller sends its own", async () => {
  let sent = 0
  const check = sharedDeadlineRequest(async () => {
    sent += 1
    return sent
  })
  assert.equal(await check(1000), 1)
  assert.equal(await check(1000), 2)
})

test("each caller keeps its own deadline, and the request outlives the shorter one", async () => {
  const answer = deferred<string>()
  let signal: AbortSignal | null = null
  const check = sharedDeadlineRequest((s) => {
    signal = s
    return answer.promise
  })
  const long = check(200)
  const short = check(10)
  const err = await short.catch((e: unknown) => e)
  assert.ok(err instanceof RequestDeadlineError)
  assert.equal((err as RequestDeadlineError).deadlineMs, 10)
  assert.equal((signal as AbortSignal | null)?.aborted, false)
  answer.resolve("session")
  assert.equal(await long, "session")
})

test("the request is aborted at the latest deadline, and every caller sees a deadline miss", async () => {
  let aborted = false
  const check = sharedDeadlineRequest(
    (signal) =>
      new Promise<never>((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          aborted = true
          reject(new Error("Aborted"))
        })
      }),
  )
  const errors = await Promise.all([check(10), check(20)].map((p) => p.catch((e: unknown) => e)))
  assert.ok(aborted)
  assert.deepEqual(
    errors.map((e) => (e instanceof RequestDeadlineError ? e.deadlineMs : e)),
    [10, 20],
  )
})

test("a failure reaches every caller unchanged", async () => {
  const original = new Error("network request failed")
  const answer = deferred<string>()
  const check = sharedDeadlineRequest(() => answer.promise)
  const both = [check(1000), check(1000)].map((p) => p.catch((e: unknown) => e))
  answer.reject(original)
  assert.deepEqual(await Promise.all(both), [original, original])
})

test("the sign-in provider list reads the shared session check, with its own deadline", () => {
  assert.match(authFlow, /await sessionCheck\(AUTH_PROVIDERS_DEADLINE_MS\)/)
  assert.doesNotMatch(authFlow, /api\.session\(/)
})

test("the session restore deadline is shorter than the boot gate's own deadline", () => {
  assert.ok(SESSION_RESTORE_DEADLINE_MS <= BOOT_DEADLINE_MS)
})

test("the session restore is bounded by that deadline, never a bare api.session()", () => {
  assert.match(store, /return sessionCheck\(SESSION_RESTORE_DEADLINE_MS\)/)
  assert.match(sessionCheckSource, /sharedDeadlineRequest\(\(signal\) => api\.session\(\{ signal \}\), tokenGeneration\)/)
  assert.doesNotMatch(store, /api\.session\(/)
  assert.doesNotMatch(store, /await api\.session\(\)/)
  assert.doesNotMatch(store, /api\n?\s*\.session\(\)/)
})

test("a session restore that cannot reach the server records how it failed", () => {
  assert.match(store, /networkOutcome: reachabilityOutcome\(err\)/)
  assert.match(store, /if \(isRequestDeadlineError\(err\)\) return "timeout"/)
})

test("the loading gate is bounded by the boot model, never by an open-ended auth status", () => {
  const launchGate = readFileSync(new URL("../src/boot/useLaunchGate.ts", import.meta.url), "utf8")
  const body = launchGate.slice(launchGate.indexOf("const gateActive ="), launchGate.indexOf("const setGateActive"))
  assert.ok(body.length > 0)
  assert.match(body, /\bphase === "connecting"/)
  assert.match(launchGate, /const phase = useBootPhase\(\)/)
  assert.doesNotMatch(body, /status === "loading"/)
  assert.doesNotMatch(body, /status === "idle"/)
})

test("the offline gate is what the user sees when the server cannot be reached at boot", () => {
  assert.match(layout, /boot\.phase === "offline" \? <BootOfflineGate \/> : <AuthGate mode="loading" \/>/)
})

test("the splash offers the connecting line and the retry the model asks for", () => {
  assert.match(splash, /t\("boot\.still_connecting"\)/)
  assert.match(splash, /showRetry \? \(/)
  assert.match(splash, /onPress=\{retrySessionRestore\}/)
  assert.match(splash, /if \(reduceMotion\) \{\n\s+appear\.value = 1/)
})

test("a shared request is only joined by callers under the same key: a token write starts a fresh one", async () => {
  let key = 1
  let runs = 0
  const gates: Array<(value: string) => void> = []
  const check = sharedDeadlineRequest(
    () =>
      new Promise<string>((resolve) => {
        runs += 1
        gates.push(resolve)
      }),
    () => key,
  )

  const first = check(1000)
  const joined = check(1000)
  assert.equal(runs, 1)

  key = 2
  const fresh = check(1000)
  assert.equal(runs, 2)

  gates[0]("signed-out answer")
  gates[1]("signed-in answer")
  assert.equal(await first, "signed-out answer")
  assert.equal(await joined, "signed-out answer")
  assert.equal(await fresh, "signed-in answer")
})

test("once a caller's deadline has passed, the next caller sends a fresh request instead of joining", async () => {
  let runs = 0
  const check = sharedDeadlineRequest(
    () =>
      new Promise<string>(() => {
        runs += 1
      }),
  )
  const first = check(10).catch((e: unknown) => e)
  assert.ok((await first) instanceof RequestDeadlineError)
  assert.equal(runs, 1)
  void check(1000).catch(() => undefined)
  assert.equal(runs, 2)
})
