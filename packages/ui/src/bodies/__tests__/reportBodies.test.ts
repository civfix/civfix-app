import { describe, expect, it } from "vitest"
import type { LinkedEventRef } from "@civfix/shared"
import { linkedEventToCleanup } from "../reportDetailModel"
import { clampGallerySelection } from "../reportDetail/galleryModel"
import { matchesReportQuery } from "../reportsListModel"
import { resumeStep, stepOrderFor } from "../../report/wizardSteps"
import { reportDetailSource } from "../reportDetail/__tests__/reportDetailSource"

describe("report gallery selection", () => {
  it("keeps the hero, the active thumb and the lightbox index on one item after the list shrinks", () => {
    expect(clampGallerySelection(3, 2)).toBe(1)
  })

  it("leaves an in-range selection untouched", () => {
    expect(clampGallerySelection(2, 4)).toBe(2)
  })

  it("falls back to 0 when nothing is ready", () => {
    expect(clampGallerySelection(3, 0)).toBe(0)
  })
})

describe("a report's linked-event card renders in the EVENT's zone", () => {
  const linkedEvent: LinkedEventRef = {
    id: "event-1",
    title: "Ballona Creek Cleanup",
    eventKind: "cleanup",
    status: "upcoming",
    scheduledAt: "2026-07-25T16:00:00.000Z",
    endsAt: "2026-07-25T19:00:00.000Z",
    timezone: "America/Los_Angeles",
    lat: 33.95,
    lng: -118.45,
    going: 18,
    organizer: {
      id: "person-1",
      name: "Friends of Ballona",
      avatar: ["#F0685C", "#E4574A"],
      followers: 240,
      following: 12,
      isFollowing: false,
    },
    linkedAt: "2026-07-01T00:00:00.000Z",
  }

  it("carries the zone and the end instant onto the cleanup the card reads", () => {
    const cleanup = linkedEventToCleanup(linkedEvent)
    expect(cleanup.timezone).toBe("America/Los_Angeles")
    expect(cleanup.endsAt).toBe("2026-07-25T19:00:00.000Z")
  })

  it("normalizes a ref that carries neither, so the card falls back instead of reading undefined", () => {
    const cleanup = linkedEventToCleanup({
      ...linkedEvent,
      endsAt: undefined,
      timezone: undefined,
    })
    expect(cleanup.timezone).toBeNull()
    expect(cleanup.endsAt).toBeNull()
  })

  it("keeps the rest of the ref intact for the card's title, time and attendance line", () => {
    const cleanup = linkedEventToCleanup(linkedEvent)
    expect(cleanup).toMatchObject({
      id: "event-1",
      title: "Ballona Creek Cleanup",
      eventKind: "cleanup",
      status: "upcoming",
      scheduledAt: "2026-07-25T16:00:00.000Z",
      going: 18,
      joined: false,
    })
    expect(cleanup.organizer.name).toBe("Friends of Ballona")
  })
})

describe("your-reports search", () => {
  const report = { title: null, addr: "1200 Riverwalk Ave" }

  it("matches the LOCALIZED category label the row actually shows", () => {
    expect(matchesReportQuery(report, "Illegale Ablagerung", "ablagerung")).toBe(true)
  })

  it("does not match a category label from another catalog", () => {
    expect(matchesReportQuery(report, "Illegale Ablagerung", "dumping")).toBe(false)
  })

  it("still matches title and address, and an empty query keeps everything", () => {
    expect(matchesReportQuery({ title: "Broken swing" }, "Park", "swing")).toBe(true)
    expect(matchesReportQuery(report, "Park", "riverwalk")).toBe(true)
    expect(matchesReportQuery(report, "Park", "   ")).toBe(true)
  })
})

describe("report detail: share and host-an-event live in the overflow menu", () => {
  const SRC = reportDetailSource().replace(/\/\*[\s\S]*?\*\//g, "")

  it("carries both as PopoverMenu items with the house icons, ahead of the report-content item", () => {
    expect(SRC).toContain("const titleMenuItems: PopoverMenuItem[] = [")
    expect(SRC).toContain('items={titleMenu.titleMenuItems}')
    expect(SRC).toMatch(/key: "share",[\s\S]*?icon: "Share",[\s\S]*?onPress: onShare,/)
    expect(SRC).toMatch(/key: "host-event",[\s\S]*?icon: "Megaphone",[\s\S]*?onPress: onHostEvent,/)
    expect(SRC.indexOf('key: "share"')).toBeLessThan(SRC.indexOf('key: "host-event"'))
    expect(SRC.indexOf('key: "host-event"')).toBeLessThan(SRC.indexOf('"relist" : "unlist"'))
    expect(SRC.indexOf('"relist" : "unlist"')).toBeLessThan(SRC.indexOf('key: "report"'))
  })

  it("has no standalone share pill or host-event button left", () => {
    expect(SRC).not.toContain("ShareButton")
    expect(SRC).not.toContain("HostEventButton")
    expect(SRC).not.toContain("styles.hostBtn")
    expect(SRC).not.toContain("styles.titleShare")
    expect(SRC).not.toContain("styles.actionButtons")
  })

  it("keeps each action's behaviour: the same share target, and requireAuth on hosting", () => {
    expect(SRC).toContain("const sharePath = `/pin/${report.referenceCode ?? report.id}`")
    expect(SRC).toMatch(/shareLink\(\{\s*title,\s*path: sharePath,/)
    expect(SRC).toMatch(
      /const onHostEvent = useCallback\(\(\) => \{\s*requireAuth\([\s\S]*?kind: "create-cleanup", reportId: report\.id[\s\S]*?next: "\/host"/,
    )
  })

  it("leaves the iOS post-dismiss sequencing to PopoverMenu instead of a hand-rolled ref", () => {
    expect(SRC).not.toContain("pendingMenuActionRef")
    expect(SRC).not.toContain("onTitleMenuDismiss")
    expect(SRC).toMatch(/const onShare = useCallback\(\(\) => \{\s*void shareLink\(\{/)
  })
})

describe("wizard step migration on a layout flip", () => {
  it("migrates the compact-only location step onto a real expanded step instead of the first one", () => {
    const draft = {
      media: [{ id: "m1" }] as never,
      lat: 34.04,
      lng: -118.25,
      reportTypeId: null,
      title: "",
    }
    expect(stepOrderFor("expanded").includes("location" as never)).toBe(false)
    const migrated = resumeStep(draft, "expanded")
    expect(migrated).toBe("category")
    expect(stepOrderFor("expanded").indexOf(migrated)).toBeGreaterThan(0)
  })
})
