import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import {
  BOOT_DEADLINE_MS,
  BOOT_NOTICE_MS,
  bootGateState,
  type BootGateInput,
} from "../src/boot/bootGateModel.ts"
import {
  RequestDeadlineError,
  SESSION_RESTORE_DEADLINE_MS,
  isRequestDeadlineError,
  withRequestDeadline,
} from "../src/api/deadline.ts"

const layout = readFileSync(new URL("../app/_layout.tsx", import.meta.url), "utf8")
const store = readFileSync(new URL("../src/store/authStore.ts", import.meta.url), "utf8")
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

test("a request that never answers is aborted and reported as a deadline miss", async () => {
  let aborted = false
  const err = await withRequestDeadline(
    10,
    (signal) =>
      new Promise<never>((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          aborted = true
          reject(new Error("Aborted"))
        })
      }),
  ).catch((e: unknown) => e)

  assert.ok(aborted)
  assert.ok(err instanceof RequestDeadlineError)
  assert.ok(isRequestDeadlineError(err))
})

test("a request that answers in time keeps its own value and its own failures", async () => {
  assert.equal(await withRequestDeadline(1000, async () => "session"), "session")

  const original = new Error("network request failed")
  const err = await withRequestDeadline(1000, async () => {
    throw original
  }).catch((e: unknown) => e)
  assert.equal(err, original)
})

test("the session restore deadline is shorter than the boot gate's own deadline", () => {
  assert.ok(SESSION_RESTORE_DEADLINE_MS <= BOOT_DEADLINE_MS)
})

test("the session restore is bounded by that deadline, never a bare api.session()", () => {
  assert.match(
    store,
    /withRequestDeadline\(SESSION_RESTORE_DEADLINE_MS, \(signal\) => api\.session\(\{ signal \}\)\)/,
  )
  assert.doesNotMatch(store, /await api\.session\(\)/)
  assert.doesNotMatch(store, /api\n?\s*\.session\(\)/)
})

test("a session restore that cannot reach the server records how it failed", () => {
  assert.match(store, /networkOutcome: reachabilityOutcome\(err\)/)
  assert.match(store, /if \(isRequestDeadlineError\(err\)\) return "timeout"/)
})

test("the loading gate is bounded by the boot model, never by an open-ended auth status", () => {
  const body = layout.slice(layout.indexOf("const gateActive ="), layout.indexOf("const setGateActive"))
  assert.match(body, /boot\.phase === "connecting"/)
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
