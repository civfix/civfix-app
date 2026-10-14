import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen } from "@testing-library/react"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "./__testing__/harness"
import { LoadingState } from "./states"

afterEach(cleanup)

describe("LoadingState", () => {
  it("says loading once instead of naming the region with the same words", () => {
    renderConsole(<LoadingState />, { withToasts: false })
    const status = screen.getByRole("status")
    expect(status.hasAttribute("aria-label")).toBe(false)
    expect(status.textContent).toBe("state.loading")
  })
})
