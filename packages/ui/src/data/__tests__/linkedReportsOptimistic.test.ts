import { describe, expect, it } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import type { CleanupDTO, LinkedReportRef } from "@civfix/shared"
import { queryKeys } from "../keys"
import { updateCleanupMutationOptions, type UpdateCleanupVars } from "../hooks/cleanups"

const EVENT_ID = "11111111-2222-3333-4444-555555555555"

function ref(id: string, linkedAt = "2026-01-01T00:00:00.000Z"): LinkedReportRef {
  return {
    id,
    category: "trash",
    status: "published",
    title: `Report ${id}`,
    lat: 34.0522,
    lng: -118.2437,
    linkedAt,
  }
}

function cleanup(linkedReports: LinkedReportRef[], over: Partial<CleanupDTO> = {}): CleanupDTO {
  return {
    id: EVENT_ID,
    title: "Alley cleanup",
    type: "site",
    eventKind: "cleanup",
    lat: 34.0522,
    lng: -118.2437,
    scheduledAt: "2026-03-01T17:00:00.000Z",
    status: "upcoming",
    organizer: { id: "host", name: "Host", isFollowing: false },
    going: 3,
    joined: false,
    bring: [],
    address: null,
    slots: [],
    linkedReports,
    ...over,
  } as unknown as CleanupDTO
}

function seeded(linkedReports: LinkedReportRef[]): QueryClient {
  const qc = new QueryClient()
  qc.setQueryData<CleanupDTO>(queryKeys.cleanup(EVENT_ID), cleanup(linkedReports))
  return qc
}

function fnCtx(qc: QueryClient): { client: QueryClient; meta: undefined } {
  return { client: qc, meta: undefined }
}

function options(qc: QueryClient) {
  return updateCleanupMutationOptions(qc, async () => cleanup([]))
}

function linked(qc: QueryClient): string[] {
  return (qc.getQueryData<CleanupDTO>(queryKeys.cleanup(EVENT_ID))?.linkedReports ?? []).map(
    (r) => r.id,
  )
}

const SAVE_LINKS: UpdateCleanupVars = {
  id: EVENT_ID,
  patch: { linkedReportIds: ["b"] },
  linkedReports: [ref("b")],
}

describe("linked-report saves are optimistic inside the mutation, not before it", () => {
  it("writes the refs the picker built into the detail cache during onMutate", async () => {
    const qc = seeded([ref("a")])
    const opts = options(qc)

    await opts.onMutate?.({ ...SAVE_LINKS }, fnCtx(qc))

    expect(linked(qc)).toEqual(["b"])
  })

  it("snapshots the PRE-mutation refs, so a failure restores what the server still has", async () => {
    const qc = seeded([ref("a")])
    const opts = options(qc)

    const ctx = await opts.onMutate?.({ ...SAVE_LINKS }, fnCtx(qc))
    expect(linked(qc)).toEqual(["b"])

    opts.onError?.(new Error("offline"), { ...SAVE_LINKS }, ctx as never, fnCtx(qc))

    expect(linked(qc)).toEqual(["a"])
  })

  it("leaves the linked refs untouched when the caller sends none", async () => {
    const qc = seeded([ref("a")])
    const opts = options(qc)

    await opts.onMutate?.({ id: EVENT_ID, patch: { title: "New title" } }, fnCtx(qc))

    expect(linked(qc)).toEqual(["a"])
    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup(EVENT_ID))?.title).toBe("New title")
  })

  it("replaces the optimistic refs with the server's own on success", async () => {
    const qc = seeded([ref("a")])
    const opts = options(qc)

    const ctx = await opts.onMutate?.({ ...SAVE_LINKS }, fnCtx(qc))
    opts.onSuccess?.(cleanup([ref("b"), ref("c")]), { ...SAVE_LINKS }, ctx as never, fnCtx(qc))

    expect(linked(qc)).toEqual(["b", "c"])
  })
})
