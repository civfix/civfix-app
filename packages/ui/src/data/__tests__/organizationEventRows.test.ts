import { describe, expect, it } from "vitest"
import type { CleanupDTO, ListOrganizationEventsResponse } from "@civfix/shared"
import { organizationEventRows } from "../hooks/orgs"

const organizer = {
  id: "u1",
  name: "Dana Ray",
  handle: "dana",
  avatar: null,
  avatarUrl: null,
} as unknown as CleanupDTO["organizer"]

const event = { id: "c1", title: "Riverwalk cleanup", organizer } as unknown as CleanupDTO

function page(items: unknown): ListOrganizationEventsResponse {
  return { items, nextCursor: null } as unknown as ListOrganizationEventsResponse
}

describe("organizationEventRows", () => {
  it("flattens every page in order", () => {
    const second = { ...event, id: "c2" }
    expect(organizationEventRows([page([event]), page([second])]).map((row) => row.id)).toEqual([
      "c1",
      "c2",
    ])
  })

  it("returns nothing for no pages", () => {
    expect(organizationEventRows(undefined)).toEqual([])
    expect(organizationEventRows([])).toEqual([])
  })

  it("treats a page with no items array as an empty page", () => {
    expect(organizationEventRows([page(undefined)])).toEqual([])
    expect(organizationEventRows([page(null)])).toEqual([])
    expect(organizationEventRows([page(undefined), page([event])]).map((row) => row.id)).toEqual([
      "c1",
    ])
  })

  it("drops a row the event card cannot render", () => {
    const noOrganizer = { ...event, id: "c3", organizer: undefined } as unknown as CleanupDTO
    const noId = { ...event, id: undefined } as unknown as CleanupDTO
    expect(
      organizationEventRows([page([event, noOrganizer, noId, null, undefined])]).map(
        (row) => row.id,
      ),
    ).toEqual(["c1"])
  })
})
