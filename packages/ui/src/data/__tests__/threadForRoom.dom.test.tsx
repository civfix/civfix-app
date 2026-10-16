import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import type { ListThreadsResponse, MessageThreadDTO, RoomKind, UserDTO } from "@civfix/contract"
import type { ApiClient } from "@civfix/contract/client"
import { ApiProvider } from "../context"
import { makeFakeDataContext } from "../fakes"
import { useThreadForRoom, useThreads } from "../hooks/chat"

const SHARED_ID = "11111111-1111-4111-8111-111111111111"

const thread = (id: string, kind: RoomKind): MessageThreadDTO =>
  ({ id, kind, refId: SHARED_ID, unread: 0 }) as unknown as MessageThreadDTO

// Room ids are unique per kind only: a group and a report can front the same id, and the group row comes
// first so an id-only lookup would hand the report room the group's thread.
const THREADS: ListThreadsResponse = {
  items: [thread("t-group", "group"), thread("t-report", "report")],
  nextCursor: null,
} as unknown as ListThreadsResponse

function renderLookup(roomKind: RoomKind) {
  const api = { listThreads: vi.fn(async () => THREADS) }
  const context = makeFakeDataContext({
    api: api as unknown as ApiClient,
    auth: { isAuthenticated: true, user: { id: "u-me" } as unknown as UserDTO },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={context}>{children}</ApiProvider>
    </QueryClientProvider>
  )
  return renderHook(
    () => ({ thread: useThreadForRoom(roomKind, SHARED_ID), loaded: useThreads().data !== undefined }),
    { wrapper },
  )
}

describe("useThreadForRoom", () => {
  it("returns the thread of the requested room kind when two kinds share a room id", async () => {
    const { result } = renderLookup("report")
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.thread?.id).toBe("t-report")
  })

  it("returns nothing for a kind no loaded thread has, even when the id matches", async () => {
    const { result } = renderLookup("cleanup")
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.thread).toBeUndefined()
  })
})
