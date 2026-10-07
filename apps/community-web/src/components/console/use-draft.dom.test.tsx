import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { consoleDraftKey, useDraft } from "./use-draft"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  window.localStorage.clear()
})

const KEY = consoleDraftKey("ticket.evt_1", "tt_1", "viewer-1")

describe("useDraft restore", () => {
  it("discards a stored entry that is valid JSON but not a draft envelope", () => {
    window.localStorage.setItem(KEY, "42")
    const { result } = renderHook(() => useDraft(KEY, { title: "" }))
    expect(result.current.restored).toBe(false)
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  it("discards an entry that is not JSON at all", () => {
    window.localStorage.setItem(KEY, "{not json")
    renderHook(() => useDraft(KEY, { title: "" }))
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  it("restores a current draft for the same owner", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ version: "v1", savedAt: Date.now(), owner: "viewer-1", value: { title: "Hi" } }),
    )
    const { result } = renderHook(() => useDraft(KEY, { title: "" }))
    expect(result.current.restored).toBe(true)
    expect(result.current.draft.title).toBe("Hi")
  })

  it("discards a draft saved by another account", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ version: "v1", savedAt: Date.now(), owner: "someone-else", value: { title: "Hi" } }),
    )
    const { result } = renderHook(() => useDraft(KEY, { title: "" }))
    expect(result.current.restored).toBe(false)
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })
})

describe("useDraft retired scopes", () => {
  it("sweeps the pre-event-zone ticket and broadcast drafts of every viewer, and nothing else", () => {
    const envelope = JSON.stringify({ version: "v1", savedAt: Date.now(), owner: "viewer-1", value: {} })
    const retired = [
      consoleDraftKey("ticket.v1.evt_1", "tt_1", "viewer-1"),
      consoleDraftKey("broadcast.v1.evt_1", "new", "viewer-2"),
      consoleDraftKey("ticket.v1.evt_2", "new", null),
    ]
    const kept = [consoleDraftKey("ticket.v2.evt_1", "tt_1", "viewer-1"), "civfix.locale"]
    for (const key of [...retired, ...kept]) window.localStorage.setItem(key, envelope)

    renderHook(() => useDraft(KEY, { title: "" }))

    for (const key of retired) expect(window.localStorage.getItem(key), key).toBeNull()
    for (const key of kept) expect(window.localStorage.getItem(key), key).not.toBeNull()
  })
})

function storedValue(key: string): unknown {
  const raw = window.localStorage.getItem(key)
  return raw === null ? null : (JSON.parse(raw) as { value: unknown }).value
}

describe("useDraft write", () => {
  it("stores the last draft once typing pauses, not on every change", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const { result } = renderHook(() => useDraft(KEY, { title: "" }))
    act(() => result.current.patch({ title: "H" }))
    act(() => result.current.patch({ title: "Hi" }))
    act(() => {
      vi.advanceTimersByTime(499)
    })
    expect(window.localStorage.getItem(KEY)).toBeNull()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    const envelope = JSON.parse(window.localStorage.getItem(KEY) as string) as Record<string, unknown>
    expect(envelope).toMatchObject({ version: "v1", owner: "viewer-1", value: { title: "Hi" } })
  })

  it("flushes the pending draft on unmount", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const { result, unmount } = renderHook(() => useDraft(KEY, { title: "", body: "" }))
    act(() => result.current.patch({ title: "Water", body: "Bring gloves" }))
    unmount()
    expect(storedValue(KEY)).toEqual({ title: "Water", body: "Bring gloves" })
  })

  it("flushes the pending draft on pagehide", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const { result } = renderHook(() => useDraft(KEY, { title: "" }))
    act(() => result.current.patch({ title: "Hi" }))
    window.dispatchEvent(new Event("pagehide"))
    expect(storedValue(KEY)).toEqual({ title: "Hi" })
  })

  it("drops a pending write when the draft is cleared", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const { result, unmount } = renderHook(() => useDraft(KEY, { title: "" }))
    act(() => result.current.patch({ title: "Hi" }))
    act(() => result.current.clear())
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    unmount()
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  it("keeps a pending draft under its own key when the key changes", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const other = consoleDraftKey("ticket.evt_1", "tt_2", "viewer-1")
    const { result, rerender } = renderHook(({ key }) => useDraft(key, { title: "" }), {
      initialProps: { key: KEY },
    })
    act(() => result.current.patch({ title: "First" }))
    rerender({ key: other })
    act(() => result.current.patch({ title: "Second" }))
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(storedValue(KEY)).toEqual({ title: "First" })
    expect(storedValue(other)).toEqual({ title: "Second" })
  })
})
