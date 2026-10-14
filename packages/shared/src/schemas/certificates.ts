import { z } from "zod"
import { SupportedLocaleSchema } from "./auth.js"

/*
 * A certificate is a PDF the holder deliberately hands to a verifier (a school registrar, a court
 * clerk). The printed code is the capability: it travels on the paper, so verification confirms only
 * what is already printed there and never hands out the document itself.
 */

/** Crockford base32 (no `I`, `L`, `O`, `U`), so a hand-typed code off paper is unambiguous. */
export const CERTIFICATE_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
export const CERTIFICATE_CODE_LENGTH = 12
/** Canonical wire form: 12 uppercase Crockford chars, no separators. 32^12 ~= 2^60. */
export const CERTIFICATE_CODE_RE = /^[0-9A-HJKMNP-TV-Z]{12}$/

/** Loose human input -> canonical 12-char form, or null when it cannot be one. */
export function normalizeCertificateCode(raw: string): string | null {
  const up = raw.toUpperCase().replace(/[^0-9A-Z]/g, "")
  const fold = (s: string) => s.replace(/[ILO]/g, (c) => (c === "O" ? "0" : "1")).replace(/U/g, "V")
  // Try the bare form first, then the CFX-prefixed form. C, F and X are all valid Crockford symbols,
  // so a genuine code can itself begin with "CFX", and an unconditional prefix strip would corrupt it.
  for (const cand of [up, up.startsWith("CFX") ? up.slice(3) : ""]) {
    if (cand.length !== CERTIFICATE_CODE_LENGTH) continue
    const folded = fold(cand)
    if (CERTIFICATE_CODE_RE.test(folded)) return folded
  }
  return null
}

/** Canonical -> printed/display form (`CFX-XXXX-XXXX-XXXX`). `CFX-` is display only. */
export function formatCertificateCode(code: string): string {
  return `CFX-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`
}

/** Loose-in, canonical-out. Accepts "cfx-a1b2-c3d4-e5f6", " A1B2C3D4E5F6 ", etc. */
export const CertificateCodeSchema = z
  .string()
  .min(CERTIFICATE_CODE_LENGTH)
  .max(32)
  .transform((s) => normalizeCertificateCode(s) ?? s)
  .pipe(z.string().regex(CERTIFICATE_CODE_RE))

export const CertificateStatusSchema = z.enum(["valid", "revoked"])
export type CertificateStatus = z.infer<typeof CertificateStatusSchema>

/** Max ledger rows itemised on one document; beyond this the PDF prints a truncation banner. */
export const MAX_CERTIFICATE_ENTRIES = 1000
/**
 * Presigned GET lifetime for the rendered PDF. Longer than the 5-min private-media TTL because the
 * mobile hand-off (openExternal -> app switch -> browser cold start) does not fit in five minutes;
 * the URL is re-mintable at any time, so the leak window is short and the UX cost of expiry is zero.
 */
export const CERTIFICATE_GET_URL_TTL_SEC = 15 * 60

/** The holder-facing view. `url` is null when the document is not currently downloadable. */
export const ServiceHoursCertificateDTOSchema = z.object({
  code: z.string(),
  status: CertificateStatusSchema.or(z.string()), // tolerant: a future "pending" must not break parsing
  locale: z.string(),
  issuedAt: z.string(),
  totalHours: z.number().nonnegative(),
  entryCount: z.number().int().nonnegative(),
  periodStart: z.string().nullable().optional(),
  periodEnd: z.string().nullable().optional(),
  documentSha256: z.string().nullable().optional(),
  byteSize: z.number().int().nonnegative().nullable().optional(),
  url: z.string().nullable().optional(),
  urlExpiresAt: z.string().nullable().optional(),
  revokedAt: z.string().nullable().optional(),
})
export type ServiceHoursCertificateDTO = z.infer<typeof ServiceHoursCertificateDTOSchema>

/**
 * Issues over the whole ledger: no geoid / from / to filters and no recipient field, because filters
 * multiply documents against the fingerprint-keyed idempotency. `periodStart`/`periodEnd` are the
 * derived min/max of the included rows.
 */
export const IssueServiceHoursCertificateRequestSchema = z
  .object({ locale: SupportedLocaleSchema.optional() })
  .strict()
export type IssueServiceHoursCertificateRequest = z.infer<
  typeof IssueServiceHoursCertificateRequestSchema
>

export const IssueServiceHoursCertificateResponseSchema = z.object({
  certificate: ServiceHoursCertificateDTOSchema,
  /** True when an existing document was reused rather than freshly rendered. */
  reused: z.boolean().optional(),
})
export type IssueServiceHoursCertificateResponse = z.infer<
  typeof IssueServiceHoursCertificateResponseSchema
>

export const ListMyCertificatesResponseSchema = z.object({
  certificates: z.array(ServiceHoursCertificateDTOSchema),
})
export type ListMyCertificatesResponse = z.infer<typeof ListMyCertificatesResponseSchema>

/**
 * `code` is a path param on `POST /me/volunteer-hours/certificates/:code/revoke`, but a static segment
 * follows it, so the client cannot type-extract it: the request schema carries it and the backend
 * merges the path param back in before parsing.
 */
export const RevokeCertificateRequestSchema = z.object({ code: CertificateCodeSchema }).strict()
export type RevokeCertificateRequest = z.infer<typeof RevokeCertificateRequestSchema>

export const RevokeCertificateResponseSchema = z.object({
  certificate: ServiceHoursCertificateDTOSchema,
})
export type RevokeCertificateResponse = z.infer<typeof RevokeCertificateResponseSchema>

export const VerifyCertificateRequestSchema = z.object({ code: CertificateCodeSchema }).strict()
export type VerifyCertificateRequest = z.infer<typeof VerifyCertificateRequestSchema>

/**
 * Public projection. Every field here is already printed on the document the verifier is holding.
 *
 * NEVER add `userId`, an email, the R2 key, the PDF URL, a presigned link, the per-event rows or the
 * stored snapshot. Anyone holding the code already holds the document; turning the code into a
 * download link would make a leaked code far more damaging than a leaked page.
 *
 * `showVolunteerHours` (the profile privacy flag) does NOT gate this: that flag governs the public
 * profile projection, a surface the holder never explicitly shared. Revocation is the control here.
 */
export const VerifyCertificateResponseSchema = z.object({
  code: z.string(),
  status: CertificateStatusSchema.or(z.string()),
  holderName: z.string().nullable().optional(),
  holderHandle: z.string().nullable().optional(),
  verifiedHolder: z.boolean().optional(),
  issuedAt: z.string(),
  totalHours: z.number().nonnegative(),
  entryCount: z.number().int().nonnegative(),
  periodStart: z.string().nullable().optional(),
  periodEnd: z.string().nullable().optional(),
  jurisdictionNames: z.array(z.string()).optional(),
  documentSha256: z.string().nullable().optional(),
  revokedAt: z.string().nullable().optional(),
  revokedReason: z.string().nullable().optional(),
})
export type VerifyCertificateResponse = z.infer<typeof VerifyCertificateResponseSchema>
