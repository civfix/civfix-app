import { describe, expect, it } from "vitest"
import {
  EMPTY_CHECKIN_OUTBOX,
  checkinOutboxKey,
  enqueue,
  loadOutbox,
  mergeQueued,
  parseOutbox,
  saveOutbox,
  serializeOutbox,
  type CheckinOutboxInput,
  type CheckinOutboxState,
} from "../checkinOutbox"

const T0 = Date.UTC(2026, 8, 6, 12, 0, 0)
const USER_A = "user-a"

const scan = (token: string): CheckinOutboxInput => ({ cleanupId: "e1", method: "scan", token })

function makeStore(gate: Promise<void>) {
  const blobs = new Map<string, string>()
  return {
    get: async (key: string) => {
      await gate
      return blobs.get(key) ?? null
    },
    set: async (key: string, value: string) => {
      blobs.set(key, value)
    },
    del: async (key: string) => {
      blobs.delete(key)
    },
    read: (key: string) => blobs.get(key) ?? null,
    seed: (key: string, value: string) => blobs.set(key, value),
  }
}

function harness(store: ReturnType<typeof makeStore>) {
  let loaded = false
  let buffered: CheckinOutboxInput[] = []
  let state: CheckinOutboxState = EMPTY_CHECKIN_OUTBOX
  const commit = (next: CheckinOutboxState) => {
    state = next
    void saveOutbox(store, next, USER_A)
  }
  return {
    load: loadOutbox(store, T0, USER_A).then((stored) => {
      const waiting = buffered
      buffered = []
      loaded = true
      const merged = mergeQueued(stored, waiting, T0)
      if (waiting.length > 0) commit(merged)
      else state = merged
    }),
    queue: (input: CheckinOutboxInput) => {
      const next = enqueue(state, input, T0)
      if (loaded) {
        commit(next)
        return
      }
      buffered = [...buffered, input]
      state = next
    },
    state: () => state,
    replayable: () => loaded,
  }
}

describe("a scan queued before the persisted outbox has loaded", () => {
  it("does not overwrite the stored queue, and survives into the merged one", async () => {
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const store = makeStore(gate)
    const stored = enqueue(EMPTY_CHECKIN_OUTBOX, scan("tok-stored"), T0)
    store.seed(checkinOutboxKey(USER_A), serializeOutbox(stored, USER_A))

    const hook = harness(store)
    hook.queue(scan("tok-new"))
    expect(hook.replayable()).toBe(false)
    expect(parseOutbox(store.read(checkinOutboxKey(USER_A)), T0, USER_A).entries).toHaveLength(1)

    release()
    await hook.load

    expect(hook.state().entries.map((entry) => entry.token)).toEqual(["tok-stored", "tok-new"])
    expect(
      parseOutbox(store.read(checkinOutboxKey(USER_A)), T0, USER_A).entries.map((e) => e.token),
    ).toEqual(["tok-stored", "tok-new"])
  })

  it("folds an arrival the stored blob already holds into ONE entry", async () => {
    const store = makeStore(Promise.resolve())
    const stored = enqueue(EMPTY_CHECKIN_OUTBOX, scan("tok-1"), T0)
    store.seed(checkinOutboxKey(USER_A), serializeOutbox(stored, USER_A))

    const hook = harness(store)
    hook.queue(scan("tok-1"))
    await hook.load

    expect(hook.state().entries).toHaveLength(1)
  })
})

describe("mergeQueued", () => {
  it("keeps the stored entries and appends the arrivals in order", () => {
    const stored = enqueue(EMPTY_CHECKIN_OUTBOX, scan("a"), T0)
    const merged = mergeQueued(stored, [scan("b"), scan("c")], T0)
    expect(merged.entries.map((entry) => entry.token)).toEqual(["a", "b", "c"])
  })

  it("returns the stored queue untouched when nothing arrived", () => {
    const stored = enqueue(EMPTY_CHECKIN_OUTBOX, scan("a"), T0)
    expect(mergeQueued(stored, [], T0)).toBe(stored)
  })
})
