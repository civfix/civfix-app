import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { PublicPageState, type PublicPageStateClasses } from "./public-page-state"

const CLASSES: PublicPageStateClasses = {
  page: "x-page",
  shell: "x-shell x-state",
  spin: "x-spin",
  action: "x-button",
}

afterEach(cleanup)

describe("PublicPageState", () => {
  it("renders a busy state with the caller's classes and a spinning icon", () => {
    const { container } = render(
      <PublicPageState classes={CLASSES} busy title="Loading">
        Please wait
      </PublicPageState>,
    )
    const main = container.querySelector("main")!
    expect(main.className).toBe("x-page")
    expect(main.getAttribute("aria-busy")).toBe("true")
    expect(main.firstElementChild!.className).toBe("x-shell x-state")
    expect(container.querySelector("svg")!.getAttribute("class")).toContain("x-spin")
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Loading")
    expect(screen.getByText("Please wait").tagName).toBe("P")
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("renders an idle state with its action button", () => {
    const onClick = vi.fn()
    const { container } = render(
      <PublicPageState classes={CLASSES} title="Offline" action={{ label: "Retry", onClick }}>
        No connection
      </PublicPageState>,
    )
    expect(container.querySelector("main")!.hasAttribute("aria-busy")).toBe(false)
    expect(container.querySelector("svg")!.getAttribute("class") ?? "").not.toContain("x-spin")
    const retry = screen.getByRole("button", { name: "Retry" })
    expect(retry.className).toBe("x-button")
    fireEvent.click(retry)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
