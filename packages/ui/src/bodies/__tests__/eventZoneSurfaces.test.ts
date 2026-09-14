import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { viewerTimeZone } from "../../i18n/useViewerTimeZone"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const SURFACES: Record<string, string> = {
  "primitives/DateBadge.tsx": code(read("../../primitives/DateBadge.tsx")),
  "primitives/EventCard.tsx": code(read("../../primitives/EventCard.tsx")),
  "bodies/EventsBody.tsx": code(read("../EventsBody.tsx")),
  "bodies/PersonDetailBody.tsx": code(read("../PersonDetailBody.tsx")),
  "bodies/SearchResults.tsx": code(read("../SearchResults.tsx")),
  "bodies/MembersBody.tsx": code(read("../MembersBody.tsx")),
  "bodies/EventSlotsBlock.tsx": code(read("../EventSlotsBlock.tsx")),
  "bodies/profile/ProfileEventsSection.tsx": code(read("../profile/ProfileEventsSection.tsx")),
  "bodies/host/EventRosterBlock.tsx": code(read("../host/EventRosterBlock.tsx")),
  "bodies/host/HostInsightsPanels.tsx": code(read("../host/HostInsightsPanels.tsx")),
  "bodies/host/HostModeBody.tsx": code(read("../host/HostModeBody.tsx")),
  "bodies/EventDetailBody.tsx": code(read("../EventDetailBody.tsx")),
  "bodies/host/dashboard/NextUpCard.tsx": code(read("../host/dashboard/NextUpCard.tsx")),
  "bodies/host/dashboard/HostedEventRow.tsx": code(read("../host/dashboard/HostedEventRow.tsx")),
  "bodies/EventHoursBlock.tsx": code(read("../EventHoursBlock.tsx")),
}

const RAW_DATE_READ = /new Date\([^)]*\)\.(getDate|getDay|getHours|getMinutes|toLocale\w*)\(/

const UI_SRC = fileURLToPath(new URL("../..", import.meta.url))

function tsxFilesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const child = `${dir}/${entry.name}`
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : tsxFilesUnder(child)
    return entry.isFile() && entry.name.endsWith(".tsx") ? [child] : []
  })
}

describe("viewerTimeZone", () => {
  it("resolves a usable IANA zone rather than an empty string", () => {
    const zone = viewerTimeZone()
    expect(zone.length).toBeGreaterThan(0)
    expect(() => new Intl.DateTimeFormat("en-US", { timeZone: zone })).not.toThrow()
  })
})

