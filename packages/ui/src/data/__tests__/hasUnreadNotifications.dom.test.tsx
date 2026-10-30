import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { NotificationUnreadResponse, UserDTO } from "@civfix/contract"
import type { ApiClient } from "@civfix/contract/client"
import { ApiProvider } from "../context"
import { makeFakeDataContext } from "../fakes"
import { useHasUnreadNotifications } from "../hooks/notifications"
import { invalidationKeysForTopic } from "../signals"

const ME = { id: "u-me", displayName: "Mia Me" } as unknown as UserDTO

function renderUnread({
  signedIn = true,
  getNotificationUnread,
}: {
  signedIn?: boolean
  getNotificationUnread: ReturnType<typeof vi.fn>
}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const context = makeFakeDataContext({
    api: { getNotificationUnread } as unknown as ApiClient,
    auth: signedIn ? { isAuthenticated: true, user: ME, isPending: false } : {},
  })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={context}>{children}</ApiProvider>
    </QueryClientProvider>
  )
  const hook = renderHook(() => useHasUnreadNotifications(), { wrapper })
  return { ...hook, queryClient }
}

const answer = (hasUnread: boolean) =>
  vi.fn(async (): Promise<NotificationUnreadResponse> => ({ hasUnread }))

describe("GH#226 useHasUnreadNotifications", () => {
  it("T4: reads the server's hasUnread when signed in, and never asks while signed out", async () => {
    const unread = renderUnread({ getNotificationUnread: answer(true) })
    await waitFor(() => expect(unread.result.current).toBe(true))
    unread.unmount()

    const read = answer(false)
    const caughtUp = renderUnread({ getNotificationUnread: read })
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1))
    await act(() => new Promise((r) => setTimeout(r, 20)))
    expect(caughtUp.result.current).toBe(false)
    caughtUp.unmount()

    const signedOutCall = answer(true)
    const signedOut = renderUnread({ signedIn: false, getNotificationUnread: signedOutCall })
    await act(() => new Promise((r) => setTimeout(r, 20)))
    expect(signedOut.result.current).toBe(false)
    expect(signedOutCall).not.toHaveBeenCalled()
  })

  it("T5: follows the notifications signal's invalidation without remounting", async () => {
    let hasUnread = true
    const getNotificationUnread = vi.fn(async (): Promise<NotificationUnreadResponse> => ({
      hasUnread,
    }))
    const { result, queryClient } = renderUnread({ getNotificationUnread })
    await waitFor(() => expect(result.current).toBe(true))

    hasUnread = false
    await act(async () => {
      for (const queryKey of invalidationKeysForTopic("notifications")) {
        await queryClient.invalidateQueries({ queryKey })
      }
    })
    await waitFor(() => expect(result.current).toBe(false))
    expect(getNotificationUnread).toHaveBeenCalledTimes(2)
  })
})
