import React from "react"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { slotGroupHeaderA11yLabel } from "../rosterSlotGroups"

// These bodies import react-native, which this package's node vitest cannot load, so the exact props
// are pinned by reading the source (the house pattern, see focusRing.test.ts).
const code = (rel: string) =>
  readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const eventsBody = code("../EventsBody.tsx")
const slotsBlock = code("../EventSlotsBlock.tsx")
const slotEditor = code("../SlotEditor.tsx")
const slotWindow = code("../SlotWindowPicker.tsx")
const timezoneField = code("../TimezoneField.tsx")
const actionRow = code("../EventActionRow.tsx")
const detail = code("../EventDetailBody.tsx")
const form = code("../CleanupForm.tsx")
const fieldRow = code("../DateTimeFieldRow.tsx")
const webPicker = code("../InlineDateTimePicker.web.tsx")
const hoursBlock = code("../EventHoursBlock.tsx")
const hoursEditor = code("../LogHoursEditor.tsx")

const pressableWith = (src: string, anchor: string) => {
  const at = src.indexOf(anchor)
  const open = src.lastIndexOf("<Pressable", at)
  return at < 0 || open < 0 ? "" : src.slice(open, src.indexOf("</Pressable>", at))
}

describe("the events list", () => {
  it("re-renders its section headers when the theme's styles change", () => {
    expect(eventsBody).toMatch(/\[onOpenEvent, styles\],\s*\)/)
  })

  it("flips a card's RSVP pill to ended when the event ends, not only on the next remount", () => {
    expect(eventsBody).toContain("const now = useNow(0, { boundaryAt: eventEndsAtMs(cleanup) })")
    expect(eventsBody).toContain("ended={hasEventEnded(cleanup, now)}")
    expect(eventsBody).not.toContain("hasEventEnded(cleanup, Date.now())")
  })

  it("makes the search clear a 44pt box around its 22pt disc, since rn-web drops hitSlop", () => {
    const clear = pressableWith(eventsBody, 't("search.clear_a11y")')
    expect(clear).not.toContain("hitSlop")
    expect(clear).toContain("style={styles.clearTarget}")
    expect(eventsBody).toMatch(/clearTarget: \{\s*width: MIN_TOUCH_TARGET,\s*height: MIN_TOUCH_TARGET,/)
  })

  it("keeps the date chip's month legible", () => {
    expect(eventsBody).toMatch(/dateMonth: \{[^}]*fontSize: 11,/)
  })
})

