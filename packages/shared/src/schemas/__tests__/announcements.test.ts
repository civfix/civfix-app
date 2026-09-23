import { describe, expect, expectTypeOf, it } from "vitest"
import { z } from "zod"
import { BroadcastKindSchema } from "../common.js"
import {
  ANNOUNCEMENT_AUDIENCE_KINDS,
  ANNOUNCEMENT_BROADCAST_KIND,
  AnnouncementAudienceSchema,
  type AnnouncementAudience,
  type AnnouncementAudienceKind,
} from "../host/announcements.js"

describe("announcement vocabulary", () => {
  it("lists exactly the audience kinds the audience schema accepts, in the schema's order", () => {
    expect(AnnouncementAudienceSchema).toBeInstanceOf(z.ZodDiscriminatedUnion)
    const union = AnnouncementAudienceSchema as z.ZodDiscriminatedUnion<
      "kind",
      z.ZodDiscriminatedUnionOption<"kind">[]
    >
    expect([...union.optionsMap.keys()]).toEqual([...ANNOUNCEMENT_AUDIENCE_KINDS])
    expectTypeOf<AnnouncementAudienceKind>().toEqualTypeOf<AnnouncementAudience["kind"]>()
  })

  it("is recorded under a broadcast kind the broadcast log accepts", () => {
    expect(BroadcastKindSchema.parse(ANNOUNCEMENT_BROADCAST_KIND)).toBe(ANNOUNCEMENT_BROADCAST_KIND)
  })
})
