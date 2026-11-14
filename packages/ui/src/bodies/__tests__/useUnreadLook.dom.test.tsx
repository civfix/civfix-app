import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import type { NotificationDTO } from "@civfix/contract"
import { UNREAD_LOOK_MS, useUnreadLook } from "../useUnreadLook"

function note(id: string, read: boolean): NotificationDTO {
  return {
    id,
    type: "report_update",
    title: id,
    body: null,
    read,
    createdAt: "2026-11-13T10:00:00.000Z",
    link: null,
  }
}

function mount(initial: readonly NotificationDTO[]) {
  const view = renderHook(({ items }) => ({ look: useUnreadLook(items), items }), {
    initialProps: { items: initial },
  })
  const unread = () =>
    view.result.current.items.filter((n) => view.result.current.look(n)).map((n) => n.id)
  return { ...view, unread }
}

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("GH#308 useUnreadLook", () => {
  it("keeps an unread row's look for exactly 3 seconds, also once the server says it is read", () => {
    const view = mount([note("n1", false), note("n2", true)])
    expect(view.unread()).toEqual(["n1"])

    view.rerender({ items: [note("n1", true), note("n2", true)] })
    advance(UNREAD_LOOK_MS - 1)
    expect(view.unread()).toEqual(["n1"])
    advance(1)
    expect(view.unread()).toEqual([])
  })

  it("gives a row that arrives later its own 3 seconds without extending the earlier rows'", () => {
    const view = mount([note("n1", false)])
    advance(2000)
    view.rerender({ items: [note("n2", false), note("n1", true)] })
    expect(view.unread()).toEqual(["n2", "n1"])

    advance(UNREAD_LOOK_MS - 2000)
    expect(view.unread()).toEqual(["n2"])
    advance(1999)
    expect(view.unread()).toEqual(["n2"])
    advance(1)
    expect(view.unread()).toEqual([])
  })

  it("never lights a row that was read when first shown, and shows a cleared row read after a remount", () => {
    const first = mount([note("n1", false), note("n2", true)])
    advance(UNREAD_LOOK_MS)
    expect(first.unread()).toEqual([])
    first.unmount()

    const again = mount([note("n1", true), note("n2", true)])
    expect(again.unread()).toEqual([])
  })

  it("leaves no timer behind when the center closes before the 3 seconds are up", () => {
    const view = mount([note("n1", false)])
    expect(vi.getTimerCount()).toBe(1)
    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
