/**
 * `useTotalUnread` drives the Messaging dot on both map homes (mobile's `app/index`, web's
 * `WebMapControls`). With no React renderer here, the suite drives its `select` (`sumThreadUnread`) and
 * the key/page-size policy it is built on:
 *   - the badge sums ONE page of /threads and survives a drifted envelope (the client does not validate
 *     responses, and this hook renders inside an always-mounted control stack);
 *   - the badge must NOT live on the `["threads"]` inbox key itself (an always-active observer there makes
 *     React Query refetch every loaded page of the INFINITE inbox on each invalidation), yet it sits UNDER
 *     that prefix so one ack or realtime signal refreshes badge and list together.
 */
import { describe, expect, it } from "vitest"
import type { ListThreadsResponse, MessageThreadDTO } from "@civfix/shared"
import { queryKeys } from "../../keys"
import { invalidationKeysForTopic } from "../../signals"
import { UNREAD_BADGE_PAGE_SIZE, sumThreadUnread } from "../chat"

/** A minimal MessageThreadDTO - only `unread` matters to the badge. */
function thread(id: string, unread: number): MessageThreadDTO {
  return {
    id,
    kind: "dm",
    title: `Thread ${id}`,
    unread,
    members: 2,
    lastFromMe: false,
    muted: false,
  } as MessageThreadDTO
}

function page(items: MessageThreadDTO[], nextCursor: string | null = null): ListThreadsResponse {
  return { items, nextCursor } as unknown as ListThreadsResponse
}

/** True when `prefix` is a leading sub-array of `key` (how React Query matches a partial queryKey). */
function isPrefixOf(prefix: readonly unknown[], key: readonly unknown[]): boolean {
  if (prefix.length > key.length) return false
  return prefix.every((part, i) => Object.is(part, key[i]))
}

describe("sumThreadUnread", () => {
  it("totals the unread counters across the page", () => {
    expect(sumThreadUnread(page([thread("a", 3), thread("b", 0), thread("c", 12)]))).toBe(15)
  })

  it("is 0 for an empty inbox", () => {
    expect(sumThreadUnread(page([]))).toBe(0)
  })

  it("is 0 while the query has not resolved (signed out / first paint)", () => {
    expect(sumThreadUnread(undefined)).toBe(0)
  })

  it("survives a drifted envelope with no `items` array instead of crashing the control stack", () => {
    expect(sumThreadUnread({} as ListThreadsResponse)).toBe(0)
    expect(sumThreadUnread({ items: null } as unknown as ListThreadsResponse)).toBe(0)
  })

  it("skips null rows and threads whose `unread` an older server omitted", () => {
    const items = [thread("a", 4), null, { id: "b" }] as unknown as MessageThreadDTO[]
    expect(sumThreadUnread(page(items))).toBe(4)
  })

  it("counts one page only (the hook fetches exactly UNREAD_BADGE_PAGE_SIZE threads)", () => {
    expect(UNREAD_BADGE_PAGE_SIZE).toBe(20)
    // A further cursor is irrelevant to the badge: it never paginates.
    const items = Array.from({ length: UNREAD_BADGE_PAGE_SIZE }, (_, i) => thread(`t${i}`, 1))
    expect(sumThreadUnread(page(items, "cursor-2"))).toBe(UNREAD_BADGE_PAGE_SIZE)
  })
})

describe("useTotalUnread cache key", () => {
  it("is NOT the infinite inbox key, so the always-mounted badge never keeps that query active", () => {
    expect(queryKeys.threadsUnread).not.toEqual(queryKeys.threads)
  })

  it("sits UNDER ['threads'], so an ack / DM mutation refreshes badge and inbox together", () => {
    expect(isPrefixOf(queryKeys.threads, queryKeys.threadsUnread)).toBe(true)
  })

  it("is invalidated by the realtime `threads` signal", () => {
    const keys = invalidationKeysForTopic("threads")
    expect(keys.some((k) => isPrefixOf(k, queryKeys.threadsUnread))).toBe(true)
  })
})
