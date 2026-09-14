export const PROD_WEB_ORIGIN = "https://civfix.org"

const API_HOST_PREFIX = "api."

export function resolveWebOrigin(apiUrl: string): string {
  let host: string
  try {
    host = new URL(apiUrl).hostname
  } catch {
    return PROD_WEB_ORIGIN
  }
  if (!host.startsWith(API_HOST_PREFIX)) return PROD_WEB_ORIGIN
  return `https://${host.slice(API_HOST_PREFIX.length)}`
}
