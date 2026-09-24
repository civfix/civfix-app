/**
 * Field building blocks shared by several schema files. Deliberately not re-exported from the package
 * barrel: the published surface of @civfix/shared must not grow just because two files share a field.
 */
import { z } from "zod"
import {
  GeomSourceSchema,
  GUEST_MANAGE_TOKEN_MAX_LENGTH,
  GUEST_MANAGE_TOKEN_MIN_LENGTH,
  IdSchema,
  LatLngFields,
  ReportCategorySchema,
  ReportTypeSchema,
} from "./common.js"

export const MAX_MENTIONED_USERS = 20

const MAX_SORT_ORDER = 1000
const IDEMPOTENCY_KEY_MIN_LENGTH = 8
const IDEMPOTENCY_KEY_MAX_LENGTH = 128
const MAX_REPORT_MEDIA_UPLOADS = 5

export const MAX_REPORT_ADDR_LENGTH = 300

export const SortOrderInputSchema = z.number().int().min(0).max(MAX_SORT_ORDER).optional()

// Cleanup and registration requests; report requests validate their key with IdSchema instead.
export const IdempotencyKeySchema = z
  .string()
  .min(IDEMPOTENCY_KEY_MIN_LENGTH)
  .max(IDEMPOTENCY_KEY_MAX_LENGTH)

export const GuestManageTokenSchema = z
  .string()
  .min(GUEST_MANAGE_TOKEN_MIN_LENGTH)
  .max(GUEST_MANAGE_TOKEN_MAX_LENGTH)

// The signed-in and anonymous report requests share these fields; the two groups are split so each
// request keeps its own key order (and so its issue order) around the fields only it carries.
export const ReportContentFields = {
  category: ReportCategorySchema,
  type: ReportTypeSchema,
  // A photo-only report omits the title and reads as the category label.
  title: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  // Display label only; lat/lng stays canonical. Without it the operator console falls back to the
  // jurisdiction.
  addr: z.string().max(MAX_REPORT_ADDR_LENGTH).optional(),
  ...LatLngFields,
  geomSource: GeomSourceSchema,
} as const

export const ReportMediaAndHoneypotFields = {
  mediaUploadIds: z.array(IdSchema).max(MAX_REPORT_MEDIA_UPLOADS),
  // Anti-spam honeypot: empty or absent for a legitimate submission.
  honeypot: z.string().optional(),
} as const
