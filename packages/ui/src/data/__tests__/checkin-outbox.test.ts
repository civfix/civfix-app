import { describe, expect, it } from "vitest"
import {
  CHECKIN_OUTBOX_MAX,
  CHECKIN_OUTBOX_TTL_MS,
  EMPTY_CHECKIN_OUTBOX,
  CHECKIN_OUTBOX_KEY,
  checkinEntryId,
  checkinOutboxKey,
  dequeueReady,
  enqueue,
  loadOutbox,
  markFailed,
  markSent,
  parseOutbox,
  pending,
  pruneExpired,
  replayOutcome,
  replayReportNotable,
  replaySubject,
  runReplay,
  saveOutbox,
  serializeOutbox,
  summarizeReplay,
  type CheckinOutboxEntry,
  type CheckinOutboxState,
  type ReplayAttempt,
} from "../checkinOutbox"

const T0 = Date.UTC(2026, 8, 6, 12, 0, 0)

const USER_A = "user-a"
const USER_B = "user-b"

function makeStore() {
  const blobs = new Map<string, string>()
  return {
    get: async (key: string) => blobs.get(key) ?? null,
    set: async (key: string, value: string) => {
      blobs.set(key, value)
    },
    del: async (key: string) => {
      blobs.delete(key)
    },
    keys: () => [...blobs.keys()],
    seed: (key: string, value: string) => blobs.set(key, value),
  }
}

const scan = (token: string) => ({ cleanupId: "e1", method: "scan" as const, token })
const manual = (seatId: string) => ({ cleanupId: "e1", method: "manual" as const, seatId })

describe("enqueue", () => {
  it("appends an entry that is ready to send immediately", () => {
    const state = enqueue(EMPTY_CHECKIN_OUTBOX, scan("tok-1"), T0)
    expect(state.entries).toHaveLength(1)
    expect(state.entries[0]).toMatchObject({ cleanupId: "e1", method: "scan", token: "tok-1", attempts: 0 })
    expect(dequeueReady(state, T0)).toHaveLength(1)
  })

  it("DEDUPES on the same seat: double-scanning one ticket queues one send, not two", () => {
    const once = enqueue(EMPTY_CHECKIN_OUTBOX, scan("tok-1"), T0)
    const twice = enqueue(once, scan("tok-1"), T0 + 500)
    expect(twice.entries).toHaveLength(1)
    expect(twice).toBe(once)
  })

  it("keeps a scan and a manual check-in of the same subject apart", () => {
    expect(checkinEntryId(scan("x"))).not.toBe(checkinEntryId(manual("x")))
  })

  it("refuses an entry with no subject at all rather than queueing a send that cannot succeed", () => {
    const state = enqueue(EMPTY_CHECKIN_OUTBOX, { cleanupId: "e1", method: "scan" }, T0)
    expect(state.entries).toHaveLength(0)
  })

  it("is BOUNDED: the oldest entries drop once the cap is reached", () => {
    let state: CheckinOutboxState = EMPTY_CHECKIN_OUTBOX
    for (let i = 0; i < CHECKIN_OUTBOX_MAX + 5; i++) {
      state = enqueue(state, scan(`tok-${i}`), T0 + i)
    }
    expect(state.entries).toHaveLength(CHECKIN_OUTBOX_MAX)
    expect(state.entries[0]?.token).toBe("tok-5")
  })
})

describe("retry + expiry", () => {
  it("backs a failed entry off, so a dead network is not hammered", () => {
    const queued = enqueue(EMPTY_CHECKIN_OUTBOX, scan("tok-1"), T0)
    const failed = markFailed(queued, queued.entries[0]!.id, T0, { retryable: true })
    expect(failed.entries[0]?.attempts).toBe(1)
    expect(dequeueReady(failed, T0)).toHaveLength(0)
    expect(dequeueReady(failed, T0 + 60_000)).toHaveLength(1)
  })

  it("DROPS an entry the server refused permanently instead of blocking the queue behind it", () => {
    const queued = enqueue(EMPTY_CHECKIN_OUTBOX, scan("tok-1"), T0)
    const dropped = markFailed(queued, queued.entries[0]!.id, T0, { retryable: false })
    expect(dropped.entries).toHaveLength(0)
  })

  it("removes a sent entry", () => {
    const queued = enqueue(EMPTY_CHECKIN_OUTBOX, scan("tok-1"), T0)
    expect(markSent(queued, queued.entries[0]!.id).entries).toHaveLength(0)
  })

  it("drops anything older than 48h - a stale check-in must never land on a later event day", () => {
    const queued = enqueue(EMPTY_CHECKIN_OUTBOX, scan("tok-1"), T0)
    const later = T0 + CHECKIN_OUTBOX_TTL_MS + 1
    expect(pruneExpired(queued, later).entries).toHaveLength(0)
    expect(dequeueReady(queued, later)).toHaveLength(0)
    expect(pending(queued, later)).toBe(0)
  })
})

