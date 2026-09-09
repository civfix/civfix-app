import { describe, it, expect } from "vitest"
import {
  AttendeeDTOSchema,
  CleanupDTOSchema,
  EventSlotDTOSchema,
  EventSlotRefSchema,
} from "../src/schemas/entities.js"
import {
  ClaimEventSlotRequestSchema,
  CompleteCleanupRequestSchema,
  CreateCleanupRequestSchema,
  EventSlotInputSchema,
  MAX_BRING_ITEMS,
  MAX_EVENT_SLOTS,
  MAX_LINKED_REPORTS,
  MAX_SLOT_CAPACITY,
  MAX_SLOT_DESCRIPTION,
  MAX_SLOT_TITLE,
  UpdateCleanupRequestSchema,
} from "../src/schemas/cleanups.js"

const UUID = "00000000-0000-0000-0000-000000000001"
const UUID2 = "00000000-0000-0000-0000-000000000002"

const person = {
  id: UUID2,
  name: "Ada",
  avatar: null,
  followers: 0,
  following: 0,
  isFollowing: false,
}

const slotInput = { title: "Registration table" }

describe("caps (single source of truth shared with the backend and the slot editor)", () => {
  it("exports the agreed numbers", () => {
    expect(MAX_EVENT_SLOTS).toBe(20)
    expect(MAX_SLOT_TITLE).toBe(80)
    expect(MAX_SLOT_DESCRIPTION).toBe(200)
    expect(MAX_SLOT_CAPACITY).toBe(999)
    expect(MAX_BRING_ITEMS).toBe(30)
    expect(MAX_LINKED_REPORTS).toBe(200)
  })
})

describe("EventSlotInputSchema", () => {
  it("accepts the minimal create form (no id = create a new slot)", () => {
    const parsed = EventSlotInputSchema.parse(slotInput)
    expect(parsed.title).toBe("Registration table")
    expect(parsed.id).toBeUndefined()
  })

  it("accepts the full edit form (id present = edit an existing slot)", () => {
    const parsed = EventSlotInputSchema.parse({
      id: UUID,
      title: "8-10am sweep",
      description: "Meet at the north gate",
      capacity: 4,
      sortOrder: 2,
    })
    expect(parsed).toEqual({
      id: UUID,
      title: "8-10am sweep",
      description: "Meet at the north gate",
      capacity: 4,
      sortOrder: 2,
    })
  })

  it("trims the title and rejects an empty one", () => {
    expect(EventSlotInputSchema.parse({ title: "  Cleanup crew  " }).title).toBe("Cleanup crew")
    expect(EventSlotInputSchema.safeParse({ title: "   " }).success).toBe(false)
  })

  it("rejects an unknown key (strict)", () => {
    expect(EventSlotInputSchema.safeParse({ ...slotInput, bogus: 1 }).success).toBe(false)
  })

  it("rejects a title over MAX_SLOT_TITLE and a description over MAX_SLOT_DESCRIPTION", () => {
    expect(EventSlotInputSchema.safeParse({ title: "x".repeat(MAX_SLOT_TITLE) }).success).toBe(true)
    expect(EventSlotInputSchema.safeParse({ title: "x".repeat(MAX_SLOT_TITLE + 1) }).success).toBe(
      false,
    )
    expect(
      EventSlotInputSchema.safeParse({
        ...slotInput,
        description: "x".repeat(MAX_SLOT_DESCRIPTION + 1),
      }).success,
    ).toBe(false)
  })

  it("rejects capacity 0 and negative capacity; null means unlimited", () => {
    expect(EventSlotInputSchema.safeParse({ ...slotInput, capacity: 0 }).success).toBe(false)
    expect(EventSlotInputSchema.safeParse({ ...slotInput, capacity: -1 }).success).toBe(false)
    expect(EventSlotInputSchema.safeParse({ ...slotInput, capacity: 1.5 }).success).toBe(false)
    expect(EventSlotInputSchema.parse({ ...slotInput, capacity: null }).capacity).toBeNull()
    expect(
      EventSlotInputSchema.safeParse({ ...slotInput, capacity: MAX_SLOT_CAPACITY }).success,
    ).toBe(true)
    expect(
      EventSlotInputSchema.safeParse({ ...slotInput, capacity: MAX_SLOT_CAPACITY + 1 }).success,
    ).toBe(false)
  })

  it("rejects a non-uuid id", () => {
    expect(EventSlotInputSchema.safeParse({ ...slotInput, id: "not-a-uuid" }).success).toBe(false)
  })
})

