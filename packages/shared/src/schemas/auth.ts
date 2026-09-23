import { z } from "zod"
import { IdSchema, ISODateSchema, OAuthProviderSchema } from "./common.js"
import { RoleSchema } from "../types/roles.js"

/**
 * The supported app locales; `en` is the source of truth and the fallback. This is the single locale
 * enum across the contract: UserDTO, the /me write path and the @civfix/ui i18n layer all validate
 * against it.
 */
export const LocaleEnum = z.enum(["en", "es", "de", "ko"])
export type SupportedLocale = z.infer<typeof LocaleEnum>

export const AppleSignInRequestSchema = z
  .object({
    identityToken: z.string().min(1),
    nonce: z.string().optional(),
    fullName: z.string().optional(),
  })
  .strict()
export type AppleSignInRequest = z.infer<typeof AppleSignInRequestSchema>

export const GoogleSignInRequestSchema = z
  .object({
    idToken: z.string().min(1),
    // Replay defense: the native client passes a per-sign-in CSPRNG nonce to Google and echoes it here so
    // the backend can bind the id_token to this request. Optional so already-built clients still parse.
    nonce: z.string().optional(),
  })
  .strict()
export type GoogleSignInRequest = z.infer<typeof GoogleSignInRequestSchema>

export const OAuthStartQuerySchema = z
  .object({
    redirect: z.string().optional(),
  })
  .strict()
export type OAuthStartQuery = z.infer<typeof OAuthStartQuerySchema>

// Not `.strict()`: the identity provider builds this URL and appends its own params (`iss`, `scope`,
// `authuser`, `prompt`, `hd`, ...). Zod's default strips them and only `code`/`state` are read.
export const OAuthCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
})
export type OAuthCallbackQuery = z.infer<typeof OAuthCallbackQuerySchema>

// Apple requires `response_mode=form_post` when name/email scopes are requested, so the callback
// arrives as a form-encoded body. Not `.strict()`: the provider controls the keys. `user` is a JSON
// string Apple sends only on the first authorization; it is absent on every later sign-in.
export const AppleCallbackBodySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  user: z.string().optional(),
})
export type AppleCallbackBody = z.infer<typeof AppleCallbackBodySchema>

export const EmailOtpRequestRequestSchema = z
  .object({
    email: z.string().email(),
  })
  .strict()
export type EmailOtpRequestRequest = z.infer<typeof EmailOtpRequestRequestSchema>

export const EmailOtpRequestResponseSchema = z.object({
  sent: z.literal(true),
  resendAfterSec: z.number().int().nonnegative(),
})
export type EmailOtpRequestResponse = z.infer<typeof EmailOtpRequestResponseSchema>

export const REVIEWER_OTP_EMAIL = "reviewer@civfix.org"

export const REVIEWER_OTP_CODE_MIN_LENGTH = 20
export const REVIEWER_OTP_CODE_MAX_LENGTH = 128

export const OtpCodeSchema = z.union([
  z.string().regex(/^\d{6}$/),
  z.string().min(REVIEWER_OTP_CODE_MIN_LENGTH).max(REVIEWER_OTP_CODE_MAX_LENGTH),
])

export const EmailOtpVerifyRequestSchema = z
  .object({
    email: z.string().email(),
    code: OtpCodeSchema,
  })
  .strict()
export type EmailOtpVerifyRequest = z.infer<typeof EmailOtpVerifyRequestSchema>

export const UserDTOSchema = z.object({
  id: IdSchema,
  displayName: z.string(),
  handle: z.string().nullable().optional(),
  // Null for accounts without one (Apple private relay omitted); optional so older servers parse.
  email: z.string().email().nullable().optional(),
  // Provider profile photo URL; null means render the letter monogram. Optional so older servers parse.
  avatarUrl: z.string().nullable().optional(),
  // Whether first-run registration (username + name) is done. The first-run gate triggers only on an
  // explicit `false`, so an older server that omits it never traps a user in onboarding.
  profileComplete: z.boolean().optional(),
  // Whether the account accepts new direct messages. When false the user is hidden from people search
  // and openDm toward them is rejected; existing threads keep working. Absent means true (the server
  // default). Written via PUT /me/settings.
  allowDirectMessages: z.boolean().optional(),
  // Whether the public profile and the jurisdiction leaderboard show this user's volunteer hours.
  // Absent means true (the server default). Written via PUT /me/settings.
  showVolunteerHours: z.boolean().optional(),
  // When the user may next change their @handle (30-day cooldown); null means changeable now.
  handleChangeableAt: z.string().datetime().nullable().optional(),
  // Drives client UI language and server-generated copy. `.catch` coerces an out-of-domain value and
  // `.default` fills an absent one, so a server with a newer or missing locale still parses.
  locale: LocaleEnum.catch("en").default("en"),
  // Which organization membership is published as the profile affiliation badge (DECISIONS §34); null
  // means the earliest membership. Optional so older servers parse.
  primaryOrganizationId: IdSchema.nullable().optional(),
  role: RoleSchema,
  createdAt: ISODateSchema,
})
export type UserDTO = z.infer<typeof UserDTOSchema>

export const SessionResponseSchema = z.object({
  user: UserDTOSchema,
  // Bearer token for mobile; omitted for web (cookie session).
  token: z.string().optional(),
  csrfToken: z.string().optional(),
  guestSmsEnabled: z.boolean().optional(),
})
export type SessionResponse = z.infer<typeof SessionResponseSchema>

export const SessionCheckResponseSchema = z.object({
  authenticated: z.boolean(),
  user: UserDTOSchema.optional(),
  roles: z.array(RoleSchema),
  // Sign-in providers the server has configured, so the web shows only the buttons that work.
  enabledProviders: z.array(OAuthProviderSchema).optional(),
  // Lets the web SPA recover its CSRF token after a page reload or OAuth redirect, when only
  // GET /auth/session runs.
  csrfToken: z.string().optional(),
  guestSmsEnabled: z.boolean().optional(),
})
export type SessionCheckResponse = z.infer<typeof SessionCheckResponseSchema>

export const LogoutResponseSchema = z.object({
  ok: z.literal(true),
})
export type LogoutResponse = z.infer<typeof LogoutResponseSchema>

/**
 * A short-lived, single-use WebSocket connect ticket. RN WebSocket cannot set headers, so native clients
 * pass this as `?ticket=` instead of the session bearer, which must never appear in a URL (access logs,
 * proxies, history). Deleted at handshake; expires in seconds.
 */
export const WsTicketResponseSchema = z.object({
  ticket: z.string(),
  expiresInSeconds: z.number().int().positive(),
})
export type WsTicketResponse = z.infer<typeof WsTicketResponseSchema>
