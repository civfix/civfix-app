import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it } from "vitest"
import { focusManager, onlineManager } from "@tanstack/react-query"
import { bufferedForReload, subscribeOutboxWake } from "../useCheckinOutbox"
import { expectWrittenInLayoutEffect } from "../../../__tests__/sourceGuards"

const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const hook = code(readFileSync(new URL("../useCheckinOutbox.ts", import.meta.url), "utf8"))

describe("bufferedForReload", () => {
  const scans = ["a", "b"]

  it("keeps the scans queued before the first load when the same owner reloads", () => {
    expect(bufferedForReload("user-a", "user-a", scans)).toEqual(scans)
  })

  it("drops them when the signed-in owner changes, so they are never written under someone else", () => {
    expect(bufferedForReload("user-a", "user-b", scans)).toEqual([])
    expect(bufferedForReload("user-a", null, scans)).toEqual([])
  })

  it("starts empty on the first load", () => {
    expect(bufferedForReload(undefined, "user-a", scans)).toEqual([])
  })
})

describe("the load effect", () => {
  it("re-runs only when the stored blob it reads could change", () => {
    expect(hook).toContain("}, [cleanupId, ownerId, store])")
    expect(hook).not.toContain("}, [cleanupId, commit, ownerId, replay, store])")
    expect(hook).toContain("commitRef.current(merged)")
  })

  it.each(["ownerIdRef.current = ownerId", "commitRef.current = commit", "replayRef.current = replay"])(
    "reads %s from the last committed render, never a discarded one",
    (assignment) => {
      expectWrittenInLayoutEffect(hook, assignment)
    },
  )
})

describe("subscribeOutboxWake: foreground on both platforms, reconnect on web", () => {
  afterEach(() => {
    focusManager.setFocused(undefined)
    onlineManager.setOnline(true)
  })

  it("wakes the replay when the app comes back to the foreground", () => {
    let wakes = 0
    const off = subscribeOutboxWake(() => {
      wakes += 1
    })
    focusManager.setFocused(false)
    expect(wakes).toBe(0)
    focusManager.setFocused(true)
    expect(wakes).toBe(1)
    off()
  })

  it("wakes the replay when onlineManager reports the connection back (web; native has no connectivity feed yet), not when it drops", () => {
    let wakes = 0
    const off = subscribeOutboxWake(() => {
      wakes += 1
    })
    onlineManager.setOnline(false)
    expect(wakes).toBe(0)
    onlineManager.setOnline(true)
    expect(wakes).toBe(1)
    off()
  })

  it("stops listening once the screen unmounts", () => {
    let wakes = 0
    const off = subscribeOutboxWake(() => {
      wakes += 1
    })
    off()
    onlineManager.setOnline(false)
    onlineManager.setOnline(true)
    focusManager.setFocused(false)
    focusManager.setFocused(true)
    expect(wakes).toBe(0)
  })

  it("is wired into the hook and replays only when something is waiting", () => {
    expect(hook).toContain("subscribeOutboxWake(() => {")
    expect(hook).toContain(
      "if (pending(stateRef.current, Date.now(), cleanupId) > 0) void replayRef.current()",
    )
  })
})
