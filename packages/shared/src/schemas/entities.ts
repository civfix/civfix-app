import { z } from "zod"
import {
  BroadcastChannelSchema,
  BroadcastKindSchema,
  BroadcastSegmentSchema,
  BroadcastStatusSchema,
  CheckinMethodSchema,
  CleanupMemberRoleSchema,
  EventPageStatusSchema,
  EventVisibilitySchema,
  HostCapabilitySchema,
  IdSchema,
  ISODateSchema,
  LatLngFields,
  LegalDocumentTypeSchema,
  OrganizationMemberRoleSchema,
  OrgVerificationKindSchema,
  OrgVerificationStatusSchema,
  RegistrationSourceSchema,
  RegistrationStatusSchema,
  ReportCategorySchema,
  ReportTypeSchema,
  ReportStatusSchema,
  GeomSourceSchema,
  MediaKindSchema,
  MediaStatusSchema,
  SeatStatusSchema,
  ThemeAccentSchema,
  TicketTypeVisibilitySchema,
} from "./common.js"
import { MARKDOWN_SUBSET_MAX_CHARS } from "../markdown/parse.js"
import { isSafeHttpsUrl } from "../markdown/safe-url.js"

export const HttpsUrlSchema = z.string().trim().url().max(500).startsWith("https://")

export const AvatarPairSchema = z.tuple([z.string(), z.string()]).nullable().optional()

const OrganizationRefDTOObjectSchema = z.object({
  id: IdSchema,
  slug: z.string(),
  name: z.string(),
  logoUrl: z.string().nullable().optional(),
  verified: z.boolean().default(false),
  verifiedKind: OrgVerificationKindSchema.nullable().optional(),
})
export type OrganizationRefDTO = z.infer<typeof OrganizationRefDTOObjectSchema>
export const OrganizationRefDTOSchema: z.ZodType<OrganizationRefDTO, z.ZodTypeDef, unknown> =
  OrganizationRefDTOObjectSchema

const LeaderboardEntryDTOObjectSchema = z.object({
  rank: z.number().int().positive(),
  userId: IdSchema,
  name: z.string(),
  handle: z.string().nullable().optional(),
  avatar: AvatarPairSchema,
  avatarUrl: z.string().nullable().optional(),
  hours: z.number().nonnegative(),
})
export type LeaderboardEntryDTO = z.infer<typeof LeaderboardEntryDTOObjectSchema>
export const LeaderboardEntryDTOSchema: z.ZodType<LeaderboardEntryDTO, z.ZodTypeDef, unknown> =
  LeaderboardEntryDTOObjectSchema

const OrgHoursDTOObjectSchema = z.object({
  organization: OrganizationRefDTOSchema,
  hours: z.number().nonnegative(),
})
export type OrgHoursDTO = z.infer<typeof OrgHoursDTOObjectSchema>
export const OrgHoursDTOSchema: z.ZodType<OrgHoursDTO, z.ZodTypeDef, unknown> = OrgHoursDTOObjectSchema




export const EventKindSchema = z.enum(["cleanup", "other_volunteer"])
export type EventKind = z.infer<typeof EventKindSchema>

export const EVENT_KIND_VALUES = EventKindSchema.options
export type EventKindValue = (typeof EVENT_KIND_VALUES)[number]

export const CleanupTypeSchema = z.enum(["site", "route"])
export type CleanupType = z.infer<typeof CleanupTypeSchema>

export const CleanupStatusSchema = z.enum(["upcoming", "active", "done", "cancelled"])
export type CleanupStatus = z.infer<typeof CleanupStatusSchema>

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  cleanup: "Cleanup",
  other_volunteer: "Other Volunteer",
}

export const PersonDTOSchema = z.object({
  id: IdSchema,
  name: z.string(),
  handle: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  avatar: AvatarPairSchema,
  avatarUrl: z.string().nullable().optional(),
  followers: z.number().int().nonnegative(),
  following: z.number().int().nonnegative(),
  isFollowing: z.boolean(),
  /**
   * The person's primary organization affiliation (DECISIONS §34), rendered as a badge next to the
   * name. Falls back to the earliest membership; null when the person belongs to no organization.
   * Optional so an older server parses.
   */
  organization: OrganizationRefDTOSchema.nullable().optional(),
  donationUrl: HttpsUrlSchema.nullable().optional(),
  deleted: z.boolean().optional(),
  official: z.boolean().optional(),
})
export type PersonDTO = z.infer<typeof PersonDTOSchema>

export const EventSlotDTOSchema = z.object({
  id: IdSchema,
  title: z.string(),
  description: z.string().nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  claimed: z.number().int().nonnegative().default(0),
  sortOrder: z.number().int().default(0),
  mine: z.boolean().optional(),
  startsAt: ISODateSchema.nullable().optional(),
  endsAt: ISODateSchema.nullable().optional(),
})
export type EventSlotDTO = z.infer<typeof EventSlotDTOSchema>

