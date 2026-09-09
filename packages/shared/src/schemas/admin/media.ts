import { z } from "zod"
import { IdSchema, ISODateSchema } from "../common.js"
import { MediaDTOSchema } from "../entities.js"


export const AdminGetMediaRequestSchema = z.object({ id: IdSchema }).strict()
export type AdminGetMediaRequest = z.infer<typeof AdminGetMediaRequestSchema>

const AdminGetMediaResponseObjectSchema = z.object({
  media: MediaDTOSchema,
  expiresAt: ISODateSchema,
})
export type AdminGetMediaResponse = z.infer<typeof AdminGetMediaResponseObjectSchema>
export const AdminGetMediaResponseSchema: z.ZodType<AdminGetMediaResponse, z.ZodTypeDef, unknown> =
  AdminGetMediaResponseObjectSchema