describe("event scoping", () => {
  const other = (token: string) => ({ cleanupId: "e2", method: "scan" as const, token })

  function withStaleBacklog(): CheckinOutboxState {
    let state: CheckinOutboxState = EMPTY_CHECKIN_OUTBOX
    for (let i = 0; i < 40; i++) state = enqueue(state, other(`old-${i}`), T0)
    return enqueue(state, scan("mine-1"), T0 + 1)
  }

  it("returns THIS event's entry even when another event's backlog exceeds the batch budget", () => {
    const ready = dequeueReady(withStaleBacklog(), T0 + 10, { cleanupId: "e1" })
    expect(ready.map((e) => e.token)).toEqual(["mine-1"])
  })

  it("would starve without the scope - the exact regression this guards", () => {
    const unscoped = dequeueReady(withStaleBacklog(), T0 + 10, { limit: 25 })
    expect(unscoped.every((e) => e.cleanupId === "e2")).toBe(true)
    expect(unscoped.some((e) => e.token === "mine-1")).toBe(false)
  })

  it("counts only THIS event's pending sends, so the badge matches the queue it can drain", () => {
    const state = withStaleBacklog()
    expect(pending(state, T0 + 10, "e1")).toBe(1)
    expect(pending(state, T0 + 10, "e2")).toBe(40)
    expect(pending(state, T0 + 10)).toBe(41)
  })

  it("still honours the budget and the due time inside a scope", () => {
    let state: CheckinOutboxState = EMPTY_CHECKIN_OUTBOX
    for (let i = 0; i < 5; i++) state = enqueue(state, scan(`t-${i}`), T0)
    expect(dequeueReady(state, T0, { cleanupId: "e1", limit: 2 })).toHaveLength(2)
    const backedOff = markFailed(state, state.entries[0]!.id, T0, { retryable: true })
    expect(dequeueReady(backedOff, T0, { cleanupId: "e1" }).map((e) => e.token)).not.toContain("t-0")
  })
})

describe("replayOutcome", () => {
  it("treats a CONFLICT as SUCCESS - check-in is idempotent per seat", () => {
    expect(replayOutcome("CONFLICT")).toEqual({ disposition: "sent", dropReason: null })
  })

  it("treats no error as success", () => {
    expect(replayOutcome(undefined)).toEqual({ disposition: "sent", dropReason: null })
  })

  it("retries only the transient codes", () => {
    expect(replayOutcome("RATE_LIMITED").disposition).toBe("retry")
    expect(replayOutcome("INTERNAL").disposition).toBe("retry")
  })

  it("HOLDS an expired session instead of dropping the door's queued check-ins", () => {
    expect(replayOutcome("UNAUTHORIZED")).toEqual({ disposition: "hold", dropReason: null })
  })

  it("drops a revoked capability, but as its OWN reason so it can be reported", () => {
    expect(replayOutcome("FORBIDDEN")).toEqual({ disposition: "drop", dropReason: "forbidden" })
  })

  it("drops a refusal of the entry itself, separately from a revoked capability", () => {
    expect(replayOutcome("NOT_FOUND")).toEqual({ disposition: "drop", dropReason: "refused" })
    expect(replayOutcome("VALIDATION")).toEqual({ disposition: "drop", dropReason: "refused" })
    expect(replayOutcome("SOMETHING_NEW").disposition).toBe("drop")
  })
})

