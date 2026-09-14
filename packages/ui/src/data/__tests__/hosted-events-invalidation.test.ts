import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import { queryKeys } from "../keys"
import { invalidateHostedEventLists } from "../hooks/cleanups"

function code(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
}

const cleanupsSource = code("../hooks/cleanups.ts")
const hostSource = code("../hooks/host.ts")

function section(source: string, from: string, to: string): string {
  const start = source.indexOf(from)
  if (start === -1) throw new Error(`missing marker: ${from}`)
  const end = source.indexOf(to, start)
  if (end === -1) throw new Error(`missing marker: ${to}`)
  return source.slice(start, end)
}

const DASHBOARD_KEYS: readonly (readonly unknown[])[] = [
  queryKeys.hostedEvents("upcoming", null),
  queryKeys.hostedEvents("past", null),
  queryKeys.hostedEvents("upcoming", "org-1"),
  queryKeys.hostedEventsAnalytics("all", null),
  queryKeys.hostedEventsAnalytics("all", "org-1"),
  queryKeys.myProfile,
]

function seeded(): QueryClient {
  const qc = new QueryClient()
  for (const key of DASHBOARD_KEYS) qc.setQueryData(key as unknown[], { items: [] })
  qc.setQueryData([...queryKeys.threads], { items: [] })
  return qc
}

describe("invalidateHostedEventLists", () => {
  it("marks every dashboard family stale - personal list, org list, analytics and the profile", () => {
    const qc = seeded()

    invalidateHostedEventLists(qc)

    for (const key of DASHBOARD_KEYS) {
      expect(qc.getQueryState(key as unknown[])?.isInvalidated).toBe(true)
    }
  })

  it("keeps the invalidation scoped - unrelated families are left alone", () => {
    const qc = seeded()

    invalidateHostedEventLists(qc)

    expect(qc.getQueryState([...queryKeys.threads])?.isInvalidated).toBe(false)
  })

  it("leaves the cached rows in place so the refetch is a BACKGROUND one (no skeleton, no re-enter)", () => {
    const qc = seeded()

    invalidateHostedEventLists(qc)

    expect(qc.getQueryData([...queryKeys.hostedEvents("upcoming", null)])).toEqual({
      items: [],
    })
  })
})

describe("event mutations reach the host dashboard", () => {
  it("create invalidates the hosted-event lists, not just the map/org lists", () => {
    const fn = section(
      cleanupsSource,
      "export function useCreateCleanup",
      "export type DuplicateCleanupVars",
    )
    expect(fn).toContain("invalidateCleanupLists(qc)")
    expect(fn).toContain("invalidateHostedEventLists(qc)")
  })

  it("duplicate invalidates them through the shared helper, not an inline key", () => {
    const fn = section(
      cleanupsSource,
      "export function useDuplicateCleanup",
      "export interface UpdateCleanupVars",
    )
    expect(fn).toContain("invalidateHostedEventLists(qc)")
  })

  it("cancel invalidates them - a cancelled event must stop reading as next up", () => {
    const fn = section(
      cleanupsSource,
      "export function useCancelCleanup",
      "export interface ClaimEventSlotVars",
    )
    expect(fn).toContain("invalidateHostedEventLists(qc)")
  })

  it("edit invalidates them - the dashboard row carries the title, time and status", () => {
    const fn = section(
      cleanupsSource,
      "export function useUpdateCleanup",
      "export interface CancelCleanupVars",
    )
    expect(fn).toContain("invalidateHostedEventLists(qc)")
  })

  it("routes every hosted-events invalidation through the key factory - no string literals", () => {
    expect(cleanupsSource).not.toContain('"hosted-events"')
    expect(cleanupsSource).not.toContain("'hosted-events'")
  })
})

describe("useMyHostedEvents is never frozen shut", () => {
  const fn = section(hostSource, "export function useMyHostedEvents", "export function hostedEventRows")

  it("is keyed off the factory, so the root invalidation is a prefix match", () => {
    expect(fn).toContain("queryKey: queryKeys.hostedEvents(when, orgId)")
    expect(queryKeys.hostedEvents("upcoming", null).slice(0, 1)).toEqual([
      ...queryKeys.hostedEventsRoot,
    ])
  })

  it("carries no permanent freeze - an invalidation must be able to trigger a refetch", () => {
    expect(fn).not.toContain("staleTime: Infinity")
    expect(fn).not.toContain("refetchOnMount: false")
    expect(fn).not.toContain("refetchOnReconnect: false")
  })
})
