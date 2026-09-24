export const WEB_ORIGIN = "https://civfix.org"

let configuredWebOrigin = WEB_ORIGIN

export function setWebOrigin(origin: string): void {
  configuredWebOrigin = origin.replace(/\/+$/, "")
}

export function webOrigin(): string {
  return configuredWebOrigin
}

export const SOURCE_REPO_URL = "https://github.com/civfix/civfix-app"

const COMMIT_SHA = /^[0-9a-f]{7,40}$/i

let configuredSourceCommit = ""

export function setSourceCommit(commit: string): void {
  configuredSourceCommit = COMMIT_SHA.test(commit) ? commit.toLowerCase() : ""
}

export function sourceCommit(): string {
  return configuredSourceCommit
}

export function sourceUrl(): string {
  return configuredSourceCommit ? `${SOURCE_REPO_URL}/tree/${configuredSourceCommit}` : SOURCE_REPO_URL
}

export const PROD_API_HOST = "api.civfix.org"

let configuredApiHost = ""

export function setApiHost(apiUrl: string): void {
  const value = apiUrl.trim()
  let host = value
  try {
    host = new URL(value).host
  } catch {
    host = value
  }
  configuredApiHost = host.toLowerCase().replace(/^\/+|\/+$/g, "")
}

export function offProductionApiHost(): string {
  return configuredApiHost && configuredApiHost !== PROD_API_HOST ? configuredApiHost : ""
}

export const DONATE_URL = "https://reachoutla.org/help"

export const TERMS_URL = `${WEB_ORIGIN}/legal/terms`
export const PRIVACY_URL = `${WEB_ORIGIN}/legal/privacy`

export function managePath(eventId: string): string {
  return `/manage/events/${encodeURIComponent(eventId)}`
}

export function orgPagePath(orgSlug: string): string {
  return `/orgs/${encodeURIComponent(orgSlug)}`
}
