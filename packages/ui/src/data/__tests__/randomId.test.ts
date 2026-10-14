import { afterEach, describe, expect, it, vi } from "vitest"
import { randomId } from "../randomId"

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("randomId", () => {
  it("uses the runtime's crypto.randomUUID when there is one", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-2222-4333-8444-555555555555" })
    expect(randomId()).toBe("11111111-2222-4333-8444-555555555555")
  })

  it("falls back to a v4-shaped id on a runtime without it", () => {
    vi.stubGlobal("crypto", undefined)
    const ids = Array.from({ length: 50 }, () => randomId())
    for (const id of ids) expect(id).toMatch(UUID_V4)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("fits the 64-character chat clientId cap either way", () => {
    vi.stubGlobal("crypto", undefined)
    expect(randomId().length).toBeLessThanOrEqual(64)
  })
})