describe("summarizeReplay", () => {
  it("counts checked_in and already as SENT - both mean the seat is in", () => {
    const report = summarizeReplay([
      { kind: "settled", outcome: "checked_in" },
      { kind: "settled", outcome: "already" },
      { kind: "conflict" },
    ])
    expect(report.sent).toBe(3)
    expect(report.refusals).toEqual([])
    expect(replayReportNotable(report)).toBe(false)
  })

  it("groups every non-checked_in DTO outcome as a reported refusal", () => {
    const report = summarizeReplay([
      { kind: "settled", outcome: "cancelled" },
      { kind: "settled", outcome: "cancelled" },
      { kind: "settled", outcome: "wrong_event" },
      { kind: "settled", outcome: "waitlisted" },
      { kind: "settled", outcome: "no_show" },
      { kind: "settled", outcome: "unknown_token" },
    ])
    expect(report.sent).toBe(0)
    expect(report.refusals).toEqual([
      { outcome: "cancelled", count: 2 },
      { outcome: "wrong_event", count: 1 },
      { outcome: "waitlisted", count: 1 },
      { outcome: "no_show", count: 1 },
      { outcome: "unknown_token", count: 1 },
    ])
    expect(replayReportNotable(report)).toBe(true)
  })

  it("keeps held, forbidden and discarded in separate buckets", () => {
    const report = summarizeReplay([
      { kind: "held" },
      { kind: "forbidden" },
      { kind: "forbidden" },
      { kind: "discarded" },
      { kind: "retry" },
    ])
    expect(report).toMatchObject({ held: 1, forbidden: 2, discarded: 1, retry: 1, sent: 0 })
    expect(replayReportNotable(report)).toBe(true)
  })

  it("raises no card for a batch that only needs another try - the pending pill already says so", () => {
    const report = summarizeReplay([{ kind: "retry" }, { kind: "retry" }])
    expect(replayReportNotable(report)).toBe(false)
  })
})

describe("replaySubject", () => {
  const entry = (over: Partial<CheckinOutboxEntry>): CheckinOutboxEntry => ({
    id: "e1:token:x",
    cleanupId: "e1",
    method: "scan",
    token: "tok-1",
    seatId: null,
    queuedAt: T0,
    attempts: 0,
    nextAttemptAt: T0,
    ...over,
  })

  it("sends a scan by token and a manual entry by seat", () => {
    expect(replaySubject(entry({}))).toEqual({ kind: "scan", token: "tok-1" })
    expect(replaySubject(entry({ method: "manual", token: null, seatId: "seat-1" }))).toEqual({
      kind: "manual",
      seatId: "seat-1",
    })
  })

  it("has no subject at all for an entry that can never succeed", () => {
    expect(replaySubject(entry({ token: null }))).toBeNull()
    expect(replaySubject(entry({ method: "manual", token: null, seatId: "" }))).toBeNull()
  })
})

