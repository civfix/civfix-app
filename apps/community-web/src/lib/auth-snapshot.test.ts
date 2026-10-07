import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import type { UserDTO } from "@civfix/shared"

import {
  SNAPSHOT_KEY,
  readAuthSnapshot,
  writeAuthSnapshot,
  clearAuthSnapshot,
} from "@/lib/auth-snapshot"

/**
 * The node env has no localStorage, so `window` is stubbed with a Map-backed fake. The read path must
 * be self-healing: any failure returns null and clears the key.
 */

const USER: UserDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Ada Lovelace",
  handle: "ada",
  role: "citizen",
  locale: "en",
  profileComplete: true,
  createdAt: "2026-01-01T00:00:00.000Z",
}

function makeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string): string | null => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string): void => {
      map.set(key, value)
    },
    removeItem: (key: string): void => {
      map.delete(key)
    },
    map,
  }
}

let storage: ReturnType<typeof makeStorage>

beforeEach(() => {
  storage = makeStorage()
  vi.stubGlobal("window", { localStorage: storage })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("auth-snapshot read/write round-trip", () => {
  it("writes a user and reads back an equal user", () => {
    writeAuthSnapshot(USER)
    expect(readAuthSnapshot()).toEqual(USER)
  })

  it("returns null when no snapshot has been written", () => {
    expect(readAuthSnapshot()).toBeNull()
  })

  it("clear removes the stored key", () => {
    writeAuthSnapshot(USER)
    clearAuthSnapshot()
    expect(storage.map.has(SNAPSHOT_KEY)).toBe(false)
    expect(readAuthSnapshot()).toBeNull()
  })
})

describe("auth-snapshot read is self-healing", () => {
  it("returns null and clears the key on corrupt JSON (never throws)", () => {
    storage.setItem(SNAPSHOT_KEY, "{ not json")
    expect(() => readAuthSnapshot()).not.toThrow()
    expect(readAuthSnapshot()).toBeNull()
    expect(storage.map.has(SNAPSHOT_KEY)).toBe(false)
  })

  it("returns null and clears the key on a version mismatch", () => {
    storage.setItem(SNAPSHOT_KEY, JSON.stringify({ v: 2, user: USER }))
    expect(readAuthSnapshot()).toBeNull()
    expect(storage.map.has(SNAPSHOT_KEY)).toBe(false)
  })

  it("returns null and clears the key when the user shape is invalid", () => {
    // Missing the required `id`/`displayName` - fails UserDTOSchema.
    storage.setItem(SNAPSHOT_KEY, JSON.stringify({ v: 1, user: { handle: "ada" } }))
    expect(readAuthSnapshot()).toBeNull()
    expect(storage.map.has(SNAPSHOT_KEY)).toBe(false)
  })
})

describe("auth-snapshot is SSR-safe (no window)", () => {
  beforeEach(() => {
    // Override the suite-wide window stub: with no window, every function must be an inert no-op.
    vi.stubGlobal("window", undefined)
  })

  it("read returns null and write/clear do not throw", () => {
    expect(readAuthSnapshot()).toBeNull()
    expect(() => writeAuthSnapshot(USER)).not.toThrow()
    expect(() => clearAuthSnapshot()).not.toThrow()
  })
})