export const EventSlotRefSchema = z.object({
  id: IdSchema,
  title: z.string(),
})
export type EventSlotRef = z.infer<typeof EventSlotRefSchema>

export const AttendeeDTOSchema = PersonDTOSchema.extend({
  role: CleanupMemberRoleSchema,
  slot: EventSlotRefSchema.nullable().optional(),
})
export type AttendeeDTO = z.infer<typeof AttendeeDTOSchema>

export const SOCIAL_PLATFORMS = ["facebook", "instagram", "tiktok", "x", "whatsapp"] as const
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  whatsapp: "WhatsApp",
}

const SocialHandleSchema = z.string().trim().regex(/^[A-Za-z0-9._]{1,30}$/)
const WhatsAppNumberSchema = z.string().trim().regex(/^[1-9]\d{6,14}$/)

export const SocialLinksSchema = z
  .object({
    facebook: SocialHandleSchema.nullable().optional(),
    instagram: SocialHandleSchema.nullable().optional(),
    tiktok: SocialHandleSchema.nullable().optional(),
    x: SocialHandleSchema.nullable().optional(),
    whatsapp: WhatsAppNumberSchema.nullable().optional(),
  })
  .strict()
export type SocialLinks = z.infer<typeof SocialLinksSchema>

export function socialLinkUrl(platform: SocialPlatform, value: string): string {
  switch (platform) {
    case "facebook":
      return `https://facebook.com/${value}`
    case "instagram":
      return `https://instagram.com/${value}`
    case "tiktok":
      return `https://www.tiktok.com/@${value}`
    case "x":
      return `https://x.com/${value}`
    case "whatsapp":
      return `https://wa.me/${value}`
  }
}

export const MediaDTOSchema = z.object({
  id: IdSchema,
  kind: MediaKindSchema,
  codec: z.string().nullable().optional(),
  url: z.string(),
  thumbUrl: z.string().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  status: MediaStatusSchema,
})
export type MediaDTO = z.infer<typeof MediaDTOSchema>


export const LinkedReportRefSchema = z.object({
  id: IdSchema,
  category: ReportCategorySchema,
  type: ReportTypeSchema.optional(),
  title: z.string(),
  status: ReportStatusSchema,
  ...LatLngFields,
  addr: z.string().nullable().optional(),
  thumbUrl: z.string().nullable().optional(),
  linkedAt: ISODateSchema,
})
export type LinkedReportRef = z.infer<typeof LinkedReportRefSchema>

export const LinkedEventRefSchema = z.object({
  id: IdSchema,
  title: z.string(),
  eventKind: EventKindSchema,
  status: CleanupStatusSchema.default("upcoming"),
  scheduledAt: ISODateSchema,
  endsAt: ISODateSchema.nullable().optional(),
  timezone: z.string().nullable().optional(),
  ...LatLngFields,
  going: z.number().int().nonnegative(),
  organizer: PersonDTOSchema,
  linkedAt: ISODateSchema,
})
export type LinkedEventRef = z.infer<typeof LinkedEventRefSchema>


export const ReportTimelineEntryDTOSchema = z.object({
  status: ReportStatusSchema,
  at: ISODateSchema,
  note: z.string().nullable().optional(),
  kind: z.string().optional(),
  body: z.string().optional(),
})
export type ReportTimelineEntryDTO = z.infer<typeof ReportTimelineEntryDTOSchema>

export const ReportVisibilitySchema = z.enum(["public", "hidden"])
export type ReportVisibility = z.infer<typeof ReportVisibilitySchema>

export const AddressPrecisionSchema = z.enum([
  "street",
  "intersection",
  "landmark",
  "locality",
])
export type AddressPrecision = z.infer<typeof AddressPrecisionSchema>

export const EventAddressSourceSchema = z.enum(["resolved", "edited", "manual"])
export type EventAddressSource = z.infer<typeof EventAddressSourceSchema>

export const ReportAddressSourceSchema = z.enum(["resolved", "user"])
export type ReportAddressSource = z.infer<typeof ReportAddressSourceSchema>

