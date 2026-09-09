export const WEB_ORIGIN = "https://civfix.org"

export const DONATE_URL = "https://reachoutla.org/help"

export const TERMS_URL = `${WEB_ORIGIN}/legal/terms`
export const PRIVACY_URL = `${WEB_ORIGIN}/legal/privacy`
export const COOKIES_URL = `${WEB_ORIGIN}/legal/cookies`
export const SUBPROCESSORS_URL = `${WEB_ORIGIN}/legal/subprocessors`
export const DONATION_TERMS_URL = `${WEB_ORIGIN}/legal/donations`

export function legalUrlFor(type: string): string {
  switch (type) {
    case "terms":
      return TERMS_URL
    case "privacy":
      return PRIVACY_URL
    case "cookies":
      return COOKIES_URL
    case "subprocessors":
      return SUBPROCESSORS_URL
    case "donations":
      return DONATION_TERMS_URL
    case "org_donation_agreement":
      return `${WEB_ORIGIN}/legal/org-donation-agreement`
    case "donation_disclosure":
      return `${WEB_ORIGIN}/legal/donation-disclosure`
    default:
      return `${WEB_ORIGIN}/legal`
  }
}

export function donatePath(orgSlug: string, eventId?: string | null): string {
  const base = `/donate/${encodeURIComponent(orgSlug)}`
  return eventId ? `${base}?event=${encodeURIComponent(eventId)}` : base
}

export function donateUrl(orgSlug: string, eventId?: string | null): string {
  return WEB_ORIGIN + donatePath(orgSlug, eventId)
}

export function managePath(eventId: string): string {
  return `/manage/events/${encodeURIComponent(eventId)}`
}

export function manageUrl(eventId: string): string {
  return WEB_ORIGIN + managePath(eventId)
}

export function orgPagePath(orgSlug: string): string {
  return `/orgs/${encodeURIComponent(orgSlug)}`
}

export function signupPagePath(pageSlug: string): string {
  return `/e/${encodeURIComponent(pageSlug)}`
}
