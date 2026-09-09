import { isSafeInternalPath } from "@/lib/safe-path"

/** The only in-app prefix an OAuth round trip may be asked to land on: the host console. */
const OAUTH_RETURN_PREFIX = "/manage/"

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/**
 * Where the OAuth providers send the browser once the API has set the session cookie. Nothing but a
 * same-origin console path is accepted - an absolute URL, a protocol-relative `//host`, a backslash
 * variant or a path that normalizes out of `/manage/` (`/manage/../x`) all fall back to the site
 * root - so a `returnPath` can never turn the start endpoint into an open redirect, whatever the
 * backend's own allowlist does with it.
 */
export function oauthReturnPath(path: string | null | undefined): string | null {
  if (typeof path !== "string" || !isSafeInternalPath(path)) return null
  if (hasControlChar(path)) return null
  let resolved: URL
  try {
    resolved = new URL(path, "https://civfix.invalid")
  } catch {
    return null
  }
  if (resolved.origin !== "https://civfix.invalid") return null
  if (!resolved.pathname.startsWith(OAUTH_RETURN_PREFIX)) return null
  return path
}

/**
 * The `redirect` the start endpoint is asked for: the current origin, plus the allowlisted return
 * path when there is one. The backend accepts a configured web origin or a path under it.
 */
export function oauthRedirectTarget(origin: string, returnPath?: string | null): string {
  return `${origin}${oauthReturnPath(returnPath) ?? ""}`
}
