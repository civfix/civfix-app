/**
 * `useCoarsePointer` replaces a module-scope probe that read the browser at import time: the static
 * export prerendered `false`, the client imported `true`, and nothing followed a later pointer change.
 */
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { readCoarsePointer, subscribeCoarsePointer, useCoarsePointer } from "../useCoarsePointer"

interface FakeQuery {
  matches: boolean
  listeners: Set<() => void>
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
}

function installMatchMedia(matches: boolean): FakeQuery {
  const query: FakeQuery = {
    matches,
    listeners: new Set(),
    addEventListener: (type, listener) => {
      if (type === "change") query.listeners.add(listener)
    },
    removeEventListener: (type, listener) => {
      if (type === "change") query.listeners.delete(listener)
    },
  }
  const matchMedia = vi.fn((media: string) => {
    expect(media).toBe("(pointer: coarse)")
    return query
  })
  vi.stubGlobal("window", { matchMedia })
  return query
}

function Probe() {
  return createElement("span", null, String(useCoarsePointer()))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("useCoarsePointer", () => {
  it("reads false and subscribes to nothing where there is no window", () => {
    vi.stubGlobal("window", undefined)
    expect(readCoarsePointer()).toBe(false)
    expect(() => subscribeCoarsePointer(() => {})()).not.toThrow()
  })

  it("reads false where the window has no matchMedia (native)", () => {
    vi.stubGlobal("window", {})
    expect(readCoarsePointer()).toBe(false)
    expect(() => subscribeCoarsePointer(() => {})()).not.toThrow()
  })

  it("reads the live media query on the client", () => {
    const query = installMatchMedia(true)
    expect(readCoarsePointer()).toBe(true)
    query.matches = false
    expect(readCoarsePointer()).toBe(false)
  })

  it("notifies on a pointer change and stops after unsubscribe", () => {
    const query = installMatchMedia(false)
    const notify = vi.fn()
    const unsubscribe = subscribeCoarsePointer(notify)
    query.matches = true
    for (const listener of query.listeners) listener()
    expect(notify).toHaveBeenCalledTimes(1)
    expect(readCoarsePointer()).toBe(true)
    unsubscribe()
    expect(query.listeners.size).toBe(0)
  })

  it("prerenders false even on a touch client, so hydration matches the static export", () => {
    installMatchMedia(true)
    expect(renderToStaticMarkup(createElement(Probe))).toBe("<span>false</span>")
  })
})
