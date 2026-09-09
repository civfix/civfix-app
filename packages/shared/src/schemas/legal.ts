import { z } from "zod"
import { ISODateSchema } from "./common.js"
import { LegalDocumentVersionDTOSchema } from "./entities.js"


export { LegalDocumentVersionDTOSchema } from "./entities.js"
export type { LegalDocumentVersionDTO } from "./entities.js"
export { LegalDocumentTypeSchema, ConsentSurfaceSchema } from "./common.js"
export type { LegalDocumentType, ConsentSurface } from "./common.js"

const GetLegalVersionsResponseObjectSchema = z.object({
  documents: z.array(LegalDocumentVersionDTOSchema),
  generatedAt: ISODateSchema,
})
export type GetLegalVersionsResponse = z.infer<typeof GetLegalVersionsResponseObjectSchema>
export const GetLegalVersionsResponseSchema: z.ZodType<GetLegalVersionsResponse, z.ZodTypeDef, unknown> =
  GetLegalVersionsResponseObjectSchema