describe("the slot board", () => {
  it("refuses a second claim from the same frame with a ref, not only the render-time busy flag", () => {
    expect(slotsBlock).toContain("if (boardBusy) return")
    expect(slotsBlock).toMatch(/if \(inFlight\.current\) return\s*inFlight\.current = true/)
    expect(slotsBlock.match(/onSettled: settle,/g) ?? []).toHaveLength(2)
  })

  it("names the board as a section heading under the event title", () => {
    expect(slotsBlock).toMatch(
      /<Text style=\{styles\.eyebrow\} accessibilityRole="header" \{\.\.\.headingLevel\(3\)\}>/,
    )
  })

  it("builds each spoken label from ONE key, so every locale owns its order and punctuation", () => {
    expect(slotsBlock).toContain(
      't("row.window_count_a11y", { title: slot.title, range, count: slot.claimed })',
    )
    expect(slotsBlock).toContain(
      't("row.faces_names_more", { names: previewNames, count: previewOverflow })',
    )
    expect(slotsBlock).not.toMatch(/`\$\{t\("row\.window_a11y"/)
    expect(slotsBlock).not.toMatch(/`\$\{previewNames\} \$\{t\(/)
  })
})

describe("the slot editor", () => {
  it("asks for whole numbers with the integer keypad", () => {
    expect(slotEditor).toContain('keyboardType="number-pad"')
    expect(slotEditor).not.toContain("decimal-pad")
  })

  it("gives the stepper and remove controls a 44pt box around their small discs", () => {
    expect(slotEditor).toMatch(/discTarget: \{\s*width: MIN_TOUCH_TARGET,\s*height: MIN_TOUCH_TARGET,/)
    expect(slotEditor.match(/styles\.discTarget,/g) ?? []).toHaveLength(3)
    expect(slotEditor).not.toContain("hitSlop={4}")
    expect(slotEditor).not.toContain("hitSlop={6}")
  })

  it("stacks the chevrons as two 44pt-wide halves that only spend slop on their outer edge", () => {
    expect(slotEditor).toMatch(/reorderBtn: \{\s*width: MIN_TOUCH_TARGET,\s*height: MIN_TOUCH_TARGET \/ 2,/)
    expect(slotEditor).toContain("const MOVE_UP_HIT_SLOP = { top: MIN_TOUCH_TARGET / 4 }")
    expect(slotEditor).toContain("const MOVE_DOWN_HIT_SLOP = { bottom: MIN_TOUCH_TARGET / 4 }")
  })

  it("announces a card's validation error when it appears", () => {
    expect(slotEditor).toContain(
      '<Text style={styles.errorLine} accessibilityRole="alert" accessibilityLiveRegion="polite">',
    )
  })

  it("drops a refused-pick error once the host moves the event window", () => {
    expect(slotWindow).toContain("const windowKey = `${eventStart.getTime()}|${eventEnd.getTime()}`")
    expect(slotWindow).toContain("const invalidEdge = refused?.windowKey === windowKey ? refused.edge : null")
  })
})

describe("the date and time rows", () => {
  it("announce a field error when it appears", () => {
    expect(fieldRow).toContain(
      '<View style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="polite">',
    )
  })

  it("never let showPicker's activation error escape the press handler on web", () => {
    expect(webPicker).toMatch(/try \{\s*input\.showPicker\?\.\(\)\s*\} catch \{/)
  })
})

describe("the time zone field", () => {
  it("refreshes a zone's name per day, so a DST change reads PDT rather than a cached PST", () => {
    expect(timezoneField).toContain("const key = `${Math.floor(Date.now() / DAY_MS)}|${locale}|${timeZone}`")
  })

  it("exposes the change toggle as a disclosure and the zones as radios", () => {
    expect(timezoneField).toContain("accessibilityState={{ expanded: open }}")
    expect(timezoneField).toContain('accessibilityRole="radio"')
    expect(timezoneField).toContain("accessibilityState={{ checked: selected }}")
    expect(timezoneField).not.toContain("accessibilityState={{ selected }}")
  })
})

describe("the event form", () => {
  it("marks the event-type segment with radio semantics", () => {
    expect(form).toContain("accessibilityState={{ checked: active }}")
    expect(form).not.toContain("accessibilityState={{ selected: active }}")
  })

  it("gives the compact meeting-point reset a 44pt target without slop", () => {
    const reset = pressableWith(form, 'accessibilityLabel={tMap("actions.reset")}')
    expect(reset).not.toContain("hitSlop")
    expect(form).toMatch(/compactLocClear: \{[^}]*minHeight: MIN_TOUCH_TARGET,/)
  })
})

describe("the event detail", () => {
  it("tags every section title as a level-3 heading under the level-2 event title", () => {
    for (const key of ['t("bring.heading")', 't("host.heading")', 'reports.length > LINKED_REPORTS_COUNT_AT']) {
      const at = detail.indexOf(key)
      const tag = detail.slice(detail.lastIndexOf("<Text", at), at)
      expect(tag, key).toContain('accessibilityRole="header" {...headingLevel(3)}')
    }
  })

  it("hides the decorative cover from assistive tech", () => {
    const hero = detail.match(/function EventHero\([\s\S]*?\n\}/)?.[0] ?? ""
    expect(hero).toContain("aria-hidden")
    expect(hero).toContain('importantForAccessibility="no-hide-descendants"')
    expect(hero).toContain("accessibilityElementsHidden")
  })

  it("keys the action rows by the element key, so a row appearing does not remount its siblings", () => {
    expect(actionRow).toContain("key={React.isValidElement(row) ? (row.key ?? index) : index}")
    const rows = React.Children.toArray([null, React.createElement("b", null), React.createElement("i", null)])
    const withFirst = React.Children.toArray([
      React.createElement("a", null),
      React.createElement("b", null),
      React.createElement("i", null),
    ])
    expect((rows[0] as React.ReactElement).key).toBe((withFirst[1] as React.ReactElement).key)
  })
})

describe("the hours controls", () => {
  it("meet the 44pt floor in the box itself", () => {
    expect(hoursEditor).toMatch(/btn: \{\s*minHeight: MIN_TOUCH_TARGET,/)
    const edit = pressableWith(hoursBlock, 't("log_hours.summary_edit_a11y")')
    expect(edit).not.toContain("hitSlop")
    expect(edit).toContain("styles.editTarget")
    expect(hoursBlock).toMatch(/editTarget: \{\s*minWidth: MIN_TOUCH_TARGET,\s*minHeight: MIN_TOUCH_TARGET,/)
  })
})

describe("slotGroupHeaderA11yLabel", () => {
  const t = (key: string, options: Record<string, unknown>) => `${key}|${JSON.stringify(options)}`
  const base = { title: "Setup", range: "9:00 - 11:00 AM" }

  it("speaks the count a timed header's badge shows", () => {
    expect(slotGroupHeaderA11yLabel(t, { ...base, claimed: 3, capacity: 5 })).toBe(
      `roster.window_capacity_a11y|${JSON.stringify({ ...base, count: 3, capacity: 5 })}`,
    )
    expect(slotGroupHeaderA11yLabel(t, { ...base, claimed: 3, capacity: null })).toBe(
      `roster.window_count_a11y|${JSON.stringify({ ...base, count: 3 })}`,
    )
  })

  it("keeps the plain window label without a badge, and no label at all for an untimed header", () => {
    expect(slotGroupHeaderA11yLabel(t, { ...base, claimed: null, capacity: null })).toBe(
      `roster.window_a11y|${JSON.stringify(base)}`,
    )
    expect(slotGroupHeaderA11yLabel(t, { title: "Setup", range: null, claimed: 3, capacity: 5 })).toBeNull()
  })

  it("is what the header renders", () => {
    const header = code("../SlotGroupHeader.tsx")
    expect(header).toContain("slotGroupHeaderA11yLabel(t, { title, range, claimed, capacity })")
    expect(header).not.toContain('t("roster.window_a11y"')
  })
})
