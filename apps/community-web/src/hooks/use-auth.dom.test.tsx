import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query"

vi.mock("@/lib/api", () => ({
  api: {
    session: vi.fn(async () => ({
      authenticated: true,
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        displayName: "Ada Lovelace",
        handle: "ada",
        role: "citizen",
        locale: "en",
        profileComplete: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      roles: [],
      enabledProviders: ["email"],
    })),
  },
}))

import { useRefreshSession } from "@/hooks/use-auth"

describe("useRefreshSession", () => {
  it("invalidates the viewer-flagged post families when the identity changes", async () => {
    const client = new QueryClient()
    client.setQueryData(queryKeys.post("p1"), { id: "p1", likedByMe: false })
    client.setQueryData(queryKeys.homeFeed("all", "public"), { items: [] })
    client.setQueryData(queryKeys.mapReports(null, []), { pins: [] })
    client.setQueryData(queryKeys.report("r1"), { id: "r1" })
    client.setQueryData(queryKeys.cleanupAttendees("c1"), { items: [] })
    client.setQueryData(queryKeys.chatHistory("room", "group"), { messages: [] })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useRefreshSession(), { wrapper })

    await act(async () => {
      await result.current()
    })

    expect(client.getQueryState(queryKeys.post("p1"))?.isInvalidated).toBe(true)
    expect(client.getQueryState(queryKeys.homeFeed("all", "public"))?.isInvalidated).toBe(true)
    expect(client.getQueryState(queryKeys.mapReports(null, []))?.isInvalidated).toBe(false)
    expect(client.getQueryState(queryKeys.report("r1"))?.isInvalidated).toBe(true)
    expect(client.getQueryState(queryKeys.cleanupAttendees("c1"))?.isInvalidated).toBe(true)
    expect(client.getQueryState(queryKeys.chatHistory("room", "group"))?.isInvalidated).toBe(true)
  })
})
