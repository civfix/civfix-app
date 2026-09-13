import { readFileSync } from "node:fs"
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
}

const RAW_DATE_READ = /new Date\([^)]*\)\.(getDate|getDay|getHours|getMinutes|toLocale\w*)\(/

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
    ]) {
      expect(SURFACES[name], `${name} must use the shared when-parts`).toContain("useEventWhen(")
      expect(SURFACES[name], `${name} must print the zone suffix`).toContain("when.timeWithZone")
    }
  })

  it("gives the date chip the event zone rather than the device's", () => {
    expect(SURFACES["primitives/DateBadge.tsx"]).toContain("wallClockInZone(d.getTime(), zone).day")
    expect(SURFACES["primitives/EventCard.tsx"]).toContain("timeZone={when.timeZone}")
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
})
