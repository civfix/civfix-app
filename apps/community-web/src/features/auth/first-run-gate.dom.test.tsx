import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

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

vi.mock("@/hooks/use-auth", () => ({
  useCurrentUser: () => ({ id: "u1", displayName: "", avatarUrl: null }),
  useLogout: () => async () => {},
}))

vi.mock("@/hooks/use-profile-registration", () => ({
  useFirstRunRequired: () => true,
  useHandleAvailability: () => ({ data: { available: true }, isFetching: false }),
  useUpdateProfile: () => ({ mutate, isPending: false, isError: false, error: null }),
}))

import { FirstRunGate } from "@/features/auth/first-run-gate"

afterEach(() => {
  cleanup()
  mutate.mockReset()
})

function fillValid(first: string, last: string) {
  fireEvent.change(screen.getByLabelText("first_name_label"), { target: { value: first } })
  fireEvent.change(screen.getByLabelText("last_name_label"), { target: { value: last } })
  fireEvent.change(screen.getByLabelText("username_label"), { target: { value: "ada_l" } })
  fireEvent.click(screen.getByLabelText("age"))
  fireEvent.click(screen.getByLabelText("terms"))
}

describe("FirstRunGate display name", () => {
  it("caps the two name fields so first + space + last fits the server's 80-char display name", () => {
    render(<FirstRunGate />)
    const first = screen.getByLabelText("first_name_label") as HTMLInputElement
    const last = screen.getByLabelText("last_name_label") as HTMLInputElement
    expect(first.maxLength + 1 + last.maxLength).toBeLessThanOrEqual(80)
  })

  it("never submits a display name the server would reject as too long", () => {
    render(<FirstRunGate />)
    fillValid("a".repeat(50), "b".repeat(35))
    const submit = screen.getByText("continue").closest("button")!
    expect(submit.disabled).toBe(true)
    fireEvent.click(submit)
    expect(mutate).not.toHaveBeenCalled()
  })
})

describe("FirstRunGate as a blocking dialog", () => {
  it("makes the app behind it inert and moves focus into the dialog, then restores both", () => {
    const { unmount } = render(
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
    render(<FirstRunGate />)
    const hint = document.getElementById("fr-handle-hint")!
    expect(hint.getAttribute("aria-live")).toBe("polite")
  })
})
