import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { LINKED_REPORTS_COUNT_AT, NEARBY_PREVIEW, linkedReportsPatch } from "../linkReportsModel"
import { HOST_ROW_ICONS } from "../host/hostSurfaceModel"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const picker = code(read("../ReportLinkPicker.tsx"))
const row = code(read("../ReportLinkRow.tsx"))
const surface = code(read("../reportPicker/ReportPicker.tsx"))
const pickerRow = code(read("../reportPicker/PickerReportRow.tsx"))
const chips = code(read("../reportPicker/LayerChipRow.tsx"))
const mapNative = code(read("../../map/ReportPickMap.native.tsx"))
const mapWeb = code(read("../../map/ReportPickMap.web.tsx"))
const mapSelector = code(read("../../map/ReportPickMap.tsx"))
const form = code(read("../CleanupForm.tsx"))
const create = code(read("../CreateCleanupBody.tsx"))
const edit = code(read("../EditCleanupBody.tsx"))
const detail = code(read("../EventDetailBody.tsx"))
const hostBody = code(read("../host/HostModeBody.tsx"))
const hostSheet = code(read("../host/LinkedReportsSheet.tsx"))
const modalSheet = code(read("../../primitives/ModalCardSheet.tsx"))
const bodiesIndex = code(read("../index.ts"))

const eventForm = JSON.parse(read("../../i18n/locales/en/event-form.json")) as Record<string, unknown>
const hostMode = JSON.parse(read("../../i18n/locales/en/host-mode.json")) as Record<string, unknown>
const reportPicker = JSON.parse(read("../../i18n/locales/en/report-picker.json")) as Record<string, unknown>
const eventCreate = JSON.parse(read("../../i18n/locales/en/event-create.json")) as Record<string, unknown>

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

