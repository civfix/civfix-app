/**
 * Admin schema building blocks shared by several admin schema files. Deliberately not re-exported from
 * the admin barrel: the published surface of @civfix/shared must not grow just because two files share a
 * field.
 */
import { z } from "zod"
import { ReportCategorySchema } from "../common.js"

export const RoutingContactFields = {
  contacts: z.record(ReportCategorySchema, z.string().email().nullable()).optional(),
  defaultEmails: z.array(z.string().email()).optional(),
  formUrl: z.string().url().nullable().optional(),
} as const

export const AdminMediaRefSchema = z
  .object({
    id: z.string(),
    kind: z.enum(["image", "video"]),
    url: z.string(),
    thumbUrl: z.string().nullable().optional(),
  })
  .strict()
