import { z } from "zod"

/**
 * User verification ("verified community organizer").
 *
 * Verification is a cosmetic trust signal: a `verified` account (and the events it hosts) shows a
 * verified mark; events hosted by unverified users show a disclaimer. There is NO in-app application:
 * to get verified a user schedules a short call with the founder (an external scheduling link), and an
 * operator marks the account verified afterward from the admin Users section. The only state a user can
 * be in is `unverified` (the default, server-side the ABSENCE of a user_verification row) or `verified`.
 *
 * The enum keeps the historical `pending`/`rejected` members because the underlying user_verification
 * table (and its CHECK constraint) is unchanged - those values are simply no longer produced by any
 * flow, and the clients treat anything other than `verified` as "not verified".
 */

export const VerificationStatusSchema = z.enum(["unverified", "pending", "verified", "rejected"])
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>

/**
 * The viewer's own verification state (GET /me/verification). Drives the "Verified community organizer" mark vs the
 * "Get verified" call-to-action on the own profile. Carries only the status - there are no documents,
 * notes, or review timestamps to surface anymore.
 */
export const MyVerificationDTOSchema = z.object({
  status: VerificationStatusSchema,
})
export type MyVerificationDTO = z.infer<typeof MyVerificationDTOSchema>

export const GetMyVerificationResponseSchema = z.object({
  verification: MyVerificationDTOSchema,
})
export type GetMyVerificationResponse = z.infer<typeof GetMyVerificationResponseSchema>