describe("the inline block is a summary plus a door to the map picker", () => {
  it("renders no scroll container and hosts no modal itself", () => {
    const imports = picker.match(/^import[\s\S]*?from\s+"[^"]+"$/gm)?.join("\n") ?? ""
    expect(imports).not.toMatch(/\bModal\b/)
    expect(imports).not.toMatch(/\bFlatList\b/)
    expect(imports).not.toMatch(/\bScrollView\b/)
    expect(picker).not.toMatch(/<(ScrollView|FlatList|SectionList|Modal)\b/)
  })

  it("keeps the one-tap nearby shortlist to a short preview and drops the show-more tail", () => {
    expect(NEARBY_PREVIEW).toBe(3)
    expect(picker).toContain(".slice(0, NEARBY_PREVIEW)")
    expect(picker).not.toContain("showMore")
    expect(picker).not.toContain("NEARBY_MAX")
  })

  it("reaches the network only through the shared hooks", () => {
    expect(picker).toContain("useNearbyReports(")
    expect(picker).not.toMatch(/\bapi\./)
    expect(surface).toContain("useMapReports(")
    expect(surface).toContain("useReportSearch(")
    expect(surface).not.toMatch(/\bapi\./)
    expect(row).not.toMatch(/\bapi\./)
  })

  it("subscribes to the cards it actually names, not the whole record", () => {
    expect(picker).not.toContain("useLinkedReportCards((s) => s.cards)")
    expect(picker).toContain('useLinkedReportCards((s) => value.filter((id) => s.cards[id]).join(","))')
    expect(picker).toContain("useMemo(() => {")
    expect(picker).toContain("[knownKey]")
  })

  it("mounts the map picker only while the host asked for it, seeded from the draft", () => {
    expect(picker).toMatch(/\{picking \? \(\s*<ReportPicker\b/)
    expect(picker).toContain('mode="draft"')
    expect(picker).toContain("value={value}")
    expect(picker).toContain("linked={knownPins}")
    expect(picker).toContain('t("linkedReports.pick_on_map")')
  })

  it("the old text-only search sheet is gone", () => {
    expect(existsSync(new URL("../ReportSearchSheet.tsx", import.meta.url))).toBe(false)
    expect(bodiesIndex).not.toContain("ReportSearchSheet")
    expect(bodiesIndex).toContain('from "./reportPicker/ReportPicker"')
  })
})

describe("the picker surface fetches bounded regions and keeps map and list in sync", () => {
  it("fetches through the padded region model, never the raw viewport, and gates on it", () => {
    expect(surface).toContain("pickerFetchRegion(bbox)")
    expect(surface).toContain("shouldRefetch(bbox, loaded)")
    expect(surface).toContain("useMapReports({ bbox: fetchRegion, enabled: fetchRegion !== null })")
  })

  it("runs the text search only past the minimum length", () => {
    expect(surface).toContain("debounced.trim().length >= PICKER_SEARCH_MIN_CHARS")
    expect(surface).toContain("{ enabled: searching }")
  })

  it("looks a pasted full id or reference up through the detail hook so an off-screen report is found", () => {
    expect(surface).toContain("reportLookupKey(debounced)")
    expect(surface).toContain("useReport(lookupKey ?? undefined)")
    expect(surface).toContain("cardToPin(reportToCardData(lookup.data))")
    expect(surface).toMatch(/mergePins\(linked, fetchedPins, searching \? search\.items : \[\], lookupPins\)/)
  })

  it("pages the list from the pure model and offers three more at the tail", () => {
    expect(surface).toContain("pickerListItems(sections, visible)")
    expect(surface).toContain("nextPageSize(shown, total)")
    expect(surface).toContain("ListFooterComponent={listFooter}")
    expect(surface).toContain('t("load_more", { count: PICKER_PAGE_STEP })')
    expect(surface).toMatch(/if \(more === "fetch"\) search\.fetchNextPage\(\)/)
  })

  it("prints the short code on every row and reads the human title as the headline", () => {
    expect(pickerRow).toContain('headline="title"')
    expect(pickerRow).toContain("code={view.code}")
    expect(pickerRow).toContain("reportShortCode(card)")
    expect(pickerRow).toContain("localReportThumb(data.id)")
    expect(row).toContain('headline="title"')
    expect(row).toContain("code={view.code}")
    expect(row).toContain("localReportThumb(resolved.id)")
  })

  it("caps the markers it hands the map and derives every pin state from one model", () => {
    expect(surface).toContain("mapPinsFor(pins, keepSet, filter)")
    expect(surface).toContain("new Set([...linkedSet, ...idSet])")
    expect(surface).toContain("lookFor={pinPresentation}")
    expect(surface).toContain("pinState(id, idSet, linkedSet)")
  })

  it("filters rows and markers through ONE filter object, so a pin always has a row", () => {
    expect(surface).toContain("pickerRows({ ...filter, pins, viewport, ids: idSet, linked: linkedSet })")
    expect(surface).toMatch(/const filter = useMemo\(\s*\(\) => \(\{\s*center,\s*categories: enabled,\s*nearbyOnly,/)
  })

  it("keeps the marker memo off the selection - only pins the filter would hide are named", () => {
    expect(surface).toContain("keptPinIds(pins, chosenSet, filter).join(\",\")")
    expect(surface).toContain("useMemo(() => new Set(keepKey ? keepKey.split(\",\") : []), [keepKey])")
    expect(surface).toContain("[pins, keepSet, filter]")
    expect(surface).not.toContain("mapPinsFor(pins, new Set([...linkedSet, ...idSet])")
  })

  it("recomputes the zoom-in state on every region change, not only when it refetches", () => {
    const region = surface.slice(surface.indexOf("const onRegionChange"), surface.indexOf("const listState"))
    expect(region).toContain("const next = pickerFetchRegion(bbox)")
    expect(region).toContain("setTooWide(next === null)")
    expect(region).toContain("setFetchRegion((loaded) => (next !== null && shouldRefetch(bbox, loaded) ? next : loaded))")
    expect(region.indexOf("setTooWide")).toBeLessThan(region.indexOf("setFetchRegion"))
  })

  it("mounts its map ONCE per open - the remount key is already 1 on the first visible render", () => {
    expect(surface).toContain("useState(visible ? 1 : 0)")
    expect(surface).toContain("useRef(visible)")
    expect(surface).toContain("key={openCount}")
  })

  it("starts every event with the default layers instead of the last event's", () => {
    expect(surface).toMatch(/useEffect\(\(\) => \{\s*useReportPickerFilters\.getState\(\)\.reset\(\)\s*\}, \[\]\)/)
  })

  it("a pin tap focuses then toggles; a row tap toggles and eases the map", () => {
    expect(surface).toContain('pinTapIntent(id, focusedId) === "toggle"')
    expect(surface).toContain("scrollToRow(id)")
    expect(surface).toMatch(/onPressRow[\s\S]*?toggle\(id, title\)[\s\S]*?flyTo\(pin\.lat, pin\.lng\)/)
    expect(surface).toContain("scrollToOffset?.(")
  })

  it("lives on the shared card sheet so its field and list are keyboard-owned", () => {
    const imports = surface.match(/^import[\s\S]*?from\s+"[^"]+"$/gm)?.join("\n") ?? ""
    expect(imports).not.toMatch(/\bModal\b/)
    expect(imports).not.toMatch(/\bFlatList\b/)
    expect(surface).toContain("<ModalCardSheet")
    expect(surface).toContain("fullBleed")
    expect(surface).toContain('bodyLayout="fill"')
    expect(surface).toContain("const { FlatList } = useScrollHost()")
  })

  it("seeds its layer filters from the session store and shows all seven categories", () => {
    expect(surface).toContain("useReportPickerFilters((s) => s.enabled)")
    expect(chips).toContain("PICKER_CATEGORIES.map(")
    expect(chips).toContain("categoryColor(category, th.scheme)")
    expect(chips).toContain('t("layer_a11y", { category: label, count })')
  })

  it("labels every marker for assistive tech on both seams", () => {
    expect(mapNative).toContain("accessibilityLabel={pinLabel(node.pin, state)}")
    expect(mapNative).toContain("accessibilityLabel={clusterLabel(node.count)}")
    expect(mapNative).toContain("accessibilityLabel={meetingPointLabel}")
    expect(mapWeb).toContain('el.setAttribute("aria-label", want.label)')
    expect(mapWeb).toContain('el.setAttribute("role", "button")')
    expect(mapWeb).toContain('el.setAttribute("tabindex", "0")')
  })

  it("draws the meeting point and its radius hint on both seams from the shared circle helper", () => {
    for (const src of [mapNative, mapWeb]) {
      expect(src).toContain("radiusCircleFeature(center, radiusM)")
      expect(src).toContain("REPORT_PICK_MEETING_PIN_SIZE")
      expect(src).toContain("ClusterBubble")
      expect(src).toContain("TeardropPin")
    }
    expect(mapSelector).toContain('from "./ReportPickMap.web"')
  })

  it("never touches the main map's shared stores", () => {
    for (const [name, src] of [
      ["native", mapNative],
      ["web", mapWeb],
    ] as const) {
      expect(src, name).not.toContain("useMapViewport")
      expect(src, name).not.toContain("useMapFocus")
      expect(src, name).not.toContain("useDroppedPin")
      expect(src, name).not.toContain("useLocationPick")
    }
  })

  it("the row reads its tag from the mode so a draft never claims a report is linked", () => {
    expect(pickerRow).toContain("rowTagKey(row.state, mode)")
    expect(pickerRow).not.toContain("row_unlinking_tag")
    expect(pickerRow).toContain("disabled={atLimit && !chosen}")
    expect(surface).toContain("pinStateKey(state, mode)")
    expect(surface).toContain("t(footerRemovedKey(mode), { count: diff.removed })")
  })

  it("the all-layers chip says what the next tap will do", () => {
    expect(chips).toContain('label={allOn ? t("layers_clear") : t("layers_all")}')
    expect(chips).toContain('a11yLabel={allOn ? t("layers_clear_a11y") : t("layers_all_a11y")}')
    expect(chips).toContain("onPress={allOn ? onClear : onAll}")
  })

  it("the full-bleed close button obeys the same busy lock as the backdrop", () => {
    const closeBtn = modalSheet.slice(modalSheet.indexOf("{fullBleed ? ("), modalSheet.indexOf("iconMap.Close"))
    expect(closeBtn).toContain("onPress={backdropDismissDisabled ? undefined : onClose}")
    expect(closeBtn).toContain("accessibilityState={{ disabled: backdropDismissDisabled }}")
  })

  it("names the web map container a region, not just a label", () => {
    expect(mapWeb).toContain('role="region"')
    expect(mapWeb).toContain("aria-label={mapLabel}")
  })
})

describe("the form and the wizard are unchanged around the block", () => {
  it("renders the block in the WHERE section, from the pure state helper", () => {
    const where = form.slice(form.indexOf('shows("where")'), form.indexOf('shows("when")'))
    expect(where).toContain("<ReportLinkPicker")
    expect(where).toContain("state={linkBlockState({")
    expect(where).toContain("center={value.coords}")
    const basics = form.slice(form.indexOf('shows("basics")'), form.indexOf('shows("where")'))
    expect(basics).not.toContain("linkedReportIds")
  })

  it("summarises the links on review from the pure helper", () => {
    expect(create).toContain("linkedReportsSummary({")
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
})

describe("host tools open the same picker in commit mode", () => {
  it("names the row's icon and routes it at the sheet", () => {
    expect(HOST_ROW_ICONS.linked_reports).toBe("MapPin")
    expect(hostBody).toContain("HOST_ROW_ICONS[row]")
    expect(hostBody).toContain('case "linked_reports":')
    expect(hostBody).toContain("<LinkedReportsSheet")
    expect(hostBody).toContain("linkSheetMode({")
  })

  it("manage mode is the map picker; readonly stays the card sheet", () => {
    expect(hostSheet).toContain('mode="commit"')
    expect(hostSheet).toContain("value={saved}")
    expect(hostSheet).toContain("linked={linkedPins}")
    expect(hostSheet).toContain("busy={update.isPending}")
    expect(hostSheet).toMatch(/if \(!readonly && center\) \{\s*return \(\s*<ReportPicker/)
    expect(hostSheet).toContain("<ModalCardSheet")
    expect(hostSheet).toContain("readonly\n")
  })

  it("sends ONLY the linked ids in the patch, and hands the optimistic refs to the mutation", () => {
    expect(Object.keys(linkedReportsPatch(["a", "b"]))).toEqual(["linkedReportIds"])
    expect(hostSheet).toContain("patch: linkedReportsPatch(ids), linkedReports }")
    expect(hostSheet).toContain("optimisticLinkedRefs(")
    expect(hostSheet).not.toContain("qc.setQueriesData")
    expect(hostSheet).not.toContain("getQueriesData")
    expect(hostSheet).not.toContain("snapshot")
  })

  it("without coordinates the sheet still opens, on the pin-first surface", () => {
    expect(hostSheet).toContain("if (!readonly && center) {")
    expect(hostSheet).toContain(
      't(readonly ? "linked_reports_sheet.caption_readonly" : "linked_reports_sheet.caption_pin_first")',
    )
    expect(hostSheet).toContain("hasCoords: center !== null")
    expect(hostSheet).toContain("[cleanup.lat, cleanup.lng]")
    expect(catalogHas(hostMode, "linked_reports_sheet.caption_pin_first")).toBe(true)
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
  it("the link row's card label exists in en/report-linked.json", () => {
    const linked = JSON.parse(read("../../i18n/locales/en/report-linked.json")) as Record<string, unknown>
    expect(catalogHas(linked, "card.a11yLabelCode")).toBe(true)
    expect(row).toContain('tLinked("card.a11yLabelCode"')
  })

  it.each([
    ["ReportLinkPicker.tsx", picker],
    ["ReportLinkRow.tsx", row],
  ])("%s's linkedReports keys are all in en/event-form.json", (_name, source) => {
    const keys = [...source.matchAll(/"(linkedReports\.[a-zA-Z0-9_]+)"/g)].map((m) => m[1] ?? "")
    expect(keys.length).toBeGreaterThan(0)
    expect(keys.filter((key) => !catalogHas(eventForm, key))).toEqual([])
  })

  it.each([
    ["ReportPicker.tsx", surface],
    ["PickerReportRow.tsx", pickerRow],
    ["LayerChipRow.tsx", chips],
  ])("%s's picker keys are all in en/report-picker.json", (_name, source) => {
    const keys = [...source.matchAll(/\bt\(\s*"([a-z0-9_]+)"/g)].map((m) => m[1] ?? "")
    expect(keys.length).toBeGreaterThan(0)
    expect(keys.filter((key) => !catalogHas(reportPicker, key))).toEqual([])
  })

  it("the picker's dynamic keys resolve for every state and section", () => {
    for (const state of ["selected", "linked", "unlinking", "added", "removed"]) {
      expect(catalogHas(reportPicker, `pin_state_${state}`), state).toBe(true)
    }
    for (const place of ["linked", "added", "view", "matches"]) {
      expect(catalogHas(reportPicker, `section_${place}`), place).toBe(true)
    }
    for (const action of ["action_done", "action_link", "action_save"]) {
      expect(catalogHas(reportPicker, action), action).toBe(true)
    }
    for (const tag of ["row_linked_tag", "row_added_tag", "row_unlinking_tag", "row_removed_tag"]) {
      expect(catalogHas(reportPicker, tag), tag).toBe(true)
    }
    for (const footer of ["footer_removed", "footer_deselected"]) {
      expect(catalogHas(reportPicker, footer), footer).toBe(true)
    }
  })

  it("the retired search sheet's keys are gone from every event-form catalog", () => {
    const dead = [
      "linkedReports.search_all",
      "linkedReports.search_all_a11y",
      "linkedReports.search_hint",
      "linkedReports.sheet_title",
      "linkedReports.sheet_done",
      "linkedReports.sheet_dismiss_a11y",
      "linkedReports.showMore",
      "linkedReports.showMoreA11y",
    ]
    for (const lng of ["en", "es", "de", "ko"]) {
      const catalog = JSON.parse(read(`../../i18n/locales/${lng}/event-form.json`)) as Record<string, unknown>
      for (const key of dead) expect(catalogHas(catalog, key), `${lng}: ${key}`).toBe(false)
      expect(catalogHas(catalog, "linkedReports.pick_on_map"), lng).toBe(true)
    }
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
