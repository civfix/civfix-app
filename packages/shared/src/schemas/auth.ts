import { z } from "zod"
import { IdSchema, ISODateSchema, OAuthProviderSchema } from "./common.js"
import { RoleSchema } from "../types/roles.js"

/**
 * Authentication and session schemas (Apple / Google / email OTP, plus session checks).
 */

/**
 * The supported app locales. `en` is the source of truth + fallback; `es`/`de`/`ko` are the localized
 * targets. This is the SINGLE source for the locale enum across the contract (the UserDTO, the /me write
 * path, and the @civfix/ui i18n layer all clamp to / validate against this set).
 */
export const LocaleEnum = z.enum(["en", "es", "de", "ko"])
/** A supported app locale: one of `"en" | "es" | "de" | "ko"`. */
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
    // Optional replay-defense nonce (mirrors the Apple flow): the native client generates a per-sign-in
    // CSPRNG nonce, passes it to Google's native sign-in, and echoes it here so the backend can bind the
    // id_token to this request. Optional so already-built clients that omit it still parse.
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

// The OAuth callback URL is built by the identity provider, not by us: Google appends
// provider-owned params alongside ours (`iss`, `scope`, `authuser`, `prompt`, `hd`, ...).
// Unlike our own request bodies, this is third-party-controlled input, so it must NOT be
// `.strict()` - Zod's default strips the unknown keys and we read only `code`/`state`.
export const OAuthCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
})
export type OAuthCallbackQuery = z.infer<typeof OAuthCallbackQuerySchema>

// Apple's web sign-in returns to our callback via an HTML form POST (`response_mode=form_post`, which
// Apple REQUIRES when name/email scopes are requested), so the parameters arrive as an
// application/x-www-form-urlencoded BODY rather than query params. Like the Google callback this is
// third-party-controlled input, so it must NOT be `.strict()`. `user` is a JSON STRING that Apple sends
// only on the FIRST authorization (the user's name/email); it is absent on every later sign-in.
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
  // Account email for display (e.g. the settings screen). Nullable for accounts without one (Apple
  // private relay omitted) and optional so already-built consumers that never sent it still parse.
  email: z.string().email().nullable().optional(),
  // Provider (Google/Apple) profile photo URL, when present; null means render the solid-color +
  // letter monogram. Optional so already-built consumers/servers still parse.
  avatarUrl: z.string().nullable().optional(),
  // Whether the user has finished first-run registration (set a username + name). Optional so older
  // servers/clients parse; the first-run gate triggers ONLY on an explicit `false`.
  profileComplete: z.boolean().optional(),
  // Whether the account accepts NEW direct messages. When false the user is hidden from people search and
  // openDm toward them is rejected; existing DM threads keep working. Optional + omittable so older
  // servers/clients parse; absent => treat as true (the server default). Read here (e.g. settings screen);
  // written via PUT /me/settings.
  allowDirectMessages: z.boolean().optional(),
  // Whether the public profile publishes this user's volunteer hours (and whether they appear on the
  // public jurisdiction leaderboard). Read here so the settings screen can render the toggle without a
  // second call; written via PUT /me/settings. Optional + omittable so older servers/clients parse;
  // absent => treat as true (the server default).
  showVolunteerHours: z.boolean().optional(),
  // ISO timestamp the user may next change their @handle; null = changeable now. UUID id stays as a hidden
  // internal identifier, never rendered. Backend computes it from handle_changed_at + 30 days (null when
  // handle_changed_at is null or the cooldown has elapsed). Nullable + optional so older servers/clients parse.
  handleChangeableAt: z.string().datetime().nullable().optional(),
  // The user's preferred app locale (drives client UI language + server-generated copy). Older API
  // responses predate this column, so tolerate a missing/unknown value by defaulting to "en": `.catch`
  // coerces an out-of-domain value, `.default` fills an absent one. Either way a built consumer parses.
  locale: LocaleEnum.catch("en").default("en"),
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
  // Sign-in providers the server has configured, so the web can show only the buttons that work.
  // Optional so an already-built web client that ignores it (or a server that omits it) still parses.
  enabledProviders: z.array(OAuthProviderSchema).optional(),
  // CSRF token so the web SPA can recover it after a page reload or OAuth redirect, when only
  // GET /auth/session runs. SessionResponse already carries it for the direct sign-in paths.
  // Optional so an already-built web client (or a server that omits it) still parses.
  csrfToken: z.string().optional(),
  guestSmsEnabled: z.boolean().optional(),
})
export type SessionCheckResponse = z.infer<typeof SessionCheckResponseSchema>

export const LogoutResponseSchema = z.object({
  ok: z.literal(true),
})
export type LogoutResponse = z.infer<typeof LogoutResponseSchema>

/**
 * A short-lived, single-use WebSocket connect ticket. Native clients (RN WebSocket cannot set headers)
 * fetch this over an authenticated HTTPS call and pass it as `?ticket=` to the WS upgrade instead of the
 * raw session bearer, so the long-lived session token never appears in a URL (which can leak via
 * server/edge access logs, proxies, or history). Redeemed + deleted at handshake; expires in seconds.
 */
export const WsTicketResponseSchema = z.object({
  ticket: z.string(),
  expiresInSeconds: z.number().int().positive(),
})
export type WsTicketResponse = z.infer<typeof WsTicketResponseSchema>
