/**
 * The blocked-accounts list must page GET /me/blocks by cursor: the server returns 50 rows by default, so
 * reading only the first page leaves anyone past the 50th block impossible to see or unblock in-app.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import type { ListBlocksResponse, PersonDTO } from "@civfix/shared"
import type { ApiClient } from "@civfix/shared/client"
import { blockedAccountsOf, listBlocksQueryOptions } from "../direct"
import { queryKeys } from "../../keys"

function person(id: string): PersonDTO {
  return { id, name: `Person ${id}`, avatar: null, followers: 0, following: 0, isFollowing: false } as unknown as PersonDTO
}

function fakeApi(pages: Record<string, ListBlocksResponse>) {
  const calls: Array<{ cursor?: string }> = []
  const api = {
    listBlocks: async (req: { cursor?: string }) => {
      calls.push(req)
      return pages[req.cursor ?? "first"]!
    },
  } as unknown as ApiClient
  return { api, calls }
}

describe("listBlocksQueryOptions", () => {
  it("pages past the first response by its nextCursor and stops when the cursor is absent", async () => {
    const { api, calls } = fakeApi({
      first: { blocked: [person("a"), person("b")], nextCursor: "c2" },
      c2: { blocked: [person("c")], nextCursor: null },
    })
    const qc = new QueryClient()
    const data = await qc.fetchInfiniteQuery({ ...listBlocksQueryOptions(api), pages: 3 })
    expect(calls).toEqual([{}, { cursor: "c2" }])
    expect(blockedAccountsOf(data).map((p) => p.id)).toEqual(["a", "b", "c"])
  })

  it("stays under queryKeys.blocks so block/unblock invalidation refetches every page", () => {
    const { api } = fakeApi({})
    expect(listBlocksQueryOptions(api).queryKey).toEqual(queryKeys.blocks)
  })

  it("flattens nothing to an empty list while loading", () => {
    expect(blockedAccountsOf(undefined)).toEqual([])
  })
})

describe("BlockedAccountsBody", () => {
  const body = readFileSync(new URL("../../../bodies/BlockedAccountsBody.tsx", import.meta.url), "utf8")
  it("loads the next page at the end of the list and shows a footer spinner while it does", () => {
    expect(body).toContain("onEndReached={onEndReached}")
    expect(body).toContain("if (hasNextPage && !isFetchingNextPage) void fetchNextPage()")
    expect(body).toMatch(/ListFooterComponent=\{\s*isFetchingNextPage \?/)
  })
})
