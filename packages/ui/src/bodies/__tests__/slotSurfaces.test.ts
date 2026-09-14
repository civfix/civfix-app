import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * Source-text guards for the two signup-slot surfaces. The package ships no RN renderer, so these read
 * the files - but each guards a rule that is invisible in review and expensive in the field.
 *
 *   1. NO `Modal` / `FlatList` / inner `ScrollView`. Both surfaces render inside a scroller that already
 *      exists: the gorhom bottom sheet, the portrait shell surface, or mobile's standalone formSheet.
 *      A nested vertical scroller swallows the sheet's pan gesture, a `FlatList` virtualises inside a
 *      parent scroll of unbounded height, and a `Modal` is exactly the gesture-swallow class
 *      `InlineDateTimePicker` exists to avoid. Regressing any of these produces a surface that LOOKS
 *      right and cannot be dragged, which no snapshot test would catch.
 *   2. Every `t("…")` key these files reference exists in `en/event-slots.json`. A typo'd key renders the
 *      raw key string to the user; i18next has no compile-time check and `i18n:check` only compares
 *      locale catalogs to each other, so a key missing from ALL FOUR would sail straight through.
 */
const SOURCES = {
  "SlotEditor.tsx": readFileSync(new URL("../SlotEditor.tsx", import.meta.url), "utf8"),
  "EventSlotsBlock.tsx": readFileSync(new URL("../EventSlotsBlock.tsx", import.meta.url), "utf8"),
  "SlotWindowPicker.tsx": readFileSync(new URL("../SlotWindowPicker.tsx", import.meta.url), "utf8"),
}

const SCROLLER_SOURCES = {
  ...SOURCES,
  "InlineDateTimePicker.web.tsx": readFileSync(
    new URL("../InlineDateTimePicker.web.tsx", import.meta.url),
    "utf8",
  ),
  "InlineDateTimePicker.native.tsx": readFileSync(
    new URL("../InlineDateTimePicker.native.tsx", import.meta.url),
    "utf8",
  ),
  "DateTimeFieldRow.tsx": readFileSync(new URL("../DateTimeFieldRow.tsx", import.meta.url), "utf8"),
  "TimezoneField.tsx": readFileSync(new URL("../TimezoneField.tsx", import.meta.url), "utf8"),
}

describe("slot surfaces render inside their host's scroller", () => {
  for (const [name, source] of Object.entries(SCROLLER_SOURCES)) {
    it(`${name} imports no Modal, FlatList or ScrollView`, () => {
      const imports = source.match(/^import[\s\S]*?from\s+"[^"]+"$/gm)?.join("\n") ?? ""
      expect(imports).not.toMatch(/\bModal\b/)
      expect(imports).not.toMatch(/\bFlatList\b/)
      expect(imports).not.toMatch(/\bScrollView\b/)
      // ...and does not reach for one through a hook seam either.
      expect(source).not.toMatch(/useScrollHost/)
    })
  }

  it("EventSlotsBlock plays the SHARED pop spring and imports no reanimated", () => {
    const source = SOURCES["EventSlotsBlock.tsx"]
    expect(source).toMatch(/usePopScale/)
    expect(source).not.toMatch(/react-native-reanimated/)
  })
})

describe("the date/time picker seam stays a seam", () => {
  const bodiesDir = fileURLToPath(new URL("..", import.meta.url))

  function sourceFiles(dir: string): string[] {
    const out: string[] = []
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        if (entry !== "__tests__") out.push(...sourceFiles(full))
      } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
        out.push(full)
      }
    }
    return out
  }

  const files = sourceFiles(bodiesDir)

  it("keeps the base file to the two re-export lines Metro needs", () => {
    const base = readFileSync(new URL("../InlineDateTimePicker.tsx", import.meta.url), "utf8")
    const lines = base.trim().split("\n")
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('from "./InlineDateTimePicker.web"')
    expect(lines[1]).toContain('from "./InlineDateTimePicker.types"')
  })

  it("names the optional native picker peer in the .native seam and nowhere else, so web never resolves it", () => {
    const importers = files
      .filter((file) => readFileSync(file, "utf8").includes("@react-native-community/datetimepicker"))
      .map((file) => file.slice(bodiesDir.length))
    expect(importers).toEqual(["InlineDateTimePicker.native.tsx"])
  })

  it("leaves no reference to the retired month grid", () => {
    const referrers = files
      .filter((file) => readFileSync(file, "utf8").includes("MonthCalendarGrid"))
      .map((file) => file.slice(bodiesDir.length))
    expect(referrers).toEqual([])
  })
})

