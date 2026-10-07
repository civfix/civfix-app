import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

const back = vi.fn()
const push = vi.fn()

vi.mock("next/navigation", () => ({ useRouter: () => ({ back, push }) }))
vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { DetailShell } from "@/components/detail-shell"

function setReferrer(value: string) {
  Object.defineProperty(document, "referrer", { configurable: true, get: () => value })
}

function pressBack() {
  window.history.pushState(null, "", "/claim/")
  render(<DetailShell>content</DetailShell>)
  fireEvent.click(screen.getByText("detail.back"))
}

afterEach(() => {
  cleanup()
  back.mockReset()
  push.mockReset()
})

describe("DetailShell Back", () => {
  it("returns to the map instead of leaving civfix when the visitor arrived from another site", () => {
    setReferrer("https://mail.example.com/inbox")
    pressBack()
    expect(back).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith("/")
  })

  it("steps back through history when the previous page was civfix", () => {
    setReferrer(`${window.location.origin}/`)
    pressBack()
    expect(back).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()
  })
})
