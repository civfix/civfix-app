import type { PublicEventPageDTO, PublicPageTicketType } from "@civfix/shared"

export function ticket(overrides: Partial<PublicPageTicketType> = {}): PublicPageTicketType {
  return {
    id: "t1",
    name: "General",
    maxPartySize: 1,
    soldOut: false,
    salesOpen: true,
    waitlistEnabled: false,
    sortOrder: 0,
    requiresAccessCode: false,
    ...overrides,
  }
}

export function signupPage(
  startsAt: string,
  overrides: Partial<PublicEventPageDTO> = {},
): PublicEventPageDTO {
  return {
    slug: "beach-cleanup",
    status: "published",
    visibility: "public",
    noindex: false,
    theme: { accent: "bloom" },
    coverUrl: null,
    blocks: [],
    seo: { noindex: false },
    event: {
      id: "evt_1",
      title: "Beach cleanup",
      startsAt,
      status: "upcoming",
    },
    ticketTypes: [],
    questions: [],
    consentVersions: { termsVersion: "2026-09-06", disclosureVersion: "2026-09-06" },
    waitlistEnabled: false,
    requiresTurnstile: true,
    ...overrides,
  } as PublicEventPageDTO
}
