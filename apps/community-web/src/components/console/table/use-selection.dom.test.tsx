import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { useSelection } from "./use-selection"

afterEach(cleanup)

describe("useSelection", () => {
  it("drops a selected row that left the list from the count and the bulk set", () => {
    const { result, rerender } = renderHook(({ ids }) => useSelection(ids), {
      initialProps: { ids: ["a", "b", "c"] as readonly string[] },
    })
    act(() => result.current.toggle("a"))
    act(() => result.current.toggle("b"))
    expect(result.current.count).toBe(2)

    rerender({ ids: ["b", "c"] })
    expect(result.current.count).toBe(1)
    expect([...result.current.selectedIds]).toEqual(["b"])
    expect(result.current.isSelected("a")).toBe(false)
    expect(result.current.someSelected).toBe(true)
  })

  it("reports nothing selected once every selected row is gone", () => {
    const { result, rerender } = renderHook(({ ids }) => useSelection(ids), {
      initialProps: { ids: ["a", "b"] as readonly string[] },
    })
    act(() => result.current.toggle("a"))
    rerender({ ids: ["b"] })
    expect(result.current.count).toBe(0)
    expect(result.current.someSelected).toBe(false)
    expect(result.current.allSelected).toBe(false)
  })

  it("keeps selections across a load-more that appends rows", () => {
    const { result, rerender } = renderHook(({ ids }) => useSelection(ids), {
      initialProps: { ids: ["a", "b"] as readonly string[] },
    })
    act(() => result.current.toggleAll())
    rerender({ ids: ["a", "b", "c"] })
    expect([...result.current.selectedIds]).toEqual(["a", "b"])
    expect(result.current.someSelected).toBe(true)
  })
})
