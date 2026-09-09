import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { clampGallerySelection } from "../reportDetailModel"
import { matchesReportQuery } from "../reportsListModel"
import { resumeStep, stepOrderFor } from "../../report/wizardSteps"

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
  const SRC = readFileSync(new URL("../ReportDetailBody.tsx", import.meta.url), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  )

  it("carries both as PopoverMenu items with the house icons, ahead of the report-content item", () => {
    expect(SRC).toContain("const titleMenuItems: PopoverMenuItem[] = [")
    expect(SRC).toContain('items={titleMenuItems}')
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

  it("parks the OS share sheet until the menu Modal has dismissed on iOS", () => {
    expect(SRC).toContain('if (Platform.OS === "ios")')
    expect(SRC).toContain("pendingMenuActionRef.current = action")
    expect(SRC).toContain("onDismiss={onTitleMenuDismiss}")
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
