import { z } from "zod"
import { IdSchema, PaginationQuerySchema } from "../common.js"
import { HostedEventDTOSchema } from "../entities.js"


export { HostedEventDTOSchema } from "../entities.js"
export type { HostedEventDTO } from "../entities.js"

export const HostedEventsWhenSchema = z.enum(["upcoming", "past", "all"])
export type HostedEventsWhen = z.infer<typeof HostedEventsWhenSchema>

export const ListMyHostedEventsRequestSchema = PaginationQuerySchema.extend({
  when: HostedEventsWhenSchema.optional(),
  orgId: IdSchema.optional(),
}).strict()
export type ListMyHostedEventsRequest = z.infer<typeof ListMyHostedEventsRequestSchema>

export const HostPortfolioKpisSchema = z.object({
  eventsHosted: z.number().int().nonnegative(),
  upcomingEvents: z.number().int().nonnegative(),
  totalRegistrations: z.number().int().nonnegative(),
  totalCheckedIn: z.number().int().nonnegative(),
})
export type HostPortfolioKpis = z.infer<typeof HostPortfolioKpisSchema>

const ListMyHostedEventsResponseObjectSchema = z.object({
  items: z.array(HostedEventDTOSchema),
  nextCursor: z.string().nullable(),
  kpis: HostPortfolioKpisSchema.optional(),
})
export type ListMyHostedEventsResponse = z.infer<typeof ListMyHostedEventsResponseObjectSchema>
export const ListMyHostedEventsResponseSchema: z.ZodType<ListMyHostedEventsResponse, z.ZodTypeDef, unknown> =
  ListMyHostedEventsResponseObjectSchema
