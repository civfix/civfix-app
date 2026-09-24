import { isSafeInternalPath } from "@/lib/safe-path"

const OAUTH_RETURN_PREFIX = "/manage/"

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/**
 * Only a same-origin console path is accepted, including after normalization (`/manage/../x` is
 * rejected), so a `returnPath` can never turn the OAuth start endpoint into an open redirect, whatever
 * the backend's own allowlist does with it.
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

export function oauthRedirectTarget(origin: string, returnPath?: string | null): string {
  return `${origin}${oauthReturnPath(returnPath) ?? ""}`
}
