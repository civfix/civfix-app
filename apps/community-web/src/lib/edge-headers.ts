export const PERVASIVE_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "public, max-age=0, must-revalidate",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Strict-Transport-Security": "max-age=31536000",
  "Permissions-Policy":
    "accelerometer=(), autoplay=(self), camera=(), fullscreen=(self), geolocation=(self), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=()",
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; worker-src 'self' blob:; frame-src https://challenges.cloudflare.com",
}

export const DONATE_HEADERS_PATH = "/donate/*"

export const STRIPE_SCRIPT_ORIGINS: readonly string[] = [
  "https://js.stripe.com",
  "https://*.js.stripe.com",
]

export const STRIPE_FRAME_ORIGINS: readonly string[] = [
  "https://js.stripe.com",
  "https://*.js.stripe.com",
  "https://hooks.stripe.com",
]

export const STRIPE_FORM_ACTION_ORIGINS: readonly string[] = [
  "https://hooks.stripe.com",
  "https://*.js.stripe.com",
]

export const DONATE_HEADERS: Readonly<Record<string, string>> = {
  "Permissions-Policy":
    'accelerometer=(), autoplay=(self), camera=(), fullscreen=(self), geolocation=(self), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(self "https://js.stripe.com"), usb=()',
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; " +
    "form-action 'self' https://hooks.stripe.com https://*.js.stripe.com; " +
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://js.stripe.com https://*.js.stripe.com; " +
    "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; " +
    "font-src 'self' data:; connect-src 'self' https: wss:; worker-src 'self' blob:; " +
    "frame-src https://challenges.cloudflare.com https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com",
  "X-Robots-Tag": "noindex",
}

export const DONATE_HEADER_DROPS: readonly string[] = [
  "Content-Security-Policy",
  "Permissions-Policy",
]

export interface HeaderBlock {
  headers: Record<string, string>
  drops: string[]
}

export function parseHeaderBlock(headersFile: string, blockPath: string): HeaderBlock {
  const headers: Record<string, string> = {}
  const drops: string[] = []
  let inBlock = false
  for (const raw of headersFile.split("\n")) {
    const line = raw.replace(/\r$/, "")
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue
    if (!/^\s/.test(line)) {
      inBlock = line.trim() === blockPath
      continue
    }
    if (!inBlock) continue
    const trimmed = line.trim()
    if (trimmed.startsWith("!")) {
      drops.push(trimmed.slice(1).trim())
      continue
    }
    const separator = trimmed.indexOf(":")
    if (separator === -1) continue
    headers[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim()
  }
  return { headers, drops }
}

export function parsePervasiveHeaders(headersFile: string): Record<string, string> {
  return parseHeaderBlock(headersFile, "/*").headers
}

export function cspDirective(policy: string, directive: string): string[] {
  for (const part of policy.split(";")) {
    const tokens = part.trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) continue
    if (tokens[0] === directive) return tokens.slice(1)
  }
  return []
}
