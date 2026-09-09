import { z } from "zod"
import { IdSchema } from "../common.js"


export const GetEventIcsRequestSchema = z.object({ id: IdSchema }).strict()
export type GetEventIcsRequest = z.infer<typeof GetEventIcsRequestSchema>

const GetEventIcsResponseObjectSchema = z.object({
  ics: z.string(),
  filename: z.string(),
})
export type GetEventIcsResponse = z.infer<typeof GetEventIcsResponseObjectSchema>
export const GetEventIcsResponseSchema: z.ZodType<GetEventIcsResponse, z.ZodTypeDef, unknown> =
  GetEventIcsResponseObjectSchema