describe("event surfaces render in the event's zone", () => {
  it("never reads a wall clock off the host Date for an event instant", () => {
    for (const [name, src] of Object.entries(SURFACES)) {
      expect(RAW_DATE_READ.test(src), `${name} formats an instant off the host clock`).toBe(false)
    }
  })

  it("passes the event's zone into every shared formatter it calls", () => {
    expect(SURFACES["bodies/EventsBody.tsx"]).toContain(
      "eventChip(cleanup.scheduledAt, locale, when.timeZone)",
    )
    expect(SURFACES["bodies/PersonDetailBody.tsx"]).toContain(
      "eventChip(event.scheduledAt, locale, when.timeZone)",
    )
    expect(SURFACES["bodies/SearchResults.tsx"]).toContain(
      "eventChip(cleanup.scheduledAt, locale, when.timeZone)",
    )
    expect(SURFACES["bodies/profile/ProfileEventsSection.tsx"]).toContain(
      "eventChip(event.scheduledAt, locale, when.timeZone)",
    )
    expect(SURFACES["bodies/MembersBody.tsx"]).toContain(
      "timeRangeLabel(startsAt, endsAt, locale, timeZone)",
    )
    expect(SURFACES["bodies/EventSlotsBlock.tsx"]).toContain(
      "window.end.toISOString(), locale, timeZone)",
    )
    expect(SURFACES["bodies/host/EventRosterBlock.tsx"]).toContain(
      "window.end.toISOString(), locale, timeZone)",
    )
    expect(SURFACES["bodies/host/HostInsightsPanels.tsx"]).toContain(
      "timeLabel(insights.generatedAt, locale, timeZone)",
    )
  })

  it("takes the composite when-line from the shared parts, suffix included", () => {
    for (const name of [
      "bodies/EventsBody.tsx",
      "bodies/PersonDetailBody.tsx",
      "bodies/SearchResults.tsx",
      "bodies/profile/ProfileEventsSection.tsx",
      "primitives/EventCard.tsx",
      "bodies/host/dashboard/NextUpCard.tsx",
      "bodies/host/dashboard/HostedEventRow.tsx",
    ]) {
      expect(SURFACES[name], `${name} must use the shared when-parts`).toContain("useEventWhen(")
      expect(SURFACES[name], `${name} must print the zone suffix`).toContain("when.timeWithZone")
    }
  })

  it("tells the composite label which zone the VIEWER is in, or no suffix ever renders", () => {
    for (const name of ["bodies/EventDetailBody.tsx", "bodies/host/HostModeBody.tsx"]) {
      const src = SURFACES[name] ?? ""
      expect(src, `${name} must read the viewer zone`).toContain("useViewerTimeZone()")
      for (const call of src.match(/eventWhenLabel\([\s\S]*?\)/g) ?? []) {
        expect(call, `${name} drops the viewer zone`).toContain("viewerTimeZone")
      }
    }
  })

  it("hands the event's own zone down to every block that renders a shift window", () => {
    expect(SURFACES["bodies/EventDetailBody.tsx"]).toMatch(
      /<EventSlotsBlock[\s\S]*?timeZone=\{cleanup\.timezone \?\? undefined\}/,
    )
    expect(SURFACES["bodies/host/HostModeBody.tsx"]).toContain("timeZone={event.timezone ?? undefined}")
    expect(SURFACES["bodies/host/HostInsightsPanels.tsx"]).toMatch(
      /<ShiftsPanel[\s\S]*?timeZone=\{timeZone\}/,
    )
    expect(SURFACES["bodies/host/HostInsightsPanels.tsx"]).toMatch(
      /<ShiftRow[\s\S]*?timeZone=\{timeZone\}/,
    )
    expect(SURFACES["bodies/host/dashboard/NextUpCard.tsx"]).toMatch(
      /<ShiftRow[\s\S]*?timeZone=\{event\.timezone \?\? undefined\}/,
    )
  })

  it("gives the date chip the event zone rather than the device's", () => {
    expect(SURFACES["primitives/DateBadge.tsx"]).toContain("wallClockInZone(d.getTime(), zone).day")
    expect(SURFACES["primitives/EventCard.tsx"]).toContain("timeZone={when.timeZone}")
  })

  it("passes a timeZone at every <DateBadge/> mount in the package", () => {
    let mounted = 0
    for (const file of tsxFilesUnder(UI_SRC)) {
      const src = code(readFileSync(file, "utf8"))
      const relative = file.slice(UI_SRC.length)
      for (const mount of src.match(/<DateBadge\b[^>]*>/g) ?? []) {
        mounted += 1
        expect(mount, `${relative} mounts a DateBadge on the device zone`).toContain("timeZone=")
      }
    }
    expect(mounted).toBeGreaterThanOrEqual(3)
  })

  it("prints the volunteer-hours receipt's shift window in the event's zone", () => {
    const src = SURFACES["bodies/EventHoursBlock.tsx"] ?? ""
    expect(src).toContain("timeZone={cleanup.timezone ?? undefined}")
    const calls = src.match(/timeRangeLabel\([^;]*?\)\s*$/gm) ?? []
    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) {
      expect(call, "the receipt drops the event zone").toContain("timeZone")
    }
  })

  it("takes the zone off the event row it is rendering, never off the device", () => {
    expect(SURFACES["bodies/MembersBody.tsx"]).toContain(
      "cleanupQuery.data?.timezone ?? undefined",
    )
    expect(SURFACES["bodies/host/EventRosterBlock.tsx"]).toContain(
      "cleanup.data?.timezone ?? undefined",
    )
  })
})

describe("the attached-event card is told which zone the event is in", () => {
  const CALLERS: Record<string, string> = {
    "PostCard.tsx": code(read("../PostCard.tsx")),
    "PostComposer.tsx": code(read("../PostComposer.tsx")),
    "thread/ThreadFocalPost.tsx": code(read("../thread/ThreadFocalPost.tsx")),
    "thread/ThreadReplyRow.tsx": code(read("../thread/ThreadReplyRow.tsx")),
    "thread/ReplyAttachSheet.tsx": code(read("../thread/ReplyAttachSheet.tsx")),
  }

  it("passes a timeZone at every <LinkedEventCard/> mount", () => {
    for (const [name, src] of Object.entries(CALLERS)) {
      const mounts = src.match(/<LinkedEventCard\b/g)?.length ?? 0
      const zoned = src.match(/timeZone=\{[^}]*\.timezone \?\? undefined\}/g)?.length ?? 0
      expect(mounts, `${name} should still mount the card`).toBeGreaterThan(0)
      expect(zoned, `${name} leaves a card on the device zone`).toBe(mounts)
    }
  })

  it("keeps the zone on the ref the composer builds, so an attached draft is not device-local", () => {
    expect(code(read("../postComposerModel.ts"))).toContain("timezone: event.timezone ?? null")
  })

  it("keeps the zone on the cleanup a report's linked-event card is built from", () => {
    const src = code(read("../reportDetailModel.ts"))
    expect(src).toContain("timezone: event.timezone ?? null")
    expect(src).toContain("endsAt: event.endsAt ?? null")
  })
})
