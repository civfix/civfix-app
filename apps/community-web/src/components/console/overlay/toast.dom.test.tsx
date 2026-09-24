import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "../__testing__/harness"
import { useConsoleToast } from "./toast"

function Trigger() {
  const { toast } = useConsoleToast()
  return (
    <button type="button" onClick={() => toast({ title: "Saved", durationMs: 5000 })}>
      save
    </button>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function showToast() {
  renderConsole(<Trigger />)
  fireEvent.click(screen.getByRole("button", { name: "save" }))
}

function visibleToast(): HTMLElement | null {
  const region = screen.getByRole("region", { name: "toast.region" })
  return [...region.querySelectorAll("p")].find((p) => p.textContent === "Saved") ?? null
}

describe("ConsoleToastProvider", () => {
  it("exposes its controls to assistive tech inside a named region", () => {
    showToast()
    const region = screen.getByRole("region", { name: "toast.region" })
    const dismiss = screen.getByRole("button", { name: "action.dismiss" })
    expect(region.contains(dismiss)).toBe(true)
    expect(region.closest("[aria-hidden]")).toBeNull()
  })

  it("keeps announcing through the single polite live region", () => {
    showToast()
    expect(screen.getByRole("status").textContent).toBe("Saved")
  })

  it("expires a timed toast", () => {
    showToast()
    act(() => {
      vi.advanceTimersByTime(5001)
    })
    expect(visibleToast()).toBeNull()
  })

  it("holds a timed toast while the pointer is over it and resumes the remaining time after", () => {
    showToast()
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    const region = screen.getByRole("region", { name: "toast.region" })
    fireEvent.pointerEnter(region)
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(visibleToast()).not.toBeNull()

    fireEvent.pointerLeave(region)
    act(() => {
      vi.advanceTimersByTime(900)
    })
    expect(visibleToast()).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(visibleToast()).toBeNull()
  })

  it("does not hold the next toast after the hovered one was dismissed from under the pointer", () => {
    showToast()
    const region = screen.getByRole("region", { name: "toast.region" })
    fireEvent.pointerEnter(region)
    fireEvent.click(screen.getByRole("button", { name: "action.dismiss" }))
    expect(visibleToast()).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "save" }))
    act(() => {
      vi.advanceTimersByTime(5001)
    })
    expect(visibleToast()).toBeNull()
  })

  it("holds a timed toast while keyboard focus is inside it", () => {
    showToast()
    const dismiss = screen.getByRole("button", { name: "action.dismiss" })
    act(() => {
      dismiss.focus()
    })
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(visibleToast()).not.toBeNull()

    act(() => {
      screen.getByRole("button", { name: "save" }).focus()
    })
    act(() => {
      vi.advanceTimersByTime(5001)
    })
    expect(visibleToast()).toBeNull()
  })

  it("clears the expiry timer when a toast is dismissed early", () => {
    showToast()
    const before = vi.getTimerCount()
    fireEvent.click(screen.getByRole("button", { name: "action.dismiss" }))
    expect(visibleToast()).toBeNull()
    expect(vi.getTimerCount()).toBe(before - 1)
  })
})