describe("runReplay", () => {
  const three = () => {
    let state = enqueue(EMPTY_CHECKIN_OUTBOX, scan("tok-1"), T0)
    state = enqueue(state, scan("tok-2"), T0)
    state = enqueue(state, manual("seat-3"), T0)
    return state
  }
  const deps = { now: () => T0 }

  const answering = (answers: readonly ReplayAttempt[]) => {
    let i = 0
    return async () => answers[i++] ?? { status: "ok" as const, outcome: "checked_in" as const }
  }

  it("drains the successes and reports the DTO outcomes the door team never saw", async () => {
    const state = three()
    const run = await runReplay(
      state,
      dequeueReady(state, T0, { cleanupId: "e1" }),
      answering([
        { status: "ok", outcome: "checked_in" },
        { status: "ok", outcome: "cancelled" },
        { status: "error", code: "CONFLICT" },
      ]),
      deps,
    )
    expect(run.state.entries).toHaveLength(0)
    expect(run.sentAny).toBe(true)
    expect(run.report.sent).toBe(2)
    expect(run.report.refusals).toEqual([{ outcome: "cancelled", count: 1 }])
    expect(replayReportNotable(run.report)).toBe(true)
  })

  it("KEEPS the queue on an expired session, spends no attempt, and stops the batch", async () => {
    const state = three()
    const run = await runReplay(
      state,
      dequeueReady(state, T0, { cleanupId: "e1" }),
      answering([{ status: "error", code: "UNAUTHORIZED" }]),
      deps,
    )
    expect(run.state).toEqual(state)
    expect(run.state.entries.every((entry) => entry.attempts === 0)).toBe(true)
    expect(run.sentAny).toBe(false)
    expect(run.report.held).toBe(3)
    expect(dequeueReady(run.state, T0, { cleanupId: "e1" })).toHaveLength(3)
  })

  it("reports every entry still WAITING on a hold, not just the batch it dequeued", async () => {
    let state = three()
    state = enqueue(state, scan("tok-4"), T0)
    state = enqueue(state, scan("tok-5"), T0)
    const batch = dequeueReady(state, T0, { cleanupId: "e1", limit: 2 })
    expect(batch).toHaveLength(2)
    const run = await runReplay(state, batch, answering([{ status: "error", code: "UNAUTHORIZED" }]), {
      ...deps,
      scope: { cleanupId: "e1" },
    })
    expect(run.report.held).toBe(5)
    expect(run.state.entries).toHaveLength(5)
  })

  it("counts held for THIS event only, never another event's leftovers", async () => {
    let state = three()
    state = enqueue(state, { cleanupId: "e2", method: "scan", token: "tok-other" }, T0)
    const run = await runReplay(
      state,
      dequeueReady(state, T0, { cleanupId: "e1" }),
      answering([{ status: "error", code: "UNAUTHORIZED" }]),
      { ...deps, scope: { cleanupId: "e1" } },
    )
    expect(run.report.held).toBe(3)
  })

  it("does not call the server again once the session is gone", async () => {
    const state = three()
    let calls = 0
    await runReplay(
      state,
      dequeueReady(state, T0, { cleanupId: "e1" }),
      async () => {
        calls += 1
        return { status: "error", code: "UNAUTHORIZED" }
      },
      deps,
    )
    expect(calls).toBe(1)
  })

  it("DROPS a revoked capability and reports the count so a lead can redo those arrivals", async () => {
    const state = three()
    const run = await runReplay(
      state,
      dequeueReady(state, T0, { cleanupId: "e1" }),
      answering([
        { status: "error", code: "FORBIDDEN" },
        { status: "error", code: "FORBIDDEN" },
        { status: "error", code: "FORBIDDEN" },
      ]),
      deps,
    )
    expect(run.state.entries).toHaveLength(0)
    expect(run.report.forbidden).toBe(3)
    expect(run.report.discarded).toBe(0)
    expect(replayReportNotable(run.report)).toBe(true)
  })

  it("drops a refused entry with a reported count, without blocking the queue behind it", async () => {
    const state = three()
    const run = await runReplay(
      state,
      dequeueReady(state, T0, { cleanupId: "e1" }),
      answering([
        { status: "error", code: "NOT_FOUND" },
        { status: "error", code: "VALIDATION" },
        { status: "ok", outcome: "checked_in" },
      ]),
      deps,
    )
    expect(run.state.entries).toHaveLength(0)
    expect(run.report.discarded).toBe(2)
    expect(run.report.sent).toBe(1)
  })

  it("keeps a transient failure queued with backoff, and raises no report card for it", async () => {
    const state = three()
    const run = await runReplay(
      state,
      dequeueReady(state, T0, { cleanupId: "e1" }),
      answering([
        { status: "error", code: "RATE_LIMITED" },
        { status: "error", code: "INTERNAL" },
        { status: "error", code: "INTERNAL" },
      ]),
      deps,
    )
    expect(run.state.entries).toHaveLength(3)
    expect(run.state.entries.every((entry) => entry.attempts === 1)).toBe(true)
    expect(dequeueReady(run.state, T0, { cleanupId: "e1" })).toHaveLength(0)
    expect(run.report.retry).toBe(3)
    expect(replayReportNotable(run.report)).toBe(false)
  })

  it("persists the progress of a batch after every entry, not only at the end", async () => {
    const state = three()
    const seen: number[] = []
    await runReplay(
      state,
      dequeueReady(state, T0, { cleanupId: "e1" }),
      answering([]),
      { now: () => T0, onState: (next) => seen.push(next.entries.length) },
    )
    expect(seen).toEqual([2, 1, 0])
  })
})

