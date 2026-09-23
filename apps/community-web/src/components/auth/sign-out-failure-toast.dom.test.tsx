import * as React from "react"
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const show = vi.fn()
const retrySignOut = vi.fn()

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})
vi.mock("@civfix/ui", () => ({ useToast: () => ({ show }) }))
vi.mock("@/hooks/use-auth", () => ({ retrySignOut: () => retrySignOut() }))

const { SignOutFailureToast } = await import("./sign-out-failure-toast")
const { useSignOutRetryStore } = await import("@/store/sign-out-retry-store")

beforeEach(() => {
  show.mockReset()
  retrySignOut.mockReset()
  useSignOutRetryStore.setState({ failures: 0, csrfToken: null })
})

afterEach(() => {
  cleanup()
})

describe("SignOutFailureToast", () => {
  it("stays silent until a sign-out fails", () => {
    render(<SignOutFailureToast />)
    expect(show).not.toHaveBeenCalled()
  })

  it("tells the user the sign-out failed and offers a retry, once per failed attempt", () => {
    render(<SignOutFailureToast />)

    act(() => useSignOutRetryStore.getState().fail("csrf-a"))
    expect(show).toHaveBeenCalledTimes(1)
    const [message, options] = show.mock.calls[0]!
    expect(message).toBe("sign_out_failed.message")
    expect(options).toMatchObject({ variant: "error", action: { label: "sign_out_failed.retry" } })

    options.action.onPress()
    expect(retrySignOut).toHaveBeenCalledTimes(1)

    act(() => useSignOutRetryStore.getState().fail("csrf-a"))
    expect(show).toHaveBeenCalledTimes(2)
  })
})
