import { describe, expect, it } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import type { CleanupDTO, UpdateCleanupRequest } from "@civfix/shared"
import { queryKeys } from "../keys"

const CLEANUPS_LIST_PREFIX = ["cleanups"] as const

function cleanup(id: string, over: Partial<CleanupDTO> = {}): CleanupDTO {
  return {
    id,
    title: `Cleanup ${id}`,
    type: "site",
    eventKind: "cleanup",
    lat: 37.77,
    lng: -122.42,
    scheduledAt: new Date("2026-07-01T17:00:00.000Z").toISOString(),
    status: "upcoming",
    organizer: { id: "org", name: "Org", isFollowing: false } as CleanupDTO["organizer"],
    going: 3,
    joined: false,
    bring: [],
    address: "Old dock",
    description: "Old description",
    linkedReports: [],
    ...over,
  } as unknown as CleanupDTO
}

function scalarPatch(patch: Omit<UpdateCleanupRequest, "id">): Partial<CleanupDTO> {
  const out: Partial<CleanupDTO> = {}
  if (patch.title !== undefined) out.title = patch.title
  if (patch.description !== undefined) out.description = patch.description
  if (patch.eventKind !== undefined) out.eventKind = patch.eventKind
  if (patch.scheduledAt !== undefined) out.scheduledAt = patch.scheduledAt
  if (patch.lat !== undefined) out.lat = patch.lat
  if (patch.lng !== undefined) out.lng = patch.lng
  if (patch.address !== undefined) out.address = patch.address
  if (patch.bring !== undefined) out.bring = patch.bring
  return out
}

function onMutate(qc: QueryClient, id: string, patch: Omit<UpdateCleanupRequest, "id">): { prevDetail?: CleanupDTO } {
  const prevDetail = qc.getQueryData<CleanupDTO>(queryKeys.cleanup(id))
  const sp = scalarPatch(patch)
  if (prevDetail) qc.setQueryData<CleanupDTO>(queryKeys.cleanup(id), { ...prevDetail, ...sp })
  qc.setQueriesData<CleanupDTO[]>({ queryKey: CLEANUPS_LIST_PREFIX }, (prev) =>
    Array.isArray(prev) ? prev.map((c) => (c.id === id ? { ...c, ...sp } : c)) : prev,
  )
  return { prevDetail }
}

describe("cleanup edit (PATCH) cache reconciliation", () => {
  it("optimistically merges scalars onto the detail and the matching list row", () => {
    const qc = new QueryClient()
    qc.setQueryData<CleanupDTO>(queryKeys.cleanup("c1"), cleanup("c1"))
    qc.setQueryData<CleanupDTO[]>(queryKeys.cleanups("upcoming", 50), [cleanup("c1"), cleanup("c2")])

    const patch: Omit<UpdateCleanupRequest, "id"> = {
      title: "Riverside cleanup",
      address: "Boathouse dock",
    }
    onMutate(qc, "c1", patch)

    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup("c1"))).toMatchObject({
      title: "Riverside cleanup",
      address: "Boathouse dock",
      eventKind: "cleanup",
    })
    const list = qc.getQueryData<CleanupDTO[]>(queryKeys.cleanups("upcoming", 50))!
    expect(list.find((c) => c.id === "c1")).toMatchObject({ title: "Riverside cleanup", address: "Boathouse dock" })
    expect(list.find((c) => c.id === "c2")).toMatchObject({ title: "Cleanup c2" })
  })

  it("reconciles linkedReports from the authoritative server response on success", () => {
    const qc = new QueryClient()
    qc.setQueryData<CleanupDTO>(queryKeys.cleanup("c1"), cleanup("c1"))

    const server = cleanup("c1", {
      title: "Riverside cleanup",
      linkedReports: [
        {
          id: "r1",
          category: "trash",
          title: "Overflowing bin",
          status: "published",
          lat: 37.77,
          lng: -122.42,
          linkedAt: new Date().toISOString(),
        },
      ] as CleanupDTO["linkedReports"],
    })

    qc.setQueryData<CleanupDTO>(queryKeys.cleanup("c1"), server)
    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup("c1"))!.linkedReports).toHaveLength(1)
    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup("c1"))!.linkedReports[0]).toMatchObject({ id: "r1" })
  })

  it("rolls the detail back on error", () => {
    const qc = new QueryClient()
    const original = cleanup("c1")
    qc.setQueryData<CleanupDTO>(queryKeys.cleanup("c1"), original)

    const ctx = onMutate(qc, "c1", { title: "Half-typed title" })
    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup("c1"))!.title).toBe("Half-typed title")

    if (ctx.prevDetail) qc.setQueryData<CleanupDTO>(queryKeys.cleanup("c1"), ctx.prevDetail)
    expect(qc.getQueryData<CleanupDTO>(queryKeys.cleanup("c1"))!.title).toBe("Cleanup c1")
  })
})