export const ReportDTOSchema = z.object({
  id: IdSchema,
  referenceCode: z.string().optional(),
  category: ReportCategorySchema,
  type: ReportTypeSchema.optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  addr: z.string().nullable().optional(),
  addrSource: ReportAddressSourceSchema.nullable().optional(),
  addrPrecision: AddressPrecisionSchema.nullable().optional(),
  status: ReportStatusSchema,
  visibility: ReportVisibilitySchema,
  ...LatLngFields,
  geomSource: GeomSourceSchema,
  jurisdictionGeoid: z.string().nullable().optional(),
  createdAt: ISODateSchema,
  publishedAt: ISODateSchema.nullable().optional(),
  mine: z.boolean(),
  gov: z.boolean(),
  following: z.boolean(),
  media: z.array(MediaDTOSchema),
  mediaPending: z.number().int().nonnegative().default(0),
  timeline: z.array(ReportTimelineEntryDTOSchema),
  linkedEvents: z.array(LinkedEventRefSchema).default([]),
  discussionCount: z.number().int().nonnegative().optional(),
  cityHandle: z.string().nullable().optional(),
  cityName: z.string().nullable().optional(),
  canForwardToCity: z.boolean().optional(),
  chatJoined: z.boolean().optional(),
  chatMemberCount: z.number().int().nonnegative().optional(),
  chatMessageCount: z.number().int().nonnegative().optional(),
  chatUnread: z.number().int().nonnegative().optional(),
})
export type ReportDTO = z.infer<typeof ReportDTOSchema>

export const ReportPinDTOSchema = z.object({
  id: IdSchema,
  category: ReportCategorySchema,
  type: ReportTypeSchema.optional(),
  ...LatLngFields,
  status: ReportStatusSchema,
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  thumbUrl: z.string().nullable().optional(),
  addr: z.string().nullable().optional(),
  referenceCode: z.string().optional(),
})
export type ReportPinDTO = z.infer<typeof ReportPinDTOSchema>


const LegalDocumentVersionDTOObjectSchema = z.object({
  type: LegalDocumentTypeSchema,
  version: z.string().min(1).max(32),
  sha256: z.string().min(1).max(128),
  effectiveAt: ISODateSchema,
  url: z.string(),
})
export type LegalDocumentVersionDTO = z.infer<typeof LegalDocumentVersionDTOObjectSchema>
export const LegalDocumentVersionDTOSchema: z.ZodType<LegalDocumentVersionDTO, z.ZodTypeDef, unknown> =
  LegalDocumentVersionDTOObjectSchema

const OrganizationDTOObjectSchema = z.object({
  id: IdSchema,
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
  logoMediaId: IdSchema.nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  socialLinks: SocialLinksSchema.nullable().optional(),
  verifiedStatus: OrgVerificationStatusSchema.default("unverified"),
  verifiedKind: OrgVerificationKindSchema.nullable().optional(),
  verifiedAt: ISODateSchema.nullable().optional(),
  createdAt: ISODateSchema,
  memberCount: z.number().int().nonnegative().optional(),
  eventCount: z.number().int().nonnegative().optional(),
  volunteerHours: z.number().nonnegative().optional(),
  volunteerCount: z.number().int().nonnegative().optional(),
  myRole: OrganizationMemberRoleSchema.nullable().optional(),
  donationUrl: HttpsUrlSchema.nullable().optional(),
  // An operator-suspended org (DECISIONS §32). Optional so an older server still parses.
  suspended: z.boolean().optional(),
})
export type OrganizationDTO = z.infer<typeof OrganizationDTOObjectSchema>
export const OrganizationDTOSchema: z.ZodType<OrganizationDTO, z.ZodTypeDef, unknown> =
  OrganizationDTOObjectSchema

const OrganizationMemberDTOObjectSchema = z.object({
  person: PersonDTOSchema,
  role: OrganizationMemberRoleSchema,
  joinedAt: ISODateSchema,
  canRemove: z.boolean().default(false),
})
export type OrganizationMemberDTO = z.infer<typeof OrganizationMemberDTOObjectSchema>
export const OrganizationMemberDTOSchema: z.ZodType<OrganizationMemberDTO, z.ZodTypeDef, unknown> =
  OrganizationMemberDTOObjectSchema

const TicketTypeDTOObjectSchema = z.object({
  id: IdSchema,
  cleanupId: IdSchema,
  name: z.string(),
  description: z.string().nullable().optional(),
  capacity: z.number().int().nonnegative().nullable().optional(),
  reserved: z.number().int().nonnegative().default(0),
  sold: z.number().int().nonnegative().default(0),
  remaining: z.number().int().nonnegative().nullable().optional(),
  salesOpensAt: ISODateSchema.nullable().optional(),
  salesClosesAt: ISODateSchema.nullable().optional(),
  visibility: TicketTypeVisibilitySchema.default("public"),
  accessCodeSet: z.boolean().default(false),
  maxPartySize: z.number().int().min(1).max(10).default(1),
  sortOrder: z.number().int().default(0),
  questionIds: z.array(IdSchema).default([]),
  soldOut: z.boolean().default(false),
  salesOpen: z.boolean().default(true),
  waitlistEnabled: z.boolean().default(false),
})
export type TicketTypeDTO = z.infer<typeof TicketTypeDTOObjectSchema>
export const TicketTypeDTOSchema: z.ZodType<TicketTypeDTO, z.ZodTypeDef, unknown> =
  TicketTypeDTOObjectSchema

