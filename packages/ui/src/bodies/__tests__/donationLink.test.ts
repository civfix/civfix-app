import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { donationLinkFor, type DonationLinkSource } from "../donationLink"

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

describe("the event card shows for every viewer and every status", () => {
  const withLink = source({ donationUrl: "https://pay.example.org/creek" })
  const LINK = { url: "https://pay.example.org/creek", ownerName: "Jane Doe" }

  it("resolves the same link with no viewer or status input at all", () => {
    expect(donationLinkFor(withLink)).toEqual(LINK)
  })

  it("still resolves nothing when no level carries a link", () => {
    expect(donationLinkFor(source())).toBeNull()
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

  it("resolves the card from the bare link lookup - hosts and cancelled events included", () => {
    expect(EVENT_DETAIL).toContain("donationLinkFor(cleanup)")
    expect(EVENT_DETAIL).not.toContain("eventDonationLinkFor")
  })
})