/** Comments stripped - these guards are about the CODE, and the prose deliberately names the mistakes. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

describe("EventSlotsBlock serialises claims across ALL rows", () => {
  const source = code(SOURCES["EventSlotsBlock.tsx"])

  it("disables every pill off the SHARED mutation, not just the tapped row", () => {
    // The viewer's slot is a singular resource: two overlapping PUTs resolve last-RESPONSE-wins, so
    // tapping row A then row B could leave the detail cache marking A as `mine` while the server holds
    // B. `pendingSlotId` still exists, but only to say which pill DIMS.
    expect(source).toContain("busy={claim.isPending}")
    expect(source).toContain("pending={pendingSlotId === slot.id}")
    expect(source).not.toContain("busy={pendingSlotId === slot.id}")
  })

  it("refuses to re-enter the mutation while one is in flight", () => {
    // `disabled` is a render-time guard; a queued tap can still land. This is the runtime half.
    expect(source).toContain("if (claim.isPending) return")
  })

  it("gives the claim/switch/release pill a 44pt target without growing the 30pt visual", () => {
    // The row is deliberately NOT pressable, so this pill is the entire tap area - and it is the primary
    // action of the whole feature. 30 + 7 + 7 = 44 (the package's own rsvpPillModel target), applied as
    // slop so no slot row gets taller.
    expect(source).toContain("const PILL_HIT_SLOP = 7")
    expect(source).toContain("height: 30")
    expect(source.match(/hitSlop=\{PILL_HIT_SLOP\}/g) ?? []).toHaveLength(2)
  })

  it("renders the filled summary the model documents, and omits it when any slot is unlimited", () => {
    // `slotsFilledSummary` shipped as a documented export ("the block's one-line summary") that nothing
    // rendered. It is rendered here now; a null capacity means at least one slot is unlimited, and
    // printing a sum then would understate an event that can take everyone.
    expect(source).toContain("slotsFilledSummary(slots)")
    expect(source).toContain("filled.capacity !== null && filled.capacity > 0")
    expect(source).toContain('t("block.filled"')
  })
})

describe("an ENDED event's slot board is read-only, not just a DONE one", () => {
  const detail = code(readFileSync(new URL("../EventDetailBody.tsx", import.meta.url), "utf8"))

  it("passes readonly for an event whose window has passed, so no pill is tappable", () => {
    expect(detail).toContain("readonly={isDone || isCancelled || isEnded}")
  })

  it("takes `ended` from the SHARED lifecycle helper, not a second local clock rule", () => {
    expect(detail).toContain("const isEnded = hasEventEnded(cleanup, now)")
    expect(detail).toContain('from "./eventLifecycle"')
  })

  it("maps the server's ended refusal onto its own copy instead of the slot-filled line", () => {
    const block = code(SOURCES["EventSlotsBlock.tsx"])
    expect(block).toContain("claimSlotErrorKey(code, appErrorFields(err))")
    expect(block).not.toContain('t("error.full")')
  })
})

describe("the slot editor validates against the EVENT's window, not just the row", () => {
  const editor = code(SOURCES["SlotEditor.tsx"])
  const form = code(readFileSync(new URL("../CleanupForm.tsx", import.meta.url), "utf8"))

  it("passes the event window into the per-row error the card paints", () => {
    expect(editor).toContain("slotDraftError(draft, claimed, window)")
  })

  it("renders the window picker only for a row that HAS a window and an event end", () => {
    expect(editor).toContain("timed && window && eventEnd && draft.startsAt && draft.endsAt")
  })

  it("feeds the editor the same window the submit gate uses", () => {
    expect(form).toContain("window={cleanupFormWindow(value)}")
    expect(form).toMatch(/slotsValid\([\s\S]*?cleanupFormWindow\(value\),/)
  })

  it("offers Split into shifts only inside the caps and floors the schema enforces", () => {
    const form = code(readFileSync(new URL("../eventSlotsForm.ts", import.meta.url), "utf8"))
    expect(form).toContain("existing.length + count > MAX_EVENT_SLOTS")
    expect(form).toContain("count <= MAX_GENERATED_SHIFTS")
    expect(form).toContain("shift.end - shift.start < MIN_SLOT_DURATION_MS")
  })

  it("greys the out-of-reach split chips instead of hiding them, and de-dupes a second tap", () => {
    expect(editor).toContain("const offeredSplits = splitCounts(eventWindow, value, shiftTitle)")
    expect(editor).toContain("disabled={!offeredSplits.includes(count)}")
    expect(editor).toMatch(/generateShiftDrafts\([\s\S]*?value,\s*\)/)
  })

  it("greys Set a time until the event HAS an end, rather than letting the tap do nothing", () => {
    expect(editor).toContain("disabled={eventEnd === null}")
  })

  it("tells the host of an end-less event that timing a slot will store the end it shows", () => {
    const edit = code(readFileSync(new URL("../EditCleanupBody.tsx", import.meta.url), "utf8"))
    expect(editor).toContain("eventEndUnsaved && timed")
    expect(editor).toContain('t("editor.time_stores_event_end"')
    expect(form).toContain("eventEndUnsaved={eventEndUnsaved}")
    expect(edit).toContain("eventEndUnsaved={cleanup.endsAt == null}")
  })
})

describe("the edit form's capacity-below-claimed error actually blocks Save", () => {
  const form = code(readFileSync(new URL("../CleanupForm.tsx", import.meta.url), "utf8"))
  const edit = code(readFileSync(new URL("../EditCleanupBody.tsx", import.meta.url), "utf8"))
  const create = code(readFileSync(new URL("../CreateCleanupBody.tsx", import.meta.url), "utf8"))

  it("threads the live claim counts through the submit gate", () => {
    expect(form).toMatch(/slotsValid\(\s*value\.slots,/)
    expect(edit).toContain("isCleanupFormComplete(form, cleanup.slots)")
  })

  it("leaves the CREATE gate exactly as it was - a brand-new slot has no claims", () => {
    expect(create).toContain("isCleanupFormComplete(form)")
    expect(create).not.toMatch(/isCleanupFormComplete\(form,/)
  })
})

/** `key`, `key_one` or `key_other` - a plural key never exists under its bare path. */
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

describe("slot surfaces reference only real event-slots keys", () => {
  const catalog = JSON.parse(
    readFileSync(new URL("../../i18n/locales/en/event-slots.json", import.meta.url), "utf8"),
  ) as Record<string, unknown>

  for (const [name, source] of Object.entries(SOURCES)) {
    it(`${name}'s keys all exist in en/event-slots.json`, () => {
      // Dotted lowercase literals are the i18n keys in these two files; nothing else in them is quoted
      // in that shape (style values are single words, module specifiers carry a slash or a leading dot).
      const keys = [...source.matchAll(/"([a-z][a-z0-9_]*\.[a-z0-9_]+)"/g)].map((m) => m[1] ?? "")
      expect(keys.length).toBeGreaterThan(0)
      const missing = keys.filter((key) => !catalogHas(catalog, key))
      expect(missing).toEqual([])
    })
  }
})