describe("CreateCleanupRequestSchema / UpdateCleanupRequestSchema slot + list caps", () => {
  const base = {
    title: "Beach cleanup",
    type: "site",
    lat: 34.0,
    lng: -118.5,
    scheduledAt: "2026-06-01T17:00:00.000Z",
  }

  it("accepts a create payload with slots, and one without (backward compatible)", () => {
    expect(CreateCleanupRequestSchema.safeParse(base).success).toBe(true)
    const parsed = CreateCleanupRequestSchema.parse({ ...base, slots: [slotInput] })
    expect(parsed.slots).toHaveLength(1)
  })

  it("accepts an update payload with slots, and [] to delete them all", () => {
    expect(UpdateCleanupRequestSchema.parse({ id: UUID, slots: [] }).slots).toEqual([])
    expect(UpdateCleanupRequestSchema.parse({ id: UUID }).slots).toBeUndefined()
    expect(UpdateCleanupRequestSchema.parse({ id: UUID, slots: [slotInput] }).slots).toHaveLength(
      1,
    )
  })

  it("rejects more than MAX_EVENT_SLOTS slots on both create and update", () => {
    const tooMany = Array.from({ length: MAX_EVENT_SLOTS + 1 }, (_, i) => ({ title: `Role ${i}` }))
    const atCap = tooMany.slice(0, MAX_EVENT_SLOTS)
    expect(CreateCleanupRequestSchema.safeParse({ ...base, slots: atCap }).success).toBe(true)
    expect(CreateCleanupRequestSchema.safeParse({ ...base, slots: tooMany }).success).toBe(false)
    expect(UpdateCleanupRequestSchema.safeParse({ id: UUID, slots: tooMany }).success).toBe(
      false,
    )
  })

  it("rejects an invalid slot nested in an otherwise valid payload", () => {
    expect(
      CreateCleanupRequestSchema.safeParse({ ...base, slots: [{ title: "ok", bogus: 1 }] }).success,
    ).toBe(false)
  })

  it("caps bring at MAX_BRING_ITEMS and linkedReportIds at MAX_LINKED_REPORTS", () => {
    const bring = Array.from({ length: MAX_BRING_ITEMS + 1 }, (_, i) => `item ${i}`)
    const ids = Array.from({ length: MAX_LINKED_REPORTS + 1 }, () => UUID)
    expect(
      CreateCleanupRequestSchema.safeParse({ ...base, bring: bring.slice(0, MAX_BRING_ITEMS) })
        .success,
    ).toBe(true)
    expect(CreateCleanupRequestSchema.safeParse({ ...base, bring }).success).toBe(false)
    expect(CreateCleanupRequestSchema.safeParse({ ...base, linkedReportIds: ids }).success).toBe(
      false,
    )
    expect(UpdateCleanupRequestSchema.safeParse({ id: UUID, bring }).success).toBe(false)
    expect(UpdateCleanupRequestSchema.safeParse({ id: UUID, linkedReportIds: ids }).success).toBe(false)
  })

  it("stays strict", () => {
    expect(CreateCleanupRequestSchema.safeParse({ ...base, bogus: 1 }).success).toBe(false)
    expect(UpdateCleanupRequestSchema.safeParse({ id: UUID, bogus: 1 }).success).toBe(false)
  })
})

describe("CompleteCleanupRequestSchema", () => {
  it("accepts the merged { id } body the route parses (path id folded in), note optional", () => {
    expect(CompleteCleanupRequestSchema.parse({ id: UUID })).toEqual({ id: UUID })
    expect(CompleteCleanupRequestSchema.parse({ id: UUID, note: "All done" }).note).toBe("All done")
  })

  it("rejects a body missing the id (strict, so the route MUST merge the path id)", () => {
    expect(CompleteCleanupRequestSchema.safeParse({}).success).toBe(false)
  })

  it("rejects an unknown key and an over-long note", () => {
    expect(CompleteCleanupRequestSchema.safeParse({ id: UUID, bogus: 1 }).success).toBe(false)
    expect(
      CompleteCleanupRequestSchema.safeParse({ id: UUID, note: "x".repeat(501) }).success,
    ).toBe(false)
  })
})

