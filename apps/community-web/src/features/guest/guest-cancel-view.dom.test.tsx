import * as React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type * as ApiModule from "@/lib/api"
import { AppError, ErrorCode, GUEST_MANAGE_TOKEN_MIN_LENGTH } from "@civfix/contract"

const guestRsvpCancel = vi.fn<(...args: unknown[]) => unknown>()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: () => {}, push: () => {} }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}))
vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})
vi.mock("@/components/detail-shell", () => ({
  DetailShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  api: { guestRsvpCancel: (...args: unknown[]) => guestRsvpCancel(...args) },
}))

const { GuestCancelView } = await import("./guest-cancel-view")

const TOKEN = "t".repeat(GUEST_MANAGE_TOKEN_MIN_LENGTH)

beforeEach(() => {
  window.history.replaceState(null, "", "/guest/")
  guestRsvpCancel.mockReset()
})

afterEach(() => {
  cleanup()
})

describe("GuestCancelView page heading", () => {
  it("titles the invalid link page with a level-one heading", () => {
    render(<GuestCancelView />)
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("invalid.title")
  })

  it("titles the failed cancellation page with a level-one heading", async () => {
    window.history.replaceState(null, "", `/guest/?token=${TOKEN}`)
    guestRsvpCancel.mockRejectedValueOnce(new AppError(ErrorCode.NOT_FOUND, "gone"))
    render(<GuestCancelView />)
    await act(async () => {
      fireEvent.click(screen.getByText("confirm.cancel"))
    })
    expect(screen.getByText("error.notFound")).toBeTruthy()
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("error.title")
  })
})
