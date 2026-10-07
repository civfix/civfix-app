import { afterEach, describe, expect, it, vi } from "vitest"

import { safeGet, safeRemove, safeSet, storageAvailable } from "@/lib/browser-storage"

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}

const blocked = () => {
  throw new Error("SecurityError")
}

afterEach(() => vi.unstubAllGlobals())

describe("browser storage never throws", () => {
  it("reads nothing and writes nothing during the static-export prerender, where there is no window", () => {
    expect(safeGet("local", "civfix.locale")).toBeNull()
    expect(() => safeSet("session", "civfix:event-team-invite", "{}")).not.toThrow()
    expect(() => safeRemove("local", "civfix.claim-handoff")).not.toThrow()
  })

  it("keeps localStorage and sessionStorage apart under the caller's exact key", () => {
    const local = memoryStorage()
    const session = memoryStorage()
    vi.stubGlobal("window", { localStorage: local, sessionStorage: session })
    safeSet("local", "civfix.appearance", "dark")
    safeSet("session", "civfix-console:org-invite-token", "tok")
    expect(local.data.get("civfix.appearance")).toBe("dark")
    expect(session.data.get("civfix-console:org-invite-token")).toBe("tok")
    expect(safeGet("local", "civfix-console:org-invite-token")).toBeNull()
    expect(safeGet("session", "civfix-console:org-invite-token")).toBe("tok")
    safeRemove("session", "civfix-console:org-invite-token")
    expect(session.data.has("civfix-console:org-invite-token")).toBe(false)
    expect(local.data.get("civfix.appearance")).toBe("dark")
  })

  it("reads blocked storage (private mode) as nothing saved and drops the write and the removal", () => {
    const denied = { getItem: blocked, setItem: blocked, removeItem: blocked }
    vi.stubGlobal("window", { localStorage: denied, sessionStorage: denied })
    expect(safeGet("local", "civfix.locale")).toBeNull()
    expect(safeGet("session", "civfix:event-team-invite")).toBeNull()
    expect(() => safeSet("local", "civfix.locale", "es")).not.toThrow()
    expect(() => safeRemove("session", "civfix:event-team-invite")).not.toThrow()
  })

  it("treats a storage whose accessor itself throws (blocked site data) the same way", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        return blocked()
      },
      get sessionStorage(): Storage {
        return blocked()
      },
    })
    expect(safeGet("local", "civfix.locale")).toBeNull()
    expect(() => safeSet("session", "civfix:event-team-invite", "{}")).not.toThrow()
    expect(() => safeRemove("local", "civfix.locale")).not.toThrow()
  })

  it("reports storage available only when the accessor itself answers", () => {
    expect(storageAvailable("local")).toBe(false)
    vi.stubGlobal("window", { localStorage: memoryStorage(), sessionStorage: memoryStorage() })
    expect(storageAvailable("local")).toBe(true)
    expect(storageAvailable("session")).toBe(true)
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        return blocked()
      },
    })
    expect(storageAvailable("local")).toBe(false)
  })
})