const EventSeatDTOObjectSchema = z.object({
  id: IdSchema,
  seatIndex: z.number().int().nonnegative(),
  attendeeName: z.string().nullable().optional(),
  status: SeatStatusSchema.default("active"),
  ticketToken: z.string().nullable().optional(),
  checkedInAt: ISODateSchema.nullable().optional(),
  checkinMethod: CheckinMethodSchema.nullable().optional(),
  noShowAt: ISODateSchema.nullable().optional(),
})
export type EventSeatDTO = z.infer<typeof EventSeatDTOObjectSchema>
export const EventSeatDTOSchema: z.ZodType<EventSeatDTO, z.ZodTypeDef, unknown> =
  EventSeatDTOObjectSchema

export const RegistrantKindSchema = z.enum(["member", "guest"])
export type RegistrantKind = z.infer<typeof RegistrantKindSchema>

const EventAnswerDTOObjectSchema = z.object({
  questionId: IdSchema,
  prompt: z.string(),
  value: z.union([z.string(), z.array(z.string()), z.boolean()]).nullable(),
  scrubbedAt: ISODateSchema.nullable().optional(),
})
export type EventAnswerDTO = z.infer<typeof EventAnswerDTOObjectSchema>
export const EventAnswerDTOSchema: z.ZodType<EventAnswerDTO, z.ZodTypeDef, unknown> =
  EventAnswerDTOObjectSchema

const EventRegistrationObjectSchema = z.object({
  id: IdSchema,
  cleanupId: IdSchema,
  kind: RegistrantKindSchema,
  person: PersonDTOSchema.nullable().optional(),
  guestName: z.string().nullable().optional(),
  ticketTypeId: IdSchema.nullable().optional(),
  ticketTypeName: z.string().nullable().optional(),
  partySize: z.number().int().min(1).max(10).default(1),
  seatCount: z.number().int().nonnegative().default(1),
  seats: z.array(EventSeatDTOSchema).default([]),
  status: RegistrationStatusSchema.default("registered"),
  source: RegistrationSourceSchema.default("self"),
  registeredAt: ISODateSchema,
  cancelledAt: ISODateSchema.nullable().optional(),
  checkedInAt: ISODateSchema.nullable().optional(),
  checkedInBy: PersonDTOSchema.nullable().optional(),
  slot: EventSlotRefSchema.nullable().optional(),
  waitlistPosition: z.number().int().positive().nullable().optional(),
  answersPreview: z.string().nullable().optional(),
  answers: z.array(EventAnswerDTOSchema).nullable().optional(),
  note: z.string().nullable().optional(),
})
export type EventRegistrationDTO = z.infer<typeof EventRegistrationObjectSchema>

export const EventRegistrationDTOSchema: z.ZodType<
  EventRegistrationDTO,
  z.ZodTypeDef,
  unknown
> = EventRegistrationObjectSchema

const MyEventRegistrationRefObjectSchema = z.object({
  id: IdSchema,
  ticketTypeId: IdSchema.nullable().optional(),
  ticketTypeName: z.string().nullable().optional(),
  status: RegistrationStatusSchema,
  seatCount: z.number().int().nonnegative().default(1),
  checkedIn: z.boolean().default(false),
  waitlistPosition: z.number().int().positive().nullable().optional(),
  canCancel: z.boolean().default(true),
})
export type MyEventRegistrationRef = z.infer<typeof MyEventRegistrationRefObjectSchema>
export const MyEventRegistrationRefSchema: z.ZodType<MyEventRegistrationRef, z.ZodTypeDef, unknown> =
  MyEventRegistrationRefObjectSchema

export const PAGE_IMAGE_URL_MAX = 1000
export const SAFE_HTTPS_LINK_MAX = 500

export const SAFE_HTTPS_LINK_MESSAGE =
  "must be an https:// link to a named host (no credentials, no IP literal, no punycode host)"

export const PageImageUrlSchema = z
  .string()
  .trim()
  .max(PAGE_IMAGE_URL_MAX)
  .refine((value) => isSafeHttpsUrl(value, { maxChars: PAGE_IMAGE_URL_MAX }), {
    message: SAFE_HTTPS_LINK_MESSAGE,
  })

export const SafeHttpsLinkSchema = z
  .string()
  .trim()
  .max(SAFE_HTTPS_LINK_MAX)
  .refine((value) => isSafeHttpsUrl(value, { maxChars: SAFE_HTTPS_LINK_MAX }), {
    message: SAFE_HTTPS_LINK_MESSAGE,
  })

