export const PROD_WEB_ORIGIN = "https://civfix.org"

const WEB_ORIGIN_BY_API_HOST: Readonly<Record<string, string>> = {
  "api.civfix.org": PROD_WEB_ORIGIN,
  "api.civfix.dev": "https://civfix.dev",
}

export function resolveWebOrigin(apiUrl: string): string {
  let host: string
  try {
    host = new URL(apiUrl).hostname
  } catch {
    return PROD_WEB_ORIGIN
  }
  return WEB_ORIGIN_BY_API_HOST[host] ?? PROD_WEB_ORIGIN
}
