import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type * as ApiModule from "@/lib/api"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"

const otpRequest = vi.fn<(...args: unknown[]) => unknown>()
const otpVerify = vi.fn<(...args: unknown[]) => unknown>()

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  API_BASE_URL: "http://api.test",
  api: {
    otpRequest: (...args: unknown[]) => otpRequest(...args),
    otpVerify: (...args: unknown[]) => otpVerify(...args),
  },
}))

vi.mock("@/hooks/use-auth", () => ({ useRefreshSession: () => async () => true }))

import { AuthModal } from "@/components/auth/auth-modal"
import { useUiStore } from "@/store/ui-store"

function cells(): HTMLInputElement[] {
  return screen.getAllByLabelText(/^code\.digit_aria_label/) as HTMLInputElement[]
}

async function openAtCodeStep() {
  render(<AuthModal />)
  act(() => useUiStore.getState().setAuthModalOpen(true))
  fireEvent.click(screen.getByText("choices.continue_email"))
  fireEvent.change(screen.getByLabelText("email.aria_label"), { target: { value: "a@b.co" } })
  await act(async () => {
    fireEvent.click(screen.getByText("email.submit"))
  })
}

beforeEach(() => {
  otpRequest.mockReset().mockResolvedValue({ resendAfterSec: 30 })
  otpVerify.mockReset()
})

afterEach(() => {
  act(() => useUiStore.getState().setAuthModalOpen(false))
  cleanup()
})

describe("AuthModal one-time code", () => {
  it("keeps each digit in its own cell when a middle cell is cleared", async () => {
    await openAtCodeStep()
    "12345".split("").forEach((digit, i) => fireEvent.change(cells()[i]!, { target: { value: digit } }))
    fireEvent.change(cells()[2]!, { target: { value: "" } })
    expect(cells().map((cell) => cell.value)).toEqual(["1", "2", "", "4", "5", ""])
    expect(otpVerify).not.toHaveBeenCalled()
  })

  it("verifies the code the moment the sixth digit lands, with no deferred timer", async () => {
    otpVerify.mockReturnValue(new Promise(() => {}))
    await openAtCodeStep()
    "123456".split("").forEach((digit, i) => fireEvent.change(cells()[i]!, { target: { value: digit } }))
    expect(otpVerify).toHaveBeenCalledWith({ email: "a@b.co", code: "123456" })
  })

  it("returns focus to the first cell after a wrong code", async () => {
    otpVerify.mockRejectedValue(Object.assign(new Error("bad"), { name: "AppError", code: "UNAUTHORIZED" }))
    await openAtCodeStep()
    await act(async () => {
      "123456".split("").forEach((digit, i) => fireEvent.change(cells()[i]!, { target: { value: digit } }))
    })
    expect(cells().every((cell) => cell.value === "" && !cell.disabled)).toBe(true)
    expect(document.activeElement).toBe(cells()[0])
  })
})

describe("AuthModal focus management", () => {
  it("moves focus into the dialog, keeps Tab inside it, and restores the opener on close", () => {
    render(
      <>
        <button type="button">opener</button>
        <AuthModal />
      </>,
    )
    const opener = screen.getByText("opener")
    opener.focus()
    act(() => useUiStore.getState().setAuthModalOpen(true))

    const dialog = screen.getByRole("dialog")
    expect(dialog.contains(document.activeElement)).toBe(true)

    const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button:not([disabled])"))
    const last = buttons[buttons.length - 1]!
    last.focus()
    fireEvent.keyDown(last, { key: "Tab" })
    expect(document.activeElement).toBe(buttons[0])

    act(() => useUiStore.getState().setAuthModalOpen(false))
    expect(document.activeElement).toBe(opener)
  })
})

describe("AuthModal OAuth return", () => {
  const assign = vi.fn<(url: string) => void>()

  beforeEach(() => {
    assign.mockReset()
    vi.stubGlobal("location", { origin: "https://civfix.test", assign })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function startGoogle(): string {
    fireEvent.click(screen.getByText("choices.continue_google"))
    expect(assign).toHaveBeenCalledTimes(1)
    return new URL(assign.mock.calls[0]![0]).searchParams.get("redirect") ?? ""
  }

  it("comes back to the return path of the gated action that opened it", () => {
    render(<AuthModal />)
    act(() => useUiStore.getState().openAuthModalReturningTo("/report"))
    expect(startGoogle()).toBe("https://civfix.test/report")
  })

  it("comes back to the site root when a plain open follows one with a return path", () => {
    render(<AuthModal />)
    act(() => useUiStore.getState().openAuthModalReturningTo("/report"))
    act(() => useUiStore.getState().setAuthModalOpen(false))
    act(() => useUiStore.getState().openAuthModal())
    expect(startGoogle()).toBe("https://civfix.test")
  })

  it("ignores a requested return path the allowlist does not accept", () => {
    render(<AuthModal />)
    act(() => useUiStore.getState().openAuthModalReturningTo("/notifications"))
    expect(startGoogle()).toBe("https://civfix.test")
  })

  it("keeps the surface's own return path over the gated action's", () => {
    render(<AuthModal oauthReturnPath="/manage/org-invites/accept/" />)
    act(() => useUiStore.getState().openAuthModalReturningTo("/report"))
    expect(startGoogle()).toBe("https://civfix.test/manage/org-invites/accept/")
  })
})
