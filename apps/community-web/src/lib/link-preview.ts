import {
  REPORT_CATEGORY_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_TYPE_LABELS,
  type ReportCategory,
  type ReportStatus,
  type ReportType,
} from "@civfix/shared"
import { isValidTimeZone } from "@civfix/shared/datetime"

import {
  APPLE_TOUCH_ICON_PATH,
  APPLE_TOUCH_ICON_SIZES,
  BRAND_IMAGE_HEIGHT,
  BRAND_IMAGE_PATH,
  BRAND_IMAGE_TYPE,
  BRAND_IMAGE_WIDTH,
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  ICON_PATH,
  ICON_TYPE,
  SITE_LOCALE,
  SITE_NAME,
} from "./site-meta"

export const EVENT_TIME_ZONE = "America/Los_Angeles"

const TITLE_MAX = 90
const EVENT_TITLE_MAX = 80
const DESCRIPTION_MAX = 200

export type PreviewKind = "report" | "event" | "person" | "signup" | "org"

export interface LinkPreview {
  title: string
  description: string
  image: string
  imageIsBrand: boolean
  url: string
  origin: string
  type: "website" | "article" | "profile"
  noindex: boolean
}

export interface PreviewContext {
  url: string
  origin: string
}

export function brandImageUrl(origin: string): string {
  return `${origin}${BRAND_IMAGE_PATH}`
}

export function defaultPreview(context: PreviewContext): LinkPreview {
  return {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    image: brandImageUrl(context.origin),
    imageIsBrand: true,
    url: context.url,
    origin: context.origin,
    type: "website",
    noindex: false,
  }
}

export function withNoindex(preview: LinkPreview): LinkPreview {
  return preview.noindex ? preview : { ...preview, noindex: true }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

export function clamp(value: string, max: number): string {
  const text = oneLine(value)
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(" ")
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

export function isPublicMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== "https:") return false
  return parsed.search === "" && parsed.hash === ""
}

function joinParts(parts: readonly (string | null | undefined)[]): string {
  return parts.map((part) => part?.trim()).filter((part): part is string => !!part).join(" · ")
}

function finishDescription(parts: readonly (string | null | undefined)[]): string {
  return clamp(joinParts(parts), DESCRIPTION_MAX)
}

export interface ReportPreviewInput {
  category?: string | null
  type?: string | null
  status?: string | null
  visibility?: string | null
  cityName?: string | null
  media?: readonly {
    kind?: string | null
    status?: string | null
    url?: string | null
    thumbUrl?: string | null
  }[] | null
}

export interface EventPreviewInput {
  title?: string | null
  scheduledAt?: string | null
  timezone?: string | null
  status?: string | null
}

export interface PersonPreviewInput {
  name?: string | null
  handle?: string | null
  avatarUrl?: string | null
  deleted?: boolean | null
}

function reportImage(input: ReportPreviewInput): string | null {
  for (const item of input.media ?? []) {
    if (item.kind !== "image" || item.status !== "ready") continue
    if (isPublicMediaUrl(item.thumbUrl)) return item.thumbUrl as string
    if (isPublicMediaUrl(item.url)) return item.url as string
  }
  return null
}

export function previewForReport(
  input: ReportPreviewInput,
  context: PreviewContext,
): LinkPreview | null {
  if (input.visibility !== "public") return null

  const typeLabel = input.type ? REPORT_TYPE_LABELS[input.type as ReportType] : undefined
  const categoryLabel = input.category
    ? REPORT_CATEGORY_LABELS[input.category as ReportCategory]
    : undefined
  const kindLabel = typeLabel ?? categoryLabel ?? "Report"
  const cityName = input.cityName ? oneLine(input.cityName) : ""
  const title = clamp(joinParts([kindLabel, cityName]), TITLE_MAX)

  const statusLabel = input.status
    ? REPORT_STATUS_LABELS[input.status as ReportStatus]
    : undefined
  const description =
    finishDescription([statusLabel ? `${kindLabel} — ${statusLabel}` : kindLabel, cityName]) ||
    DEFAULT_DESCRIPTION

  const image = reportImage(input)
  return {
    title: title || DEFAULT_TITLE,
    description,
    image: image ?? brandImageUrl(context.origin),
    imageIsBrand: image === null,
    url: context.url,
    origin: context.origin,
    type: "article",
    noindex: false,
  }
}

export function formatEventWhen(
  iso: string | null | undefined,
  timeZone?: string | null,
): string {
  if (!iso) return ""
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ""
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }
  const zone = timeZone && isValidTimeZone(timeZone) ? timeZone : EVENT_TIME_ZONE
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: zone }).format(at)
}

