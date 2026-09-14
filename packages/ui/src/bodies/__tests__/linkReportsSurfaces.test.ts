import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { LINKED_REPORTS_COUNT_AT, linkedReportsPatch } from "../linkReportsModel"
import { HOST_ROW_ICONS } from "../host/hostSurfaceModel"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const picker = code(read("../ReportLinkPicker.tsx"))
const row = code(read("../ReportLinkRow.tsx"))
const searchSheet = code(read("../ReportSearchSheet.tsx"))
const form = code(read("../CleanupForm.tsx"))
const create = code(read("../CreateCleanupBody.tsx"))
const edit = code(read("../EditCleanupBody.tsx"))
const detail = code(read("../EventDetailBody.tsx"))
const hostBody = code(read("../host/HostModeBody.tsx"))
const hostSheet = code(read("../host/LinkedReportsSheet.tsx"))

const eventForm = JSON.parse(read("../../i18n/locales/en/event-form.json")) as Record<
  string,
  unknown
>
const hostMode = JSON.parse(read("../../i18n/locales/en/host-mode.json")) as Record<string, unknown>
const eventCreate = JSON.parse(read("../../i18n/locales/en/event-create.json")) as Record<
  string,
  unknown
>
const mapUi = JSON.parse(read("../../i18n/locales/en/map-ui.json")) as Record<string, unknown>
const reportDetail = JSON.parse(read("../../i18n/locales/en/report-detail.json")) as Record<
  string,
  unknown
>

function catalogHas(catalog: Record<string, unknown>, path: string): boolean {
  const parts = path.split(".")
  const leaf = parts.pop()
  if (!leaf) return false
  let node: unknown = catalog
  for (const part of parts) {
    if (typeof node !== "object" || node === null) return false
    node = (node as Record<string, unknown>)[part]
  }
  if (typeof node !== "object" || node === null) return false
  const obj = node as Record<string, unknown>
  return leaf in obj || `${leaf}_one` in obj || `${leaf}_other` in obj
}

describe("the picker adds no scroller of its own", () => {
  it("ReportLinkPicker.tsx renders no scroll container and hosts no modal itself", () => {
    const imports = picker.match(/^import[\s\S]*?from\s+"[^"]+"$/gm)?.join("\n") ?? ""
    expect(imports).not.toMatch(/\bModal\b/)
    expect(imports).not.toMatch(/\bFlatList\b/)
    expect(imports).not.toMatch(/\bScrollView\b/)
    expect(picker).not.toMatch(/useScrollHost/)
    expect(picker).not.toMatch(/<(ScrollView|FlatList|SectionList|Modal)\b/)
  })

  it("ReportLinkRow.tsx does the same", () => {
    const imports = row.match(/^import[\s\S]*?from\s+"[^"]+"$/gm)?.join("\n") ?? ""
    expect(imports).not.toMatch(/\bFlatList\b/)
    expect(imports).not.toMatch(/\bScrollView\b/)
    expect(row).not.toMatch(/useScrollHost/)
  })

  it("reaches the network only through the shared hooks, never a raw client call", () => {
    expect(picker).toContain("useNearbyReports(")
    expect(picker).not.toMatch(/\bapi\./)
    expect(searchSheet).toContain("useReportSearch(")
    expect(searchSheet).not.toMatch(/\bapi\./)
    expect(row).not.toMatch(/\bapi\./)
  })
})

