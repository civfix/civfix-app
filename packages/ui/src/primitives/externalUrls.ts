import { stripTrailingSlashes } from "@civfix/shared"
import { SOURCE_REPO_URL, sourceLink } from "@civfix/shared/legal"

export const WEB_ORIGIN = "https://civfix.org"

let configuredWebOrigin = WEB_ORIGIN

export function setWebOrigin(origin: string): void {
  configuredWebOrigin = stripTrailingSlashes(origin)
}

export function webOrigin(): string {
  return configuredWebOrigin
}

export { SOURCE_REPO_URL }

let configuredSourceCommit = ""

export function setSourceCommit(commit: string): void {
  configuredSourceCommit = sourceLink(commit).commit
}

export function sourceCommit(): string {
  return configuredSourceCommit
}

export function sourceUrl(): string {
  return sourceLink(configuredSourceCommit).url
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
