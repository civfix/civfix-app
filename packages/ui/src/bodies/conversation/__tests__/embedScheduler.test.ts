import { describe, expect, it, vi } from "vitest"
import {
  EMBED_LOAD_CONCURRENCY,
  EMBED_VIEWPORT_LOOKAHEAD,
  createEmbedLoadQueue,
  createEmbedViewport,
  createOpenViewport,
  viewportWindowKeys,
} from "../embedScheduler"

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `row-${i}` }))

describe("the embed load queue caps how many cards fetch at once", () => {
  it("defaults to a small fixed concurrency and a small look-ahead", () => {
    expect(EMBED_LOAD_CONCURRENCY).toBe(6)
    expect(EMBED_VIEWPORT_LOOKAHEAD).toBe(2)
  })

  it("admits up to the limit and makes the rest wait", () => {
    const queue = createEmbedLoadQueue(2)
    for (const key of ["a", "b", "c", "d"]) queue.request(key)
    expect([queue.isAdmitted("a"), queue.isAdmitted("b")]).toEqual([true, true])
    expect([queue.isAdmitted("c"), queue.isAdmitted("d")]).toEqual([false, false])
    expect(queue.activeCount()).toBe(2)
    expect(queue.waitingCount()).toBe(2)
  })

  it("admits the next waiter in request order as each load settles", () => {
    const queue = createEmbedLoadQueue(2)
    for (const key of ["a", "b", "c", "d"]) queue.request(key)
    queue.settle("a", true)
    expect(queue.isAdmitted("c")).toBe(true)
    expect(queue.isAdmitted("d")).toBe(false)
    queue.settle("b", false)
    expect(queue.isAdmitted("d")).toBe(true)
    expect(queue.activeCount()).toBe(2)
  })

  it("notifies only the key whose admission changed", () => {
    const queue = createEmbedLoadQueue(1)
    const onA = vi.fn()
    const onB = vi.fn()
    queue.subscribe("a", onA)
    queue.subscribe("b", onB)
    queue.request("a")
    expect(onA).toHaveBeenCalledTimes(1)
    expect(onB).not.toHaveBeenCalled()
    queue.request("b")
    expect(onB).not.toHaveBeenCalled()
    queue.settle("a", true)
    expect(onB).toHaveBeenCalledTimes(1)
  })

  it("frees the slot when a card scrolls away before it loaded", () => {
    const queue = createEmbedLoadQueue(1)
    queue.request("a")
    queue.request("b")
    queue.drop("a")
    expect(queue.isAdmitted("a")).toBe(false)
    expect(queue.isAdmitted("b")).toBe(true)
  })

  it("drops a still-waiting card without ever admitting it", () => {
    const queue = createEmbedLoadQueue(1)
    queue.request("a")
    queue.request("b")
    queue.drop("b")
    expect(queue.isAdmitted("b")).toBe(false)
    queue.settle("a", true)
    expect(queue.isAdmitted("b")).toBe(false)
    expect(queue.activeCount()).toBe(0)
    expect(queue.waitingCount()).toBe(0)
  })

  it("counts the bubbles that want the same entity, so one scrolling away keeps the other loaded", () => {
    const queue = createEmbedLoadQueue(1)
    queue.request("report:1")
    queue.request("report:1")
    expect(queue.activeCount()).toBe(1)
    queue.drop("report:1")
    expect(queue.isAdmitted("report:1")).toBe(true)
    queue.drop("report:1")
    expect(queue.isAdmitted("report:1")).toBe(false)
  })

  it("lets a cached entity back in for free, so scrolling back never queues again", () => {
    const queue = createEmbedLoadQueue(1)
    queue.request("a")
    queue.settle("a", true)
    queue.drop("a")
    queue.request("b")
    queue.request("a")
    expect(queue.isAdmitted("a")).toBe(true)
    expect(queue.isAdmitted("b")).toBe(true)
    expect(queue.activeCount()).toBe(1)
  })

  it("keeps a failed embed admitted while it stays mounted, and re-queues it on a later visit", () => {
    const queue = createEmbedLoadQueue(1)
    queue.request("bad")
    queue.settle("bad", false)
    expect(queue.isAdmitted("bad")).toBe(true)
    expect(queue.activeCount()).toBe(0)
    queue.drop("bad")
    queue.request("slow")
    queue.request("bad")
    expect(queue.isAdmitted("bad")).toBe(false)
  })
})

describe("the embed viewport tracks which rows are on screen", () => {
  it("treats every row as visible until the list first reports, so a list that never reports still loads", () => {
    const viewport = createEmbedViewport()
    expect(viewport.isVisible("row-0")).toBe(true)
    viewport.setVisible(["row-0", "row-1"])
    expect([viewport.isVisible("row-0"), viewport.isVisible("row-2")]).toEqual([true, false])
  })

  it("wakes only the rows the first report takes off screen", () => {
    const viewport = createEmbedViewport()
    const listeners = { a: vi.fn(), b: vi.fn(), c: vi.fn() }
    viewport.subscribe("a", listeners.a)
    viewport.subscribe("b", listeners.b)
    viewport.subscribe("c", listeners.c)
    viewport.setVisible(["a", "b"])
    expect([listeners.a.mock.calls.length, listeners.b.mock.calls.length, listeners.c.mock.calls.length]).toEqual([0, 0, 1])
    expect(viewport.isVisible("c")).toBe(false)
  })

  it("notifies the rows that entered or left, and nobody else", () => {
    const viewport = createEmbedViewport()
    const listeners = { a: vi.fn(), b: vi.fn(), c: vi.fn() }
    viewport.subscribe("a", listeners.a)
    viewport.subscribe("b", listeners.b)
    viewport.subscribe("c", listeners.c)
    viewport.setVisible(["a", "b", "c"])
    expect([listeners.a.mock.calls.length, listeners.b.mock.calls.length, listeners.c.mock.calls.length]).toEqual([0, 0, 0])
    viewport.setVisible(["b", "c"])
    expect([listeners.a.mock.calls.length, listeners.b.mock.calls.length, listeners.c.mock.calls.length]).toEqual([1, 0, 0])
    viewport.setVisible(["c", "b"])
    expect([listeners.a.mock.calls.length, listeners.b.mock.calls.length, listeners.c.mock.calls.length]).toEqual([1, 0, 0])
  })

  it("treats every row as visible when no list is plumbed in", () => {
    const viewport = createOpenViewport()
    expect(viewport.isVisible("anything")).toBe(true)
    expect(typeof viewport.subscribe("anything", () => {})).toBe("function")
  })
})

describe("viewportWindowKeys turns the list's viewable items into the rows allowed to fetch", () => {
  it("covers the viewable range plus a look-ahead on each side", () => {
    expect(viewportWindowKeys(rows(20), [{ index: 5 }, { index: 7 }])).toEqual([
      "row-3",
      "row-4",
      "row-5",
      "row-6",
      "row-7",
      "row-8",
      "row-9",
    ])
  })

  it("clamps to the ends of the list", () => {
    expect(viewportWindowKeys(rows(3), [{ index: 0 }])).toEqual(["row-0", "row-1", "row-2"])
    expect(viewportWindowKeys(rows(3), [{ index: 2 }])).toEqual(["row-0", "row-1", "row-2"])
  })

  it("ignores items the list could not place and reports nothing when none are viewable", () => {
    expect(viewportWindowKeys(rows(10), [{ index: null }])).toEqual([])
    expect(viewportWindowKeys(rows(10), [])).toEqual([])
    expect(viewportWindowKeys(rows(10), [{ index: null }, { index: 4 }], 0)).toEqual(["row-4"])
  })
})