describe("nothing fetches until the surface is actually asked for", () => {
  it("mounts the search sheet only while the picker is searching", () => {
    expect(picker).toMatch(/\{searching \? \(\s*<ReportSearchSheet\b/)
    expect(picker).not.toMatch(/<ReportSearchSheet\s+visible=\{searching\}/)
  })

  it("keeps the search query off until the sheet is open AND the user has narrowed it", () => {
    expect(searchSheet).toContain("{ enabled: visible && !idle }")
    expect(searchSheet).toMatch(/const idle = [\s\S]*?\n\s*const search = useReportSearch\(/)
  })

  it("shows the search hint instead of listing the newest reports nationwide", () => {
    expect(searchSheet).toContain('t("linkedReports.search_hint")')
    expect(searchSheet).not.toContain("emptyNone")
  })

  it("disables an unselected hit once the link cap is reached, and says so", () => {
    expect(searchSheet).toContain("disabled={atLimit && !value.includes(card.id)}")
    expect(searchSheet).toContain('t("linkedReports.limit_reached"')
  })

  it("mounts the host sheet's picker only while that sheet is open", () => {
    expect(hostSheet).toMatch(/\{visible \? \(\s*<ReportLinkPicker\b/)
  })

  it("dims the nearby list while it is still showing another cell's rows", () => {
    expect(picker).toContain("nearby.isPlaceholderData")
  })
})

describe("the basics step no longer owns the linked cards", () => {
  it("leaves no linkedReportIds anywhere in the basics section", () => {
    const basics = form.slice(form.indexOf('shows("basics")'), form.indexOf('shows("where")'))
    expect(basics).not.toContain("linkedReportIds")
    expect(form).not.toContain("LinkedReportCardById")
  })

  it("renders the block in the WHERE section, from the pure state helper", () => {
    const where = form.slice(form.indexOf('shows("where")'), form.indexOf('shows("when")'))
    expect(where).toContain("<ReportLinkPicker")
    expect(where).toContain("state={linkBlockState({")
    expect(where).toContain("center={value.coords}")
  })
})

describe("the wizard keeps its five steps and its draft hygiene", () => {
  it("summarises the links on review from the pure helper, not an inline kind check", () => {
    expect(create).toContain("linkedReportsSummary({")
    expect(create).not.toContain('value.eventKind === "cleanup"')
    for (const key of [
      "wizard.summary.reports",
      "wizard.summary.reports_count",
      "wizard.summary.noReports",
    ]) {
      expect(catalogHas(eventCreate, key), key).toBe(true)
    }
  })

  it("clears the display cache wherever it clears the draft", () => {
    const draftClears = create.match(/useCleanupDraft\.getState\(\)\.clear\(\)/g) ?? []
    const cardClears = create.match(/useLinkedReportCards\.getState\(\)\.clear\(\)/g) ?? []
    expect(draftClears.length).toBeGreaterThan(0)
    expect(cardClears).toHaveLength(draftClears.length)
  })

  it("seeds the edit form's cache from the event's own linked refs", () => {
    expect(edit).toContain("linkedReports.map(linkedRefToCardData)")
    expect(edit).toContain("useLinkedReportCards.getState().clear()")
  })

  it("re-seeds on the linked IDS, and clears the whole cache only on unmount", () => {
    expect(edit).toMatch(/linkedReports\.map\(\(report\) => report\.id\)\.join\(","\)/)
    expect(edit).toMatch(/\}, \[linkedReportIds\]\)/)
    expect(edit).toContain("useEffect(() => () => useLinkedReportCards.getState().clear(), [])")
    expect(edit).not.toMatch(/return \(\) => useLinkedReportCards\.getState\(\)\.clear\(\)/)
  })
})

describe("host tools reach the same block", () => {
  it("names the row's icon and routes it at the sheet", () => {
    expect(HOST_ROW_ICONS.linked_reports).toBe("MapPin")
    expect(hostBody).toContain("HOST_ROW_ICONS[row]")
    expect(hostBody).toContain('case "linked_reports":')
    expect(hostBody).toContain("<LinkedReportsSheet")
    expect(hostBody).toContain("linkSheetMode({")
  })

  it("sends ONLY the linked ids in the patch, so nothing else on the event moves", () => {
    expect(Object.keys(linkedReportsPatch(["a", "b"]))).toEqual(["linkedReportIds"])
    expect(hostSheet).toContain("patch: linkedReportsPatch(ids)")
    expect(hostSheet).toContain("sameIdSet(ids, saved)")
  })

  it("invalidates the touched reports so their own page shows the event", () => {
    expect(hostSheet).toContain("queryKeys.report(id)")
  })
})

describe("the event page names the count once the strip runs long", () => {
  it("switches to the counted heading past the visible tail", () => {
    expect(LINKED_REPORTS_COUNT_AT).toBe(3)
    expect(detail).toContain("reports.length > LINKED_REPORTS_COUNT_AT")
    expect(detail).toContain('t("linked_reports.heading_count", { count: reports.length })')
  })
})

describe("every key these surfaces name exists in en", () => {
  it.each([
    ["ReportLinkPicker.tsx", picker],
    ["ReportLinkRow.tsx", row],
    ["ReportSearchSheet.tsx", searchSheet],
  ])("%s's linkedReports keys are all in en/event-form.json", (_name, source) => {
    const keys = [...source.matchAll(/"(linkedReports\.[a-zA-Z0-9_]+)"/g)].map((m) => m[1] ?? "")
    expect(keys.length).toBeGreaterThan(0)
    expect(keys.filter((key) => !catalogHas(eventForm, key))).toEqual([])
  })

  it("the host sheet's keys are all in en/host-mode.json", () => {
    const keys = [
      ...hostSheet.matchAll(/"(linked_reports_sheet\.[a-z0-9_]+)"/g),
      ...hostBody.matchAll(/"(row\.linked_reports[a-z0-9_]*)"/g),
    ].map((m) => m[1] ?? "")
    expect(keys.length).toBeGreaterThan(0)
    expect(keys.filter((key) => !catalogHas(hostMode, key))).toEqual([])
  })
})

describe("the dead map link-mode and its strings are gone", () => {
  it("retires map-ui.linkPanel and report-detail's add_to_event", () => {
    expect(mapUi).not.toHaveProperty("linkPanel")
    const actions = reportDetail["actions"] as Record<string, unknown>
    for (const key of ["add_to_event", "added", "add_to_event_a11y", "added_a11y"]) {
      expect(actions, key).not.toHaveProperty(key)
    }
  })

  it("leaves no reader of the orphaned store anywhere in the package", () => {
    for (const [name, source] of [
      ["Map.web.tsx", code(read("../../map/Map.web.tsx"))],
      ["Map.native.tsx", code(read("../../map/Map.native.tsx"))],
      ["map/index.ts", code(read("../../map/index.ts"))],
      ["ReportDetailBody.tsx", code(read("../ReportDetailBody.tsx"))],
    ] as const) {
      expect(source, name).not.toContain("useEventReportLink")
      expect(source, name).not.toContain("ReportLinkPanel")
      expect(source, name).not.toContain("AddToEventButton")
    }
  })
})
