import { describe, expect, it } from "vitest"
import {
  EMPTY_CHECKIN_OUTBOX,
  checkinOutboxKey,
  enqueue,
  markFailed,
  saveOutbox,
  type CheckinOutboxState,
} from "../../../data/checkinOutbox"
import { outboxPersistOwner } from "../useCheckinOutbox"

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
  }
}

describe("outboxPersistOwner", () => {
  it("persists under the owner that is still signed in", () => {
    expect(outboxPersistOwner(USER_A, USER_A)).toBe(USER_A)
  })

  it("refuses to persist once the owner signed out or was replaced", () => {
    expect(outboxPersistOwner(USER_A, null)).toBeNull()
    expect(outboxPersistOwner(USER_A, USER_B)).toBeNull()
    expect(outboxPersistOwner(null, null)).toBeNull()
    expect(outboxPersistOwner(null, USER_B)).toBeNull()
  })
})

describe("sign-out during an in-flight replay", () => {
  function harness(ownerId: string | null) {
    const store = makeStore()
    let current: string | null = ownerId
    let state: CheckinOutboxState = EMPTY_CHECKIN_OUTBOX
    return {
      store,
      signOut: () => {
        current = null
        store.keys().forEach((key) => void store.del(key))
      },
      commit: async (next: CheckinOutboxState) => {
        state = next
        const owner = outboxPersistOwner(ownerId, current)
        if (owner !== null) await saveOutbox(store, next, owner)
      },
      state: () => state,
    }
  }

  it("does not re-write A's blob for the entries that settle after the sign-out", async () => {
    const sim = harness(USER_A)
    await sim.commit(enqueue(enqueue(EMPTY_CHECKIN_OUTBOX, scan("tok-1"), T0), scan("tok-2"), T0))
    expect(sim.store.keys()).toEqual([checkinOutboxKey(USER_A)])

    sim.signOut()
    await sim.commit(markFailed(sim.state(), sim.state().entries[0]!.id, T0))
    await sim.commit(markFailed(sim.state(), sim.state().entries[1]!.id, T0))

    expect(sim.store.keys()).toEqual([])
  })

  it("still persists every commit while the same account stays signed in", async () => {
    const sim = harness(USER_A)
    await sim.commit(enqueue(EMPTY_CHECKIN_OUTBOX, scan("tok-1"), T0))
    await sim.commit(markFailed(sim.state(), sim.state().entries[0]!.id, T0))
    expect(sim.store.keys()).toEqual([checkinOutboxKey(USER_A)])
  })
})

function scan(token: string) {
  return { cleanupId: "e1", method: "scan" as const, token }
}