describe("persistence round trip", () => {
  it("round-trips through the serialized form", () => {
    const state = enqueue(enqueue(EMPTY_CHECKIN_OUTBOX, scan("a1b2c3"), T0), manual("seat-1"), T0)
    expect(parseOutbox(serializeOutbox(state, USER_A), T0, USER_A)).toEqual(state)
  })

  it("never throws on garbage, a null, or a shape from another version", () => {
    expect(parseOutbox(null, T0, USER_A)).toEqual(EMPTY_CHECKIN_OUTBOX)
    expect(parseOutbox("{not json", T0, USER_A)).toEqual(EMPTY_CHECKIN_OUTBOX)
    expect(parseOutbox("[]", T0, USER_A)).toEqual(EMPTY_CHECKIN_OUTBOX)
    expect(parseOutbox('{"owner":"user-a","entries":[{"id":1}]}', T0, USER_A)).toEqual(
      EMPTY_CHECKIN_OUTBOX,
    )
  })

  it("refuses a blob stamped with another owner, and the unstamped pre-namespace shape", () => {
    const state = enqueue(EMPTY_CHECKIN_OUTBOX, scan("tok-1"), T0)
    expect(parseOutbox(serializeOutbox(state, USER_A), T0, USER_B)).toEqual(EMPTY_CHECKIN_OUTBOX)
    expect(parseOutbox(JSON.stringify({ entries: state.entries }), T0, USER_A)).toEqual(
      EMPTY_CHECKIN_OUTBOX,
    )
  })

  it("prunes expired entries as it loads, so a cold start never replays a stale day", () => {
    const state = enqueue(EMPTY_CHECKIN_OUTBOX, scan("tok-1"), T0)
    const parsed = parseOutbox(
      serializeOutbox(state, USER_A),
      T0 + CHECKIN_OUTBOX_TTL_MS + 1,
      USER_A,
    )
    expect(parsed.entries).toHaveLength(0)
  })
})

describe("per-account scoping", () => {
  it("keeps A's queue out of B's session, and hands it back when A returns", async () => {
    const store = makeStore()
    const queued = enqueue(EMPTY_CHECKIN_OUTBOX, scan("tok-a"), T0)
    await saveOutbox(store, queued, USER_A)

    expect(await loadOutbox(store, T0, USER_B)).toEqual(EMPTY_CHECKIN_OUTBOX)
    expect((await loadOutbox(store, T0, USER_A)).entries).toHaveLength(1)
  })

  it("writes each account to its own key", async () => {
    const store = makeStore()
    await saveOutbox(store, enqueue(EMPTY_CHECKIN_OUTBOX, scan("tok-a"), T0), USER_A)
    await saveOutbox(store, enqueue(EMPTY_CHECKIN_OUTBOX, scan("tok-b"), T0), USER_B)
    expect(new Set(store.keys())).toEqual(new Set([checkinOutboxKey(USER_A), checkinOutboxKey(USER_B)]))
  })

  it("deletes the pre-namespace blob instead of migrating it onto whoever reads next", async () => {
    const store = makeStore()
    store.seed(CHECKIN_OUTBOX_KEY, JSON.stringify({ entries: [] }))
    expect(await loadOutbox(store, T0, USER_B)).toEqual(EMPTY_CHECKIN_OUTBOX)
    expect(store.keys()).not.toContain(CHECKIN_OUTBOX_KEY)
  })

  it("clears only the owner's own key when its queue drains", async () => {
    const store = makeStore()
    await saveOutbox(store, enqueue(EMPTY_CHECKIN_OUTBOX, scan("tok-a"), T0), USER_A)
    await saveOutbox(store, enqueue(EMPTY_CHECKIN_OUTBOX, scan("tok-b"), T0), USER_B)
    await saveOutbox(store, EMPTY_CHECKIN_OUTBOX, USER_B)
    expect(store.keys()).toEqual([checkinOutboxKey(USER_A)])
  })
})
