import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { donationLinkFor, eventDonationLinkFor, type DonationLinkSource } from "../donationLink"

const EVENT_DETAIL = readFileSync(new URL("../EventDetailBody.tsx", import.meta.url), "utf8")

const ORG = {
  id: "o1",
  slug: "river-keepers",
  name: "River Keepers",
  verified: true,
  donationUrl: "https://give.example.org/river-keepers",
} as DonationLinkSource["organization"]

function source(over: Partial<DonationLinkSource> = {}): DonationLinkSource {
  return {
    title: "Ballona Creek cleanup",
    donationUrl: null,
    organization: null,
    organizer: { id: "u1", name: "Jane Doe", donationUrl: null } as DonationLinkSource["organizer"],
    ...over,
  }
}

describe("donationLinkFor", () => {
  it("prefers the event's own link, credited to the organization the event is hosted as", () => {
    expect(
      donationLinkFor(source({ donationUrl: "https://pay.example.org/creek", organization: ORG })),
    ).toEqual({ url: "https://pay.example.org/creek", ownerName: "River Keepers" })
  })

  it("credits a personal event's own link to the organizer", () => {
    expect(donationLinkFor(source({ donationUrl: "https://pay.example.org/creek" }))).toEqual({
      url: "https://pay.example.org/creek",
      ownerName: "Jane Doe",
    })
  })

  it("falls back to the organization's link, then the organizer's", () => {
    expect(donationLinkFor(source({ organization: ORG }))).toEqual({
      url: "https://give.example.org/river-keepers",
      ownerName: "River Keepers",
    })
    expect(
      donationLinkFor(
        source({
          organization: { ...ORG, donationUrl: null } as DonationLinkSource["organization"],
          organizer: {
            id: "u1",
            name: "Jane Doe",
            donationUrl: "https://ko-fi.example.org/jane",
          } as DonationLinkSource["organizer"],
        }),
      ),
    ).toEqual({ url: "https://ko-fi.example.org/jane", ownerName: "Jane Doe" })
  })

  it("skips an unsafe link at one level rather than rendering it or hiding the safe one below", () => {
    expect(
      donationLinkFor(source({ donationUrl: "http://pay.example.org/creek", organization: ORG })),
    ).toEqual({ url: "https://give.example.org/river-keepers", ownerName: "River Keepers" })
  })

  it("renders nothing when no level carries a link", () => {
    expect(donationLinkFor(source())).toBeNull()
    expect(donationLinkFor(source({ organization: { ...ORG, donationUrl: undefined } as DonationLinkSource["organization"] }))).toBeNull()
  })

  it("uses the event title when neither the organization nor the organizer has a name to show", () => {
    expect(
      donationLinkFor(
        source({
          donationUrl: "https://pay.example.org/creek",
          organizer: { id: "u1", name: "  ", donationUrl: null } as DonationLinkSource["organizer"],
        }),
      ),
    ).toEqual({ url: "https://pay.example.org/creek", ownerName: "Ballona Creek cleanup" })
  })
})

describe("eventDonationLinkFor", () => {
  const withLink = source({ donationUrl: "https://pay.example.org/creek" })
  const LINK = { url: "https://pay.example.org/creek", ownerName: "Jane Doe" }

  it("shows the card to an attendee of an upcoming or active event", () => {
    expect(eventDonationLinkFor(withLink, { status: "upcoming", actsAsHost: false })).toEqual(LINK)
    expect(eventDonationLinkFor(withLink, { status: "active", actsAsHost: false })).toEqual(LINK)
  })

  it("KEEPS the card on a DONE event - donating after the day is the point of the receipt page", () => {
    expect(eventDonationLinkFor(withLink, { status: "done", actsAsHost: false })).toEqual(LINK)
  })

  it("hides the card on a CANCELLED event, whatever the viewer is", () => {
    expect(eventDonationLinkFor(withLink, { status: "cancelled", actsAsHost: false })).toBeNull()
    expect(eventDonationLinkFor(withLink, { status: "cancelled", actsAsHost: true })).toBeNull()
  })

  it("hides the card from a viewer who runs the event, in every status", () => {
    for (const status of ["upcoming", "active", "done"] as const) {
      expect(eventDonationLinkFor(withLink, { status, actsAsHost: true }), status).toBeNull()
    }
  })

  it("still resolves nothing when no level carries a link", () => {
    expect(eventDonationLinkFor(source(), { status: "upcoming", actsAsHost: false })).toBeNull()
  })
})

describe("event page donation placement", () => {
  it("renders the donation card between the header and the sign-up blocks, only when a link resolves", () => {
    const donate = EVENT_DETAIL.indexOf("<DonateBlock")
    expect(donate).toBeGreaterThan(EVENT_DETAIL.indexOf("{cleanup.title}"))
    expect(donate).toBeLessThan(EVENT_DETAIL.indexOf("<RegistrationBlock"))
    expect(donate).toBeLessThan(EVENT_DETAIL.indexOf("<EventSlotsBlock"))
    expect(EVENT_DETAIL).toContain("{donation ? (")
    expect(EVENT_DETAIL.split("<DonateBlock")).toHaveLength(2)
  })

  it("resolves the card through the status/viewer-aware helper, not the bare link lookup", () => {
    expect(EVENT_DETAIL).toContain("eventDonationLinkFor(cleanup, { status, actsAsHost })")
    expect(EVENT_DETAIL).not.toContain("donationLinkFor(cleanup)")
  })
})