export function previewForEvent(
  input: EventPreviewInput,
  context: PreviewContext,
): LinkPreview | null {
  const title = input.title ? clamp(input.title, EVENT_TITLE_MAX) : ""
  if (!title) return null

  const when = formatEventWhen(input.scheduledAt, input.timezone)
  const cancelled = input.status === "cancelled" ? "Cancelled" : null
  const description =
    finishDescription([cancelled, when, `A volunteer event on ${SITE_NAME}`]) || DEFAULT_DESCRIPTION

  return {
    title,
    description,
    image: brandImageUrl(context.origin),
    imageIsBrand: true,
    url: context.url,
    origin: context.origin,
    type: "article",
    noindex: false,
  }
}

export function previewForPerson(
  input: PersonPreviewInput,
  context: PreviewContext,
): LinkPreview | null {
  if (input.deleted) return null
  const name = input.name ? oneLine(input.name) : ""
  if (!name) return null

  const handle = input.handle ? oneLine(input.handle).replace(/^@/, "") : ""
  const title = clamp(handle ? `${name} (@${handle})` : name, TITLE_MAX)
  const description = finishDescription([title, `On ${SITE_NAME}`])
  const image = isPublicMediaUrl(input.avatarUrl) ? (input.avatarUrl as string) : null

  return {
    title,
    description,
    image: image ?? brandImageUrl(context.origin),
    imageIsBrand: image === null,
    url: context.url,
    origin: context.origin,
    type: "profile",
    noindex: false,
  }
}

export interface SignupPagePreviewInput {
  slug?: string | null
  visibility?: string | null
  noindex?: boolean | null
  coverUrl?: string | null
  seo?: { title?: string | null; description?: string | null; noindex?: boolean | null } | null
  event?: {
    title?: string | null
    startsAt?: string | null
    timezone?: string | null
    status?: string | null
    address?: string | null
  } | null
  organization?: { name?: string | null } | null
}

export function previewForSignupPage(
  input: SignupPagePreviewInput,
  context: PreviewContext,
): LinkPreview | null {
  const event = input.event ?? null
  const rawTitle = input.seo?.title ?? event?.title ?? ""
  const title = rawTitle ? clamp(rawTitle, EVENT_TITLE_MAX) : ""
  if (!title) return null

  const isPublic = input.visibility === "public"
  const when = formatEventWhen(event?.startsAt, event?.timezone)
  const cancelled = event?.status === "cancelled" ? "Cancelled" : null
  const host = input.organization?.name ? oneLine(input.organization.name) : ""
  const description =
    (input.seo?.description ? clamp(input.seo.description, DESCRIPTION_MAX) : "") ||
    finishDescription([cancelled, when, host || `An event on ${SITE_NAME}`]) ||
    DEFAULT_DESCRIPTION

  const cover = isPublic && isPublicMediaUrl(input.coverUrl) ? (input.coverUrl as string) : null

  return {
    title,
    description,
    image: cover ?? brandImageUrl(context.origin),
    imageIsBrand: cover === null,
    url: context.url,
    origin: context.origin,
    type: "article",
    noindex: !isPublic || input.noindex === true || input.seo?.noindex === true,
  }
}

export interface OrganizationPreviewInput {
  name?: string | null
  slug?: string | null
  description?: string | null
  logoUrl?: string | null
  verifiedStatus?: string | null
  verifiedKind?: string | null
  eventCount?: number | null
}

const ORG_KIND_LABEL: Record<string, string> = {
  nonprofit: "Verified nonprofit",
  government: "Verified government organization",
  community: "Verified community group",
}

export function previewForOrganization(
  input: OrganizationPreviewInput,
  context: PreviewContext,
): LinkPreview | null {
  const name = input.name ? oneLine(input.name) : ""
  if (!name) return null

  const handle = input.slug ? oneLine(input.slug) : ""
  const title = clamp(handle ? `${name} (@${handle})` : name, TITLE_MAX)
  const verified =
    input.verifiedStatus === "verified"
      ? (ORG_KIND_LABEL[input.verifiedKind ?? ""] ?? "Verified organization")
      : null
  const events =
    typeof input.eventCount === "number" && input.eventCount > 0
      ? `${input.eventCount} ${input.eventCount === 1 ? "event" : "events"}`
      : null
  const description = finishDescription([
    verified,
    events,
    input.description ? input.description : `Hosting volunteer events on ${SITE_NAME}`,
  ])
  const image = isPublicMediaUrl(input.logoUrl) ? (input.logoUrl as string) : null

  return {
    title,
    description: description || DEFAULT_DESCRIPTION,
    image: image ?? brandImageUrl(context.origin),
    imageIsBrand: image === null,
    url: context.url,
    origin: context.origin,
    type: "profile",
    noindex: false,
  }
}

