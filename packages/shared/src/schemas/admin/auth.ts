import { z } from "zod"
import { IdSchema } from "../common.js"
import { RoleSchema } from "../../types/roles.js"
import { SessionResponseSchema } from "../auth.js"

/**
 * Admin / operator authentication via Cloudflare Access (Zero Trust) SSO (see doc
 * 16-admin-cloudflare-access). The bespoke admin Email-OTP front door has been removed; the only way to
 * obtain an operator session is the exchange route `POST /admin/auth/access/exchange`, which carries no
 * request body - the backend reads and cryptographically verifies the `Cf-Access-Jwt-Assertion` header
 * injected by the edge Access app, maps the verified email to the `operator` role (still gated by the
 * `ADMIN_EMAILS` allowlist), and mints the Phase 1 web session. `ADMIN_EMAILS` is retained purely as the
 * in-app authorization allowlist. The session check returns the operator identity.
 */

/**
 * On a successful Access exchange the operator gets a Phase 1 session (web cookie + CSRF token, optional
 * bearer for parity). Reuses SessionResponse so the dashboard's login flow and the citizen apps share
 * the exact session envelope.
 */
export const AdminLoginResponseSchema = SessionResponseSchema
export type AdminLoginResponse = z.infer<typeof AdminLoginResponseSchema>

/** The operator identity shown across the dashboard shell (decisions section 1: {id,name,email,role}). */
export const AdminOperatorDTOSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    email: z.string().email(),
    role: RoleSchema,
  })
  .strict()
export type AdminOperatorDTO = z.infer<typeof AdminOperatorDTOSchema>

/**
 * GET /admin/auth/session result. `authenticated` is false (operator absent) when there is no valid
 * operator session; otherwise `operator` carries the identity and `csrfToken` lets the SPA recover
 * its token after a reload.
 */
export const AdminSessionResponseSchema = z.object({
  authenticated: z.boolean(),
  operator: AdminOperatorDTOSchema.optional(),
  csrfToken: z.string().optional(),
})
export type AdminSessionResponse = z.infer<typeof AdminSessionResponseSchema>

export const AdminLogoutResponseSchema = z.object({
  ok: z.literal(true),
})
export type AdminLogoutResponse = z.infer<typeof AdminLogoutResponseSchema>