describe("ClaimEventSlotRequestSchema", () => {
  it("accepts a claim", () => {
    expect(ClaimEventSlotRequestSchema.parse({ id: UUID, slotId: UUID2 }).slotId).toBe(UUID2)
  })

  it("accepts slotId: null (release)", () => {
    expect(ClaimEventSlotRequestSchema.parse({ id: UUID, slotId: null }).slotId).toBeNull()
  })

  it("requires slotId to be present (null is explicit, undefined is not a release)", () => {
    expect(ClaimEventSlotRequestSchema.safeParse({ id: UUID }).success).toBe(false)
  })

  it("rejects a non-uuid slotId", () => {
    expect(ClaimEventSlotRequestSchema.safeParse({ id: UUID, slotId: "nope" }).success).toBe(false)
  })

  it("rejects an unknown key (strict)", () => {
    expect(
      ClaimEventSlotRequestSchema.safeParse({ id: UUID, slotId: null, bogus: 1 }).success,
    ).toBe(false)
  })
})

describe("EventSlotDTOSchema / EventSlotRefSchema (tolerant responses)", () => {
  it("parses a minimal payload with every optional omitted", () => {
    const parsed = EventSlotDTOSchema.parse({ id: UUID, title: "Registration table" })
    expect(parsed.claimed).toBe(0)
    expect(parsed.sortOrder).toBe(0)
    expect(parsed.capacity).toBeUndefined()
    expect(parsed.mine).toBeUndefined()
  })

  it("keeps claimed > capacity as sent (lowering capacity never evicts; render 6/4, do not clamp)", () => {
    const parsed = EventSlotDTOSchema.parse({
      id: UUID,
      title: "Sweep",
      capacity: 4,
      claimed: 6,
      mine: true,
    })
    expect(parsed.capacity).toBe(4)
    expect(parsed.claimed).toBe(6)
    expect(parsed.mine).toBe(true)
  })

  it("treats capacity null as unlimited", () => {
    expect(EventSlotDTOSchema.parse({ id: UUID, title: "Sweep", capacity: null }).capacity).toBeNull()
  })

  it("parses a slot ref", () => {
    expect(EventSlotRefSchema.parse({ id: UUID, title: "Sweep" })).toEqual({
      id: UUID,
      title: "Sweep",
    })
  })
})

describe("AttendeeDTOSchema.slot (tolerant)", () => {
  const attendee = { ...person, role: "member" }

  it("parses a legacy roster row with no slot key at all", () => {
    const parsed = AttendeeDTOSchema.safeParse(attendee)
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.slot).toBeUndefined()
  })

  it("parses slot: null (RSVP'd without a slot) and a populated slot ref", () => {
    expect(AttendeeDTOSchema.parse({ ...attendee, slot: null }).slot).toBeNull()
    expect(
      AttendeeDTOSchema.parse({ ...attendee, slot: { id: UUID, title: "Sweep" } }).slot,
    ).toEqual({ id: UUID, title: "Sweep" })
  })
})

describe("CleanupDTOSchema.slots / slotCount (tolerant)", () => {
  const legacy = {
    id: UUID,
    title: "Park cleanup",
    type: "route",
    lat: 34.0,
    lng: -118.5,
    scheduledAt: "2026-06-01T17:00:00.000Z",
    status: "upcoming",
    organizer: person,
    going: 4,
    joined: true,
    bring: ["gloves"],
  }

  it("parses a payload from a server built before slots existed", () => {
    const parsed = CleanupDTOSchema.safeParse(legacy)
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.slots).toEqual([])
    expect(parsed.success && parsed.data.slotCount).toBeUndefined()
  })

  it("hydrates slots on a detail-shaped payload", () => {
    const parsed = CleanupDTOSchema.parse({
      ...legacy,
      slots: [{ id: UUID, title: "Sweep", capacity: 4, claimed: 2, sortOrder: 1, mine: false }],
      slotCount: 1,
    })
    expect(parsed.slots).toHaveLength(1)
    expect(parsed.slots[0]?.claimed).toBe(2)
    expect(parsed.slotCount).toBe(1)
  })

  it("carries slotCount on a list-shaped payload whose slots are deliberately empty", () => {
    const parsed = CleanupDTOSchema.parse({ ...legacy, slotCount: 3 })
    expect(parsed.slots).toEqual([])
    expect(parsed.slotCount).toBe(3)
  })
})
