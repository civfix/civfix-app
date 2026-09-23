import { describe, it, expect } from "vitest"
import { AttendeeDTOSchema, ChatMessageDTOSchema, PersonDTOSchema } from "../src/schemas/entities.js"
import { UserProfileDTOSchema } from "../src/schemas/social.js"

const PERSON = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "CivFix",
  handle: "civfix",
  followers: 0,
  following: 0,
  isFollowing: false,
}

describe("PersonDTO.official", () => {
  it("keeps a server-set official flag", () => {
    expect(PersonDTOSchema.parse({ ...PERSON, official: true }).official).toBe(true)
    expect(PersonDTOSchema.parse({ ...PERSON, official: false }).official).toBe(false)
  })

  it("is optional, so a person from an older server still parses unflagged", () => {
    const parsed = PersonDTOSchema.parse(PERSON)
    expect(parsed.official).toBeUndefined()
    expect("official" in parsed).toBe(false)
  })

  it("rejects a non-boolean flag", () => {
    expect(PersonDTOSchema.safeParse({ ...PERSON, official: "true" }).success).toBe(false)
    expect(PersonDTOSchema.safeParse({ ...PERSON, official: null }).success).toBe(false)
  })

  it("reaches chat authors, profiles and rosters through the shared person shape", () => {
    const message = ChatMessageDTOSchema.parse({
      id: "22222222-2222-4222-8222-222222222222",
      cleanupId: "33333333-3333-4333-8333-333333333333",
      roomKind: "report",
      from: { ...PERSON, official: true },
      body: "Crews are scheduled for Thursday.",
      kind: "text",
      createdAt: "2026-09-22T00:00:00.000Z",
    })
    expect(message.from?.official).toBe(true)

    const profile = UserProfileDTOSchema.parse({
      ...PERSON,
      official: true,
      pastEvents: [],
      stats: { reports: 0, cleanups: 0 },
    })
    expect(profile.official).toBe(true)

    expect(AttendeeDTOSchema.parse({ ...PERSON, official: true, role: "member" }).official).toBe(true)
  })
})
