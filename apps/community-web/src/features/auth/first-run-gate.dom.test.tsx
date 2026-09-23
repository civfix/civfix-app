import * as React from "react"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { UserDTO } from "@civfix/shared"

import type * as ApiModule from "@/lib/api"

const logout = vi.fn()

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})
vi.mock("@civfix/ui", () => ({
  Avatar: () => null,
  AgeConfirmation: () => null,
  TermsConfirmation: () => null,
}))
vi.mock("@/hooks/use-profile-registration", () => ({
  useFirstRunRequired: () => true,
  useHandleAvailability: () => ({ data: undefined, isFetching: false }),
  useUpdateProfile: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
}))
vi.mock("@/hooks/use-visual-viewport-shift", () => ({ useVisualViewportShift: () => 0 }))
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  api: { logout: (...args: unknown[]) => logout(...args) },
}))

const { FirstRunGate } = await import("./first-run-gate")
const { SignOutFailureNotice } = await import("@/components/auth/sign-out-failure-notice")
const { Z_SESSION_ALERT } = await import("@/styles/z-layers")
const { useAuthStore } = await import("@/store/auth-store")
const { useSignOutRetryStore } = await import("@/store/sign-out-retry-store")

const NEW_USER: UserDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Ada Lovelace",
  handle: "ada",
  role: "citizen",
  locale: "en",
  profileComplete: false,
  createdAt: "2026-01-01T00:00:00.000Z",
}

function renderAppLayers(): void {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <div>
        <FirstRunGate />
        <SignOutFailureNotice />
      </div>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  logout.mockReset()
  window.localStorage.clear()
  useSignOutRetryStore.setState({ pending: false, failed: false })
  useAuthStore.getState().setSession({ user: NEW_USER, csrfToken: "csrf-a" })
})

afterEach(() => {
  cleanup()
  useAuthStore.getState().clear()
})

describe("a failed sign-out from the first-run gate", () => {
  it("shows its notice above the full-screen gate, with the retry reachable", async () => {
    logout.mockRejectedValue(new TypeError("Failed to fetch"))
    renderAppLayers()
    const gate = screen.getByRole("dialog")

    await act(async () => {
      fireEvent.click(within(gate).getByRole("button", { name: "sign_out" }))
    })

    const notice = await screen.findByRole("alert")
    expect(gate.contains(notice)).toBe(false)
    expect(notice.parentElement).toBe(document.body)
    expect(notice.className).toContain("z-session-alert")
    expect(Z_SESSION_ALERT).toBeGreaterThan(Number(gate.style.zIndex))

    const retry = within(notice).getByRole("button", { name: "sign_out_failed.retry" }) as HTMLButtonElement
    expect(retry.disabled).toBe(false)
    await act(async () => {
      fireEvent.click(retry)
    })
    expect(logout).toHaveBeenCalledTimes(2)
  })
})
