import { isValidTimeZone } from "../datetime.js"
import { intOr } from "../internal/numbers.js"

export const ICS_PRODID = "-//civfix//civfix events//EN"
export const ICS_UID_DOMAIN = "civfix.org"
const FOLD_OCTETS = 75

export type IcsStatus = "CONFIRMED" | "TENTATIVE" | "CANCELLED"

export interface IcsEventInput {
  uid: string
  title: string
  description?: string
  startsAt: string
  endsAt?: string
  timezone?: string
  location?: string
  url?: string
  status?: IcsStatus
  sequence?: number
  organizer?: { name?: string; email?: string }
  dtstamp?: string
}

function assertInstant(label: string, value: string): number {
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) throw new RangeError(`buildIcs expects ${label} to be an ISO 8601 instant`)
  return ms
}

function pad(value: number, size = 2): string {
  return String(value).padStart(size, "0")
}

function utcStamp(ms: number): string {
  const d = new Date(ms)
  return (
    `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

function escapeText(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex -- ICS text must not carry control characters
    .replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/gu, "")
    .replace(/\\/gu, "\\\\")
    .replace(/;/gu, "\\;")
    .replace(/,/gu, "\\,")
    .replace(/\r\n?/gu, "\n")
    .replace(/\n/gu, "\\n")
}

function escapeParam(value: string): string {
  // eslint-disable-next-line no-control-regex -- ICS params must not carry control characters
  return value.replace(/[\u0000-\u001f\u007f";:,]/gu, "")
}

const UTF8 = new TextEncoder()

function foldLine(line: string): string[] {
  if (UTF8.encode(line).length <= FOLD_OCTETS) return [line]
  const out: string[] = []
  let current = ""
  let octets = 0
  for (const character of line) {
    const size = UTF8.encode(character).length
    if (octets + size > FOLD_OCTETS) {
      out.push(current)
      current = " "
      octets = 1
    }
    current += character
    octets += size
  }
  if (current.length > 0) out.push(current)
  return out
}

export function eventIcsUid(cleanupId: string): string {
  return `cleanup-${cleanupId}@${ICS_UID_DOMAIN}`
}

function normalizeUid(uid: string): string {
  const value = uid.trim()
  if (value.length === 0) throw new RangeError("buildIcs expects a non-empty uid")
  const safe = value.replace(/[\s;:,"]/gu, "-")
  return safe.includes("@") ? safe : `${safe}@${ICS_UID_DOMAIN}`
}

export function buildIcs(input: IcsEventInput): string {
  const startMs = assertInstant("startsAt", input.startsAt)
  const endMs = input.endsAt === undefined ? null : assertInstant("endsAt", input.endsAt)
  if (endMs !== null && endMs < startMs) throw new RangeError("buildIcs expects endsAt >= startsAt")
  const stampMs = input.dtstamp === undefined ? startMs : assertInstant("dtstamp", input.dtstamp)
  const title = input.title.trim()
  if (title.length === 0) throw new RangeError("buildIcs expects a non-empty title")

  const zone = input.timezone?.trim()
  const displayZone = zone !== undefined && zone.length > 0 && isValidTimeZone(zone) ? zone : null

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${ICS_PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ]

  if (displayZone !== null) lines.push(`X-WR-TIMEZONE:${escapeParam(displayZone)}`)

  lines.push(
    "BEGIN:VEVENT",
    `UID:${escapeText(normalizeUid(input.uid))}`,
    `DTSTAMP:${utcStamp(stampMs)}`,
    `DTSTART:${utcStamp(startMs)}`,
  )

  if (endMs !== null) {
    lines.push(`DTEND:${utcStamp(endMs)}`)
  }

  lines.push(`SUMMARY:${escapeText(title)}`)

  const description = input.description?.trim()
  if (description !== undefined && description.length > 0) {
    lines.push(`DESCRIPTION:${escapeText(description)}`)
  }

  const location = input.location?.trim()
  if (location !== undefined && location.length > 0) {
    lines.push(`LOCATION:${escapeText(location)}`)
  }

  const url = input.url?.trim()
  if (url !== undefined && /^https:\/\/\S+$/iu.test(url)) {
    lines.push(`URL:${escapeText(url)}`)
  }

  const organizerEmail = input.organizer?.email?.trim()
  if (organizerEmail !== undefined && /^[^\s@]+@[^\s@]+$/u.test(organizerEmail)) {
    const name = input.organizer?.name?.trim()
    const cn = name !== undefined && name.length > 0 ? `;CN=${escapeParam(name)}` : ""
    lines.push(`ORGANIZER${cn}:mailto:${escapeText(organizerEmail)}`)
  }

  const sequence = intOr(input.sequence, 0, 0)
  lines.push(`SEQUENCE:${sequence}`)
  lines.push(`STATUS:${input.status ?? "CONFIRMED"}`)
  lines.push("TRANSP:OPAQUE")
  lines.push("END:VEVENT")
  lines.push("END:VCALENDAR")

  return `${lines.flatMap(foldLine).join("\r\n")}\r\n`
}
