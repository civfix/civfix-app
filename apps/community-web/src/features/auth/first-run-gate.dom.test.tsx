import * as React from "react"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { UserDTO } from "@civfix/shared"

import type * as ApiModule from "@/lib/api"

const logout = vi.fn()
const mutate = vi.fn()

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})
vi.mock("@civfix/ui", () => ({
  Avatar: () => null,
  AgeConfirmation: ({ onConfirmedChange }: { onConfirmedChange: (v: boolean) => void }) => (
    <input type="checkbox" aria-label="age" onChange={(e) => onConfirmedChange(e.target.checked)} />
  ),
  TermsConfirmation: ({ onConfirmedChange }: { onConfirmedChange: (v: boolean) => void }) => (
    <input type="checkbox" aria-label="terms" onChange={(e) => onConfirmedChange(e.target.checked)} />
  ),
}))
vi.mock("@/hooks/use-profile-registration", () => ({
  useFirstRunRequired: () => true,
  useHandleAvailability: () => ({ data: { available: true }, isFetching: false }),
  useUpdateProfile: () => ({ mutate, isPending: false, isError: false, error: null }),
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

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient()
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

function renderAppLayers(): void {
  renderWithQuery(
    <div>
      <FirstRunGate />
      <SignOutFailureNotice />
    </div>,
  )
}

function fillValid(first: string, last: string) {
  fireEvent.change(screen.getByLabelText("first_name_label"), { target: { value: first } })
  fireEvent.change(screen.getByLabelText("last_name_label"), { target: { value: last } })
  fireEvent.change(screen.getByLabelText("username_label"), { target: { value: "ada_l" } })
  fireEvent.click(screen.getByLabelText("age"))
  fireEvent.click(screen.getByLabelText("terms"))
}

beforeEach(() => {
  logout.mockReset()
  mutate.mockReset()
  window.localStorage.clear()
  useSignOutRetryStore.setState({ pending: false, failed: false })
  useAuthStore.getState().setSession({ user: NEW_USER, csrfToken: "csrf-a" })
})

afterEach(() => {
  cleanup()
  useAuthStore.getState().clear()
})

describe("FirstRunGate display name", () => {
  it("caps the two name fields so first + space + last fits the server's 80-char display name", () => {
    renderWithQuery(<FirstRunGate />)
    const first = screen.getByLabelText("first_name_label") as HTMLInputElement
    const last = screen.getByLabelText("last_name_label") as HTMLInputElement
    expect(first.maxLength + 1 + last.maxLength).toBeLessThanOrEqual(80)
  })

  it("never submits a display name the server would reject as too long", () => {
    renderWithQuery(<FirstRunGate />)
    fillValid("a".repeat(50), "b".repeat(35))
    const submit = screen.getByText("continue").closest("button")!
    expect(submit.disabled).toBe(true)
    fireEvent.click(submit)
    expect(mutate).not.toHaveBeenCalled()
  })
})

describe("FirstRunGate as a blocking dialog", () => {
  it("makes the app behind it inert and moves focus into the dialog, then restores both", () => {
    const { unmount } = renderWithQuery(
      <div>
        <button type="button">behind</button>
        <FirstRunGate />
      </div>,
    )
    const behind = screen.getByText("behind")
    expect(behind.hasAttribute("inert")).toBe(true)
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true)
    unmount()
    expect(behind.hasAttribute("inert")).toBe(false)
  })

  it("announces handle availability changes politely", () => {
    renderWithQuery(<FirstRunGate />)
    const hint = document.getElementById("fr-handle-hint")!
    expect(hint.getAttribute("aria-live")).toBe("polite")
  })
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

  it("keeps a notice already on screen when the gate opens out of the gate's inert layer", () => {
    useSignOutRetryStore.setState({ failed: true })
    renderAppLayers()

    const notice = screen.getByRole("alert")
    expect(notice.hasAttribute("inert")).toBe(false)
  })
})
