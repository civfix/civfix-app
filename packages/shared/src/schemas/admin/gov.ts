import { z } from "zod"
import { pageResponse } from "../common.js"
import {
  AdminListQuerySchema,
  GovCheckStatusSchema,
  GovClaimStatusSchema,
  GovMethodSchema,
  GovVerificationCheckSchema,
} from "./common.js"

/**
 * Gov-provisioning queue: an operator verifies an applicant's LinkedIn / municipal Directory / phone
 * Callback, then provisions gov_admin linked to the jurisdiction (by GEOID). List + detail, update a
 * verification check, approve (provision), reject. All audited. See enumeration 2.H, endpoints
 * #36-#40.
 */

/** One verification check's state: its status, optional evidence link, and an operator note. */
export const GovCheckSchema = z
  .object({
    status: GovCheckStatusSchema,
    evidence: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
  })
  .strict()
export type GovCheck = z.infer<typeof GovCheckSchema>

/** The full per-check verification map (linkedin / directory / callback -> check state). */
export const GovChecksSchema = z
  .object({
    linkedin: GovCheckSchema,
    directory: GovCheckSchema,
    callback: GovCheckSchema,
  })
  .strict()
export type GovChecks = z.infer<typeof GovChecksSchema>

/**
 * A gov-provisioning claim. `verified[]`/`pending[]` are the completed vs outstanding checks (the row
 * pills); `checks` is the full per-check map shown in the detail. `method` is how they reached us;
 * `jurisdictionGeoid` is the jurisdiction to link on approval.
 */
export const GovClaimDTOSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    title: z.string(),
    org: z.string(),
    jurisdictionGeoid: z.string().nullable(),
    method: GovMethodSchema,
    status: GovClaimStatusSchema,
    age: z.string(),
    contactEmail: z.string().email(),
    verified: z.array(GovVerificationCheckSchema),
    pending: z.array(GovVerificationCheckSchema),
    checks: GovChecksSchema,
  })
  .strict()
export type GovClaimDTO = z.infer<typeof GovClaimDTOSchema>

/** Gov-claims list query: search matches name/org; `filter` narrows by claim status. */
export const GovClaimListQuerySchema = AdminListQuerySchema.extend({
  filter: z.enum(["all", "pending", "approved", "rejected"]).optional(),
})
export type GovClaimListQuery = z.infer<typeof GovClaimListQuerySchema>

export const GovClaimListResponseSchema = pageResponse(GovClaimDTOSchema)
export type GovClaimListResponse = z.infer<typeof GovClaimListResponseSchema>

export const GetGovClaimResponseSchema = GovClaimDTOSchema
export type GetGovClaimResponse = z.infer<typeof GetGovClaimResponseSchema>

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Mark a verification check verified/pending with optional evidence + note. */
export const VerifyCheckRequestSchema = z
  .object({
    id: z.string(),
    check: GovVerificationCheckSchema,
    status: GovCheckStatusSchema,
    evidence: z.string().max(2000).optional(),
    note: z.string().max(2000).optional(),
  })
  .strict()
export type VerifyCheckRequest = z.infer<typeof VerifyCheckRequestSchema>

/** Approve a claim -> provision gov_admin and link the jurisdiction. */
export const ApproveGovClaimRequestSchema = z
  .object({
    id: z.string(),
    note: z.string().max(2000).optional(),
  })
  .strict()
export type ApproveGovClaimRequest = z.infer<typeof ApproveGovClaimRequestSchema>

/** Reject a claim with a reason ("Reject / request more info"). */
export const RejectGovClaimRequestSchema = z
  .object({
    id: z.string(),
    reason: z.string().min(1).max(2000),
  })
  .strict()
export type RejectGovClaimRequest = z.infer<typeof RejectGovClaimRequestSchema>