const MANAGED_META_NAMES: readonly string[] = [
  "description",
  "robots",
  "twitter:card",
  "twitter:title",
  "twitter:description",
  "twitter:image",
  "twitter:image:alt",
]

const MANAGED_META_PROPERTIES: readonly string[] = [
  "og:site_name",
  "og:type",
  "og:locale",
  "og:url",
  "og:title",
  "og:description",
  "og:image",
  "og:image:secure_url",
  "og:image:type",
  "og:image:width",
  "og:image:height",
  "og:image:alt",
]

const MANAGED_LINK_RELS: readonly string[] = [
  "canonical",
  "icon",
  "apple-touch-icon",
  "apple-touch-icon-precomposed",
]

const MANAGED_LINK_MODIFIERS: readonly string[] = ["shortcut"]

export function isManagedMeta(
  name: string | null | undefined,
  property: string | null | undefined,
): boolean {
  const n = name?.trim().toLowerCase()
  const p = property?.trim().toLowerCase()
  if (n && MANAGED_META_NAMES.includes(n)) return true
  if (p && MANAGED_META_PROPERTIES.includes(p)) return true
  if (n && MANAGED_META_PROPERTIES.includes(n)) return true
  return false
}

export function isManagedLink(rel: string | null | undefined): boolean {
  const tokens = rel ? oneLine(rel).toLowerCase().split(" ").filter(Boolean) : []
  if (tokens.length === 0) return false
  if (!tokens.some((token) => MANAGED_LINK_RELS.includes(token))) return false
  return tokens.every(
    (token) => MANAGED_LINK_RELS.includes(token) || MANAGED_LINK_MODIFIERS.includes(token),
  )
}

export function documentTitle(preview: LinkPreview): string {
  const suffix = ` · ${SITE_NAME}`
  if (preview.title === SITE_NAME || preview.title.endsWith(suffix)) return preview.title
  return `${preview.title}${suffix}`
}

function meta(attr: "name" | "property", key: string, value: string): string {
  return `<meta ${attr}="${escapeHtml(key)}" content="${escapeHtml(value)}">`
}

function link(rel: string, href: string, attrs: Readonly<Record<string, string>> = {}): string {
  const extra = Object.entries(attrs)
    .map(([key, value]) => ` ${escapeHtml(key)}="${escapeHtml(value)}"`)
    .join("")
  return `<link rel="${escapeHtml(rel)}" href="${escapeHtml(href)}"${extra}>`
}

function imageTags(preview: LinkPreview): readonly string[] {
  const tags = [
    meta("property", "og:image", preview.image),
    meta("property", "og:image:secure_url", preview.image),
  ]
  if (preview.imageIsBrand) {
    tags.push(
      meta("property", "og:image:type", BRAND_IMAGE_TYPE),
      meta("property", "og:image:width", String(BRAND_IMAGE_WIDTH)),
      meta("property", "og:image:height", String(BRAND_IMAGE_HEIGHT)),
    )
  }
  tags.push(meta("property", "og:image:alt", preview.title))
  return tags
}

export function metaTagsHtml(preview: LinkPreview): string {
  return [
    ...(preview.noindex ? [meta("name", "robots", "noindex")] : []),
    meta("name", "description", preview.description),
    meta("property", "og:site_name", SITE_NAME),
    meta("property", "og:type", preview.type),
    meta("property", "og:locale", SITE_LOCALE),
    meta("property", "og:url", preview.url),
    meta("property", "og:title", preview.title),
    meta("property", "og:description", preview.description),
    ...imageTags(preview),
    meta("name", "twitter:card", "summary_large_image"),
    meta("name", "twitter:title", preview.title),
    meta("name", "twitter:description", preview.description),
    meta("name", "twitter:image", preview.image),
    meta("name", "twitter:image:alt", preview.title),
    link("canonical", preview.url),
    link("icon", `${preview.origin}${ICON_PATH}`, { type: ICON_TYPE }),
    link("apple-touch-icon", `${preview.origin}${APPLE_TOUCH_ICON_PATH}`, {
      sizes: APPLE_TOUCH_ICON_SIZES,
    }),
  ].join("")
}
