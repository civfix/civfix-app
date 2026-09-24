import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { consoleDraftKey, useDraft } from "./use-draft"

afterEach(() => {
  cleanup()
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