export const HostEventEmailSchema = z.string().trim().toLowerCase().email().max(254)

const EventPageBlockBaseFields = {
  id: z.string().min(1).max(64),
} as const

const AgendaItemSchema = z
  .object({
    time: z.string().max(40).nullable().optional(),
    title: z.string().min(1).max(160),
    description: z.string().max(600).nullable().optional(),
  })
  .strict()

const PageHostEntrySchema = z
  .object({
    userId: IdSchema.nullable().optional(),
    name: z.string().min(1).max(120),
    role: z.string().max(80).nullable().optional(),
    bio: z.string().max(600).nullable().optional(),
    avatarMediaId: IdSchema.nullable().optional(),
    avatarUrl: PageImageUrlSchema.nullable().optional(),
  })
  .strict()

const FaqItemSchema = z
  .object({
    question: z.string().min(1).max(200),
    answer: z.string().min(1).max(1200),
  })
  .strict()

const SponsorEntrySchema = z
  .object({
    name: z.string().min(1).max(120),
    url: SafeHttpsLinkSchema.nullable().optional(),
    logoMediaId: IdSchema.nullable().optional(),
    logoUrl: PageImageUrlSchema.nullable().optional(),
  })
  .strict()

const EventPageBlockUnionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...EventPageBlockBaseFields,
      kind: z.literal("hero"),
      headline: z.string().max(160).nullable().optional(),
      subhead: z.string().max(320).nullable().optional(),
      mediaId: IdSchema.nullable().optional(),
      imageUrl: PageImageUrlSchema.nullable().optional(),
    })
    .strict(),
  z
    .object({
      ...EventPageBlockBaseFields,
      kind: z.literal("about"),
      title: z.string().max(160).nullable().optional(),
      body: z.string().max(MARKDOWN_SUBSET_MAX_CHARS),
    })
    .strict(),
  z
    .object({
      ...EventPageBlockBaseFields,
      kind: z.literal("agenda"),
      title: z.string().max(160).nullable().optional(),
      items: z.array(AgendaItemSchema).max(30).default([]),
    })
    .strict(),
  z
    .object({
      ...EventPageBlockBaseFields,
      kind: z.literal("hosts"),
      title: z.string().max(160).nullable().optional(),
      entries: z.array(PageHostEntrySchema).max(20).default([]),
    })
    .strict(),
  z
    .object({
      ...EventPageBlockBaseFields,
      kind: z.literal("faq"),
      title: z.string().max(160).nullable().optional(),
      items: z.array(FaqItemSchema).max(30).default([]),
    })
    .strict(),
  z
    .object({
      ...EventPageBlockBaseFields,
      kind: z.literal("location"),
      title: z.string().max(160).nullable().optional(),
      note: z.string().max(1200).nullable().optional(),
      showMap: z.boolean().default(true),
    })
    .strict(),
  z
    .object({
      ...EventPageBlockBaseFields,
      kind: z.literal("sponsors"),
      title: z.string().max(160).nullable().optional(),
      entries: z.array(SponsorEntrySchema).max(20).default([]),
    })
    .strict(),
  z
    .object({
      ...EventPageBlockBaseFields,
      kind: z.literal("donate"),
      title: z.string().max(160).nullable().optional(),
      blurb: z.string().max(1200).nullable().optional(),
      url: SafeHttpsLinkSchema.nullable().optional(),
    })
    .strict(),
  z
    .object({
      ...EventPageBlockBaseFields,
      kind: z.literal("registration"),
      title: z.string().max(160).nullable().optional(),
      note: z.string().max(1200).nullable().optional(),
    })
    .strict(),
  z
    .object({
      ...EventPageBlockBaseFields,
      kind: z.literal("contact"),
      title: z.string().max(160).nullable().optional(),
      body: z.string().max(1200).nullable().optional(),
      replyTo: HostEventEmailSchema.nullable().optional(),
    })
    .strict(),
])
export type EventPageBlock = z.infer<typeof EventPageBlockUnionSchema>

export const EventPageBlockSchema: z.ZodType<EventPageBlock, z.ZodTypeDef, unknown> =
  EventPageBlockUnionSchema

export const MAX_EVENT_PAGE_BLOCKS = 24

export const EventPageThemeSchema = z
  .object({
    accent: ThemeAccentSchema.default("bloom"),
  })
  .strict()
export type EventPageTheme = z.infer<typeof EventPageThemeSchema>

export const EventPageSeoSchema = z
  .object({
    title: z.string().max(160).nullable().optional(),
    description: z.string().max(320).nullable().optional(),
    noindex: z.boolean().default(false),
  })
  .strict()
export type EventPageSeo = z.infer<typeof EventPageSeoSchema>

