import { z } from "zod"
import { IdSchema, MediaKindSchema } from "./common.js"
import { MediaDTOSchema } from "./entities.js"

export { MediaDTOSchema } from "./entities.js"
export type { MediaDTO } from "./entities.js"

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024

export const CreateMediaUploadRequestSchema = z
  .object({
    kind: MediaKindSchema,
    contentType: z.string().min(1),
    byteSize: z.number().int().positive().max(MAX_VIDEO_BYTES),
    sha256: z.string().min(1),
  })
  .strict()
  .superRefine((val, ctx) => {
    const max = val.kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
    if (val.byteSize > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        type: "number",
        maximum: max,
        inclusive: true,
        path: ["byteSize"],
        message: `byteSize exceeds the ${val.kind} limit of ${max} bytes`,
      })
    }
  })
export type CreateMediaUploadRequest = z.infer<typeof CreateMediaUploadRequestSchema>

export const CreateMediaUploadResponseSchema = z.object({
  uploadId: IdSchema,
  putUrl: z.string(),
  headers: z.record(z.string()),
})
export type CreateMediaUploadResponse = z.infer<typeof CreateMediaUploadResponseSchema>

export const FinalizeMediaRequestSchema = z
  .object({
    uploadId: IdSchema,
  })
  .strict()
export type FinalizeMediaRequest = z.infer<typeof FinalizeMediaRequestSchema>

export const FinalizeMediaResponseSchema = z.object({
  mediaId: IdSchema,
  status: z.literal("validating"),
})
export type FinalizeMediaResponse = z.infer<typeof FinalizeMediaResponseSchema>

export const GetMediaResponseSchema = MediaDTOSchema
export type GetMediaResponse = z.infer<typeof GetMediaResponseSchema>
