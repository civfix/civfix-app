import { z } from "zod"
import {
  EventPageStatusSchema,
  EventVisibilitySchema,
  IdSchema,
  ISODateSchema,
  LatLngFields,
  PageViewSourceSchema,
} from "../common.js"
import {
  CleanupStatusSchema,
  EventPageBlockSchema,
  EventPageDTOSchema,
  EventPageSeoSchema,
  EventPageThemeSchema,
  MAX_EVENT_PAGE_BLOCKS,
  OrganizationRefDTOSchema,
} from "../entities.js"
import { EventQuestionDTOSchema } from "./questions.js"


export {
  EventPageDTOSchema,
  EventPageBlockSchema,
  EventPageThemeSchema,
  EventPageSeoSchema,
  MAX_EVENT_PAGE_BLOCKS,
} from "../entities.js"
export type {
  EventPageDTO,
  EventPageBlock,
  EventPageTheme,
  EventPageSeo,
} from "../entities.js"
export { EventPageStatusSchema, EventPageBlockKindSchema, ThemeAccentSchema } from "../common.js"
export type { EventPageStatus, EventPageBlockKind, ThemeAccent } from "../common.js"

export const PAGE_SLUG_MIN = 3
export const PAGE_SLUG_MAX = 60

export const PageSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(PAGE_SLUG_MIN)
  .max(PAGE_SLUG_MAX)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
export type PageSlug = z.infer<typeof PageSlugSchema>

export const GetEventPageRequestSchema = z.object({ id: IdSchema }).strict()
export type GetEventPageRequest = z.infer<typeof GetEventPageRequestSchema>

export const GetEventPageResponseSchema = EventPageDTOSchema
export type GetEventPageResponse = z.infer<typeof GetEventPageResponseSchema>

export const SaveEventPageRequestSchema = z
  .object({
    id: IdSchema,
    slug: PageSlugSchema.nullable().optional(),
    theme: EventPageThemeSchema.optional(),
    coverMediaId: IdSchema.nullable().optional(),
    blocks: z.array(EventPageBlockSchema).max(MAX_EVENT_PAGE_BLOCKS),
    seo: EventPageSeoSchema.optional(),
  })
  .strict()
export type SaveEventPageRequest = z.infer<typeof SaveEventPageRequestSchema>

export const SaveEventPageResponseSchema = EventPageDTOSchema
export type SaveEventPageResponse = z.infer<typeof SaveEventPageResponseSchema>

export const PublishEventPageRequestSchema = z
  .object({ id: IdSchema, published: z.boolean() })
  .strict()
export type PublishEventPageRequest = z.infer<typeof PublishEventPageRequestSchema>

export const PublishEventPageResponseSchema = EventPageDTOSchema
export type PublishEventPageResponse = z.infer<typeof PublishEventPageResponseSchema>

export const CheckEventPageSlugRequestSchema = z
  .object({ id: IdSchema, slug: PageSlugSchema })
  .strict()
export type CheckEventPageSlugRequest = z.infer<typeof CheckEventPageSlugRequestSchema>

const CheckEventPageSlugResponseObjectSchema = z.object({
  available: z.boolean(),
  reason: z.enum(["taken", "reserved", "invalid"]).nullable().optional(),
  suggestion: z.string().nullable().optional(),
})
export type CheckEventPageSlugResponse = z.infer<typeof CheckEventPageSlugResponseObjectSchema>
export const CheckEventPageSlugResponseSchema: z.ZodType<CheckEventPageSlugResponse, z.ZodTypeDef, unknown> =
  CheckEventPageSlugResponseObjectSchema

export const PublicPageTicketTypeSchema = z.object({
  id: IdSchema,
  name: z.string(),
  description: z.string().nullable().optional(),
  maxPartySize: z.number().int().min(1).max(10).default(1),
  salesOpensAt: ISODateSchema.nullable().optional(),
  salesClosesAt: ISODateSchema.nullable().optional(),
  soldOut: z.boolean().default(false),
  salesOpen: z.boolean().default(true),
  waitlistEnabled: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  requiresAccessCode: z.boolean().default(false),
})
export type PublicPageTicketType = z.infer<typeof PublicPageTicketTypeSchema>

export const PublicEventPageEventSchema = z.object({
  id: IdSchema,
  referenceCode: z.string().nullable().optional(),
  title: z.string(),
  description: z.string().nullable().optional(),
  startsAt: ISODateSchema,
  endsAt: ISODateSchema.nullable().optional(),
  timezone: z.string().nullable().optional(),
  status: CleanupStatusSchema,
  address: z.string().nullable().optional(),
  ...LatLngFields,
  registrationOpensAt: ISODateSchema.nullable().optional(),
  registrationClosesAt: ISODateSchema.nullable().optional(),
})
export type PublicEventPageEvent = z.infer<typeof PublicEventPageEventSchema>

const PublicEventPageObjectSchema = z.object({
  slug: z.string(),
  status: EventPageStatusSchema,
  visibility: EventVisibilitySchema,
  noindex: z.boolean().default(false),
  theme: EventPageThemeSchema,
  coverUrl: z.string().nullable(),
  logoUrl: z.string().nullable().optional(),
  blocks: z.array(EventPageBlockSchema).default([]),
  seo: EventPageSeoSchema,
  event: PublicEventPageEventSchema,
  organization: OrganizationRefDTOSchema.nullable().optional(),
  ticketTypes: z.array(PublicPageTicketTypeSchema).default([]),
  questions: z.array(EventQuestionDTOSchema).default([]),
  consentVersions: z
    .object({
      termsVersion: z.string(),
      disclosureVersion: z.string(),
    })
    .strict(),
  waitlistEnabled: z.boolean().default(false),
  donationUrl: z.string().nullable().optional(),
  donateSlug: z.string().nullable().optional(),
  requiresTurnstile: z.boolean().default(true),
})
export type PublicEventPageDTO = z.infer<typeof PublicEventPageObjectSchema>

export const PublicEventPageDTOSchema: z.ZodType<PublicEventPageDTO, z.ZodTypeDef, unknown> =
  PublicEventPageObjectSchema

export const GetPublicEventPageRequestSchema = z.object({ slug: PageSlugSchema }).strict()
export type GetPublicEventPageRequest = z.infer<typeof GetPublicEventPageRequestSchema>

export const GetPublicEventPageResponseSchema = PublicEventPageDTOSchema
export type GetPublicEventPageResponse = z.infer<typeof GetPublicEventPageResponseSchema>

export const RecordEventPageViewRequestSchema = z
  .object({
    slug: PageSlugSchema,
    source: PageViewSourceSchema.optional(),
    utmSource: z.string().trim().max(64).optional(),
  })
  .strict()
export type RecordEventPageViewRequest = z.infer<typeof RecordEventPageViewRequestSchema>

const RecordEventPageViewResponseObjectSchema = z.object({ ok: z.literal(true) })
export type RecordEventPageViewResponse = z.infer<typeof RecordEventPageViewResponseObjectSchema>
export const RecordEventPageViewResponseSchema: z.ZodType<RecordEventPageViewResponse, z.ZodTypeDef, unknown> =
  RecordEventPageViewResponseObjectSchema