const EventPageObjectSchema = z.object({
  cleanupId: IdSchema,
  slug: z.string().nullable(),
  status: EventPageStatusSchema.default("draft"),
  theme: EventPageThemeSchema,
  coverMediaId: IdSchema.nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  blocks: z.array(EventPageBlockSchema).max(MAX_EVENT_PAGE_BLOCKS).default([]),
  seo: EventPageSeoSchema,
  visibility: EventVisibilitySchema.default("public"),
  publishedAt: ISODateSchema.nullable().optional(),
  updatedAt: ISODateSchema.nullable().optional(),
  flaggedAt: ISODateSchema.nullable().optional(),
  flagReason: z.string().nullable().optional(),
  viewCount: z.number().int().nonnegative().nullable().optional(),
})
export type EventPageDTO = z.infer<typeof EventPageObjectSchema>

export const EventPageDTOSchema: z.ZodType<EventPageDTO, z.ZodTypeDef, unknown> =
  EventPageObjectSchema

const InviteEventRefObjectSchema = z.object({
  id: IdSchema,
  title: z.string(),
  startsAt: ISODateSchema,
  endsAt: ISODateSchema.nullable().optional(),
  status: CleanupStatusSchema,
  coverThumbUrl: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
})
export type InviteEventRef = z.infer<typeof InviteEventRefObjectSchema>

export const InviteEventRefSchema: z.ZodType<InviteEventRef, z.ZodTypeDef, unknown> =
  InviteEventRefObjectSchema

const HostedEventObjectSchema = z.object({
  id: IdSchema,
  referenceCode: z.string().nullable().optional(),
  title: z.string(),
  startsAt: ISODateSchema,
  endsAt: ISODateSchema.nullable().optional(),
  timezone: z.string().nullable().optional(),
  status: CleanupStatusSchema,
  visibility: EventVisibilitySchema.default("public"),
  coverThumbUrl: z.string().nullable().optional(),
  registeredCount: z.number().int().nonnegative().default(0),
  capacity: z.number().int().nonnegative().nullable().optional(),
  checkedInCount: z.number().int().nonnegative().default(0),
  waitlistCount: z.number().int().nonnegative().default(0),
  hoursCredited: z.number().nonnegative().optional(),
  myRole: CleanupMemberRoleSchema.nullable().optional(),
  myCapabilities: z.array(HostCapabilitySchema).default([]),
  orgId: IdSchema.nullable().optional(),
  orgName: z.string().nullable().optional(),
  pageSlug: z.string().nullable().optional(),
  pageStatus: EventPageStatusSchema.nullable().optional(),
})
export type HostedEventDTO = z.infer<typeof HostedEventObjectSchema>

export const HostedEventDTOSchema: z.ZodType<HostedEventDTO, z.ZodTypeDef, unknown> =
  HostedEventObjectSchema

const BroadcastDTOObjectSchema = z.object({
  id: IdSchema,
  cleanupId: IdSchema,
  kind: BroadcastKindSchema,
  status: BroadcastStatusSchema,
  subject: z.string().nullable().optional(),
  bodyMd: z.string().nullable().optional(),
  ctaLabel: z.string().nullable().optional(),
  ctaUrl: z.string().nullable().optional(),
  segment: BroadcastSegmentSchema.nullable().optional(),
  channels: z.array(BroadcastChannelSchema).default([]),
  replyTo: z.string().nullable().optional(),
  reminderOffsetMin: z.number().int().nullable().optional(),
  scheduledAt: ISODateSchema.nullable().optional(),
  startedAt: ISODateSchema.nullable().optional(),
  finishedAt: ISODateSchema.nullable().optional(),
  recipientCount: z.number().int().nonnegative().default(0),
  sentCount: z.number().int().nonnegative().default(0),
  failedCount: z.number().int().nonnegative().default(0),
  suppressedCount: z.number().int().nonnegative().default(0),
  createdBy: PersonDTOSchema.nullable().optional(),
  createdAt: ISODateSchema,
  updatedAt: ISODateSchema.nullable().optional(),
  contentScrubbedAt: ISODateSchema.nullable().optional(),
})
export type BroadcastDTO = z.infer<typeof BroadcastDTOObjectSchema>
export const BroadcastDTOSchema: z.ZodType<BroadcastDTO, z.ZodTypeDef, unknown> =
  BroadcastDTOObjectSchema

export const RegistrationStateSchema = z.enum([
  "open",
  "not_yet_open",
  "closed",
  "full",
  "waitlist",
])
export type RegistrationState = z.infer<typeof RegistrationStateSchema>

const CleanupOrganizationRefObjectSchema = OrganizationRefDTOObjectSchema.extend({
  donationUrl: HttpsUrlSchema.nullable().optional(),
})
export type CleanupOrganizationRef = z.infer<typeof CleanupOrganizationRefObjectSchema>
export const CleanupOrganizationRefSchema: z.ZodType<CleanupOrganizationRef, z.ZodTypeDef, unknown> =
  CleanupOrganizationRefObjectSchema

