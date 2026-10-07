import { beforeEach, describe, expect, it } from "vitest"
import { persistableEntry, takeNavSnapshot, type NavSnapshot } from "../navSnapshot"
import { ENTRY_IDENTITY_FIELDS, entryIdentity } from "../routes"
import { useNavStore } from "../useNavStore"
import type { DetailEntry } from "../types"

type IdentityField = (typeof ENTRY_IDENTITY_FIELDS)[number]

const ENTRY_CARRYING: Record<IdentityField, DetailEntry> = {
  id: { kind: "cleanup", id: "c1" },
  roomKind: { kind: "thread", id: "d1", roomKind: "dm" },
  geoid: { kind: "leaderboard", geoid: "06037" },
  slug: { kind: "org", slug: "acme" },
  seatId: { kind: "my-ticket", id: "c1", seatId: "s1" },
  announcementId: { kind: "announcement", id: "c1", announcementId: "a1" },
}

function resetStore(): void {
  useNavStore.setState({
    view: "home",
    stack: [],
    active: null,
    snap: 0,
    snapAnimated: true,
    query: "",
    mode: "compact",
    originView: null,
    seededDetailPage: false,
    reportReturn: null,
    navSeq: 0,
    lastTransition: null,
  })
}

function snapshotAndRestore(entry: DetailEntry): DetailEntry | undefined {
  useNavStore.getState().selectView("events")
  useNavStore.getState().push(entry)
  // Web keeps the snapshot in history.state and mobile in storage, so it must survive serialization.
  const serialized = JSON.stringify(takeNavSnapshot(useNavStore.getState()))
  useNavStore.getState().reset()
  useNavStore.getState().restore(JSON.parse(serialized) as NavSnapshot)
  return useNavStore.getState().stack[0]
}

describe("nav snapshot keeps every route identity field", () => {
  beforeEach(resetStore)

  it("has a fixture for exactly the identity fields", () => {
    expect(Object.keys(ENTRY_CARRYING).sort()).toEqual([...ENTRY_IDENTITY_FIELDS].sort())
  })

  it.each(ENTRY_IDENTITY_FIELDS)("persistableEntry keeps %s", (field) => {
    const entry = ENTRY_CARRYING[field]
    expect(persistableEntry(entry)[field]).toBe(entry[field])
    expect(entryIdentity(persistableEntry(entry))).toBe(entryIdentity(entry))
  })

  it.each(ENTRY_IDENTITY_FIELDS)("%s survives snapshot -> restore", (field) => {
    const entry = ENTRY_CARRYING[field]
    const restored = snapshotAndRestore(entry)
    expect(restored).toEqual(entry)
    expect(entryIdentity(restored)).toBe(entryIdentity(entry))
    expect(useNavStore.getState().active).toEqual(entry)
  })
})
