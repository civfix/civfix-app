import type { Href } from "expo-router"

export const ALLOWED_LINK_PREFIXES = [
  "/pin/",
  "/cleanups/",
  "/orgs/",
  "/messages/",
  "/people/",
  "/post/",
  "/leaderboard/",
  "/reports",
  "/notifications",
  "/settings",
] as const

export const ROOT_LINK = "/"

export function isInternalLink(link: string): boolean {
  if (!link.startsWith("/")) return false
  if (link.startsWith("//")) return false
  if (link === ROOT_LINK) return true
  return ALLOWED_LINK_PREFIXES.some((prefix) => {
    if (prefix.endsWith("/")) return link.startsWith(prefix)
    if (link === prefix) return true
    const next = link.charAt(prefix.length)
    return link.startsWith(prefix) && (next === "/" || next === "?" || next === "#")
  })
}

export function toInternalHref(link: unknown): Href | null {
  if (typeof link !== "string") return null
  return isInternalLink(link) ? (link as Href) : null
}

const RESUME_PATH = /^\/(?!\/)[A-Za-z0-9\-._~%/?#=&+,]*$/

export function toResumeHref(next: unknown): Href | null {
  if (typeof next !== "string") return null
  return RESUME_PATH.test(next) ? (next as Href) : null
}

const EXTERNAL_URL = /^https:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d{1,5})?([/?#]|$)/i

export function isExternalUrl(url: unknown): url is string {
  return typeof url === "string" && EXTERNAL_URL.test(url)
}