const CleanupObjectSchema = z.object({
  id: IdSchema,
  referenceCode: z.string().optional(),
  jurisdictionGeoid: z.string().nullish(),
  title: z.string(),
  type: CleanupTypeSchema,
  eventKind: EventKindSchema.default("cleanup"),
  description: z.string().nullable().optional(),
  ...LatLngFields,
  scheduledAt: ISODateSchema,
  status: CleanupStatusSchema,
  organizer: PersonDTOSchema,
  going: z.number().int().nonnegative(),
  joined: z.boolean(),
  myRole: CleanupMemberRoleSchema.nullable().optional(),
  bring: z.array(z.string()),
  address: z.string().nullable().default(null),
  addressSource: EventAddressSourceSchema.nullable().optional(),
  dist: z.number().nullable().optional(),
  linkedReports: z.array(LinkedReportRefSchema).default([]),
  slots: z.array(EventSlotDTOSchema).default([]),
  slotCount: z.number().int().nonnegative().optional(),
  guestCount: z.number().int().nonnegative().optional(),
  endsAt: ISODateSchema.nullable().optional(),
  timezone: z.string().nullable().optional(),
  visibility: EventVisibilitySchema.default("public"),
  coverUrl: z.string().nullable().optional(),
  galleryUrls: z.array(z.string()).default([]),
  donationUrl: HttpsUrlSchema.nullable().optional(),
  donationClicks: z.number().int().nonnegative().nullable().optional(),
  pageSlug: z.string().nullable().optional(),
  pageStatus: EventPageStatusSchema.nullable().optional(),
  registrationOpensAt: ISODateSchema.nullable().optional(),
  registrationClosesAt: ISODateSchema.nullable().optional(),
  capacity: z.number().int().nonnegative().nullable().optional(),
  organization: CleanupOrganizationRefSchema.nullable().optional(),
  ticketTypes: z.array(TicketTypeDTOSchema).default([]),
  registrationState: RegistrationStateSchema.nullable().optional(),
  myRegistration: MyEventRegistrationRefSchema.nullable().optional(),
  myCapabilities: z.array(HostCapabilitySchema).default([]),
  registeredCount: z.number().int().nonnegative().optional(),
  waitlistCount: z.number().int().nonnegative().optional(),
  checkedInCount: z.number().int().nonnegative().optional(),
  teamCount: z.number().int().nonnegative().optional(),
  reminderOffsetsMinutes: z.array(z.number().int()).nullable().optional(),
})
export type CleanupDTO = z.infer<typeof CleanupObjectSchema>

export const CleanupDTOSchema: z.ZodType<CleanupDTO, z.ZodTypeDef, unknown> = CleanupObjectSchema


export const ReactionSummaryDTOSchema = z.object({
  emoji: z.string(),
  count: z.number().int().nonnegative(),
  mine: z.boolean(),
})
export type ReactionSummaryDTO = z.infer<typeof ReactionSummaryDTOSchema>

export const REACTION_EMOJIS = ["like", "heart", "celebrate", "support", "insightful", "concerned", "laugh", "sad"] as const
export const ReactionEmojiSchema = z.enum(REACTION_EMOJIS)
export type ReactionEmoji = z.infer<typeof ReactionEmojiSchema>

export const UserMentionDTOSchema = z.object({
  id: IdSchema,
  handle: z.string(),
  displayName: z.string(),
})
export type UserMentionDTO = z.infer<typeof UserMentionDTOSchema>



export const PostKindSchema = z.enum(["post", "repost", "quote", "reply"])
export type PostKind = z.infer<typeof PostKindSchema>

export const POST_KIND_VALUES = PostKindSchema.options
export type PostKindValue = (typeof POST_KIND_VALUES)[number]

const PostRefObjectSchema = z.object({
  id: IdSchema,
  author: PersonDTOSchema.nullable(),
  /**
   * The organization this post was published as (DECISIONS §34). When present the client renders
   * the org as the byline and the author as "via @handle". Null for a personal post.
   */
  organization: OrganizationRefDTOSchema.nullable().optional(),
  kind: PostKindSchema,
  excerpt: z.string(),
  createdAt: ISODateSchema,
  deleted: z.boolean().optional(),
  media: z.array(MediaDTOSchema).default([]),
  body: z.string().nullable().optional(),
  event: LinkedEventRefSchema.nullable().optional(),
  report: LinkedReportRefSchema.nullable().optional(),
})
export type PostRefDTO = z.infer<typeof PostRefObjectSchema>

export const PostRefDTOSchema: z.ZodType<PostRefDTO, z.ZodTypeDef, unknown> = PostRefObjectSchema

