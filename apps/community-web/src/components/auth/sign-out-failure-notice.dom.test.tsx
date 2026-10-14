import * as React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const logout = vi.fn()

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})
vi.mock("@/hooks/use-auth", () => ({ useLogout: () => logout }))

const { SignOutFailureNotice } = await import("./sign-out-failure-notice")
const { useSignOutRetryStore } = await import("@/store/sign-out-retry-store")

beforeEach(() => {
  logout.mockReset()
  useSignOutRetryStore.setState({ pending: false, failed: false })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("SignOutFailureNotice", () => {
  it("stays hidden until a sign-out fails", () => {
    render(<SignOutFailureNotice />)
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("stays up until the user acts on it, and its retry re-runs the normal sign-out", () => {
    vi.useFakeTimers()
    render(<SignOutFailureNotice />)

    act(() => useSignOutRetryStore.setState({ failed: true }))
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByRole("alert").textContent).toContain("sign_out_failed.message")

    fireEvent.click(screen.getByRole("button", { name: "sign_out_failed.retry" }))
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it("disables the retry while a sign-out is in flight", () => {
    useSignOutRetryStore.setState({ failed: true, pending: true })
    render(<SignOutFailureNotice />)

    const retry = screen.getByRole("button", { name: "sign_out_failed.retry" }) as HTMLButtonElement
    expect(retry.disabled).toBe(true)
  })

  it("can be dismissed, which leaves the user signed in", () => {
    useSignOutRetryStore.setState({ failed: true })
    render(<SignOutFailureNotice />)

    fireEvent.click(screen.getByRole("button", { name: "close" }))
    expect(screen.queryByRole("alert")).toBeNull()
    expect(logout).not.toHaveBeenCalled()
  })
})
