import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import type { UserDTO } from "@civfix/shared"

const updateSettings = vi.fn<(...args: unknown[]) => unknown>()

vi.mock("@/lib/api", () => ({
  api: { updateSettings: (...args: unknown[]) => updateSettings(...args) },
}))

import { LOCALE_STORAGE_KEY, useResolvedLocale } from "@/lib/locale"
import { useAuthStore } from "@/store/auth-store"

const USER: UserDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Ada",
  role: "citizen",
  locale: "en",
  createdAt: "2026-01-01T00:00:00.000Z",
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  window.localStorage.clear()
  updateSettings.mockReset()
  useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf", roles: ["citizen"] })
})

afterEach(() => {
  useAuthStore.getState().clear()
})

describe("useResolvedLocale server sync", () => {
  it("retries a failed locale PATCH on the user's next confirmed session", async () => {
    updateSettings.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    const first = renderHook(() => useResolvedLocale())
    await act(async () => {
      first.result.current.setLocale("es")
      await flush()
    })
    expect(updateSettings).toHaveBeenCalledTimes(1)
    first.unmount()

    updateSettings.mockResolvedValueOnce({})
    useAuthStore.getState().setSession({ user: USER, csrfToken: "csrf", roles: ["citizen"] })
    const second = renderHook(() => useResolvedLocale())
    await act(async () => {
      await flush()
    })
    expect(updateSettings).toHaveBeenCalledTimes(2)
    expect(updateSettings).toHaveBeenLastCalledWith({ locale: "es" })
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("es")
    second.unmount()

    const third = renderHook(() => useResolvedLocale())
    await act(async () => {
      await flush()
    })
    expect(updateSettings).toHaveBeenCalledTimes(2)
    third.unmount()
  })

  it("never pushes this browser's stored choice onto a different account", async () => {
    updateSettings.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    const first = renderHook(() => useResolvedLocale())
    await act(async () => {
      first.result.current.setLocale("de")
      await flush()
    })
    first.unmount()

    useAuthStore.getState().setSession({
      user: { ...USER, id: "22222222-2222-4222-8222-222222222222" },
      csrfToken: "csrf",
      roles: ["citizen"],
    })
    const second = renderHook(() => useResolvedLocale())
    await act(async () => {
      await flush()
    })
    expect(updateSettings).toHaveBeenCalledTimes(1)
    second.unmount()
  })
})