export const PostCountsSchema = z.object({
  likes: z.number().int().nonnegative(),
  reposts: z.number().int().nonnegative(),
  replies: z.number().int().nonnegative(),
  saves: z.number().int().nonnegative(),
})
export type PostCounts = z.infer<typeof PostCountsSchema>

export const PostViewerSchema = z.object({
  liked: z.boolean(),
  reposted: z.boolean(),
  saved: z.boolean(),
})
export type PostViewer = z.infer<typeof PostViewerSchema>

const PostDTOObjectSchema = z.object({
  id: IdSchema,
  author: PersonDTOSchema,
  /**
   * The organization this post was published as (DECISIONS §34). When present the client renders
   * the org as the byline and the author as "via @handle". Null for a personal post.
   */
  organization: OrganizationRefDTOSchema.nullable().optional(),
  kind: PostKindSchema,
  body: z.string().nullable().optional(),
  createdAt: ISODateSchema,
  editedAt: ISODateSchema.nullable().optional(),
  counts: PostCountsSchema,
  viewer: PostViewerSchema,
  media: z.array(MediaDTOSchema).default([]),
  mentions: z.array(UserMentionDTOSchema).default([]),
  event: LinkedEventRefSchema.nullable().optional(),
  report: LinkedReportRefSchema.nullable().optional(),
  repostOf: PostRefDTOSchema.nullable().optional(),
  replyToId: IdSchema.nullable().optional(),
  replyTo: PostRefDTOSchema.nullable().optional(),
  threadRootId: IdSchema.nullable().optional(),
})
export type PostDTO = z.infer<typeof PostDTOObjectSchema>

export const PostDTOSchema: z.ZodType<PostDTO, z.ZodTypeDef, unknown> = PostDTOObjectSchema


export const ChatMessageKindSchema = z.enum([
  "text",
  "share_pin",
  "task_complete",
  "rsvp_change",
  "system",
  "poll",
])
export type ChatMessageKind = z.infer<typeof ChatMessageKindSchema>

export const PollOptionDTOSchema = z.object({
  idx: z.number().int(),
  text: z.string(),
  count: z.number().int(),
  mine: z.boolean(),
})
export type PollOptionDTO = z.infer<typeof PollOptionDTOSchema>

export const PollDTOSchema = z.object({
  question: z.string(),
  options: z.array(PollOptionDTOSchema),
  allowMultiple: z.boolean(),
  anonymous: z.boolean(),
  closed: z.boolean(),
  totalVoters: z.number().int(),
  myVote: z.array(z.number().int()),
})
export type PollDTO = z.infer<typeof PollDTOSchema>

export const ReportSystemEventDTOSchema = z.object({
  status: ReportStatusSchema,
  kind: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
})
export type ReportSystemEventDTO = z.infer<typeof ReportSystemEventDTOSchema>

export const CityMentionDTOSchema = z.object({
  handle: z.string(),
  geoid: z.string(),
  name: z.string(),
  forwarded: z.boolean(),
})
export type CityMentionDTO = z.infer<typeof CityMentionDTOSchema>

export const ReplyToDTOSchema = z.object({
  id: IdSchema,
  from: z.object({ id: IdSchema, displayName: z.string() }).nullable(),
  excerpt: z.string(),
  kind: ChatMessageKindSchema,
  deleted: z.boolean().optional(),
})
export type ReplyToDTO = z.infer<typeof ReplyToDTOSchema>

export const ChatMessageDTOSchema = z.object({
  id: IdSchema,
  cleanupId: IdSchema,
  roomKind: z.enum(["cleanup", "dm", "report", "group"]).optional(),
  from: PersonDTOSchema.nullable().optional(),
  body: z.string().nullable().optional(),
  kind: ChatMessageKindSchema,
  attachments: z.array(MediaDTOSchema).nullable().optional(),
  createdAt: ISODateSchema,
  editedAt: ISODateSchema.nullable().optional(),
  deletedAt: ISODateSchema.nullable().optional(),
  mine: z.boolean().optional(),
  reactions: z.array(ReactionSummaryDTOSchema).default([]),
  mentions: z.array(UserMentionDTOSchema).default([]),
  clientId: z.string().optional(),
  system: ReportSystemEventDTOSchema.nullable().optional(),
  cityMention: CityMentionDTOSchema.nullable().optional(),
  forwardedToCity: z.boolean().optional(),
  replyToId: IdSchema.nullable().optional(),
  replyTo: ReplyToDTOSchema.nullable().optional(),
  pinnedAt: ISODateSchema.nullable().optional(),
  poll: PollDTOSchema.nullable().optional(),
})
export type ChatMessageDTO = z.infer<typeof ChatMessageDTOSchema>
