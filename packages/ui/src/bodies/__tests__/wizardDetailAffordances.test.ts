import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const toggle = strip(read("../../primitives/Toggle.tsx"))
const settingsToggle = strip(read("../../primitives/SettingsToggle.web.tsx"))
const locationPicker = strip(read("../../map/LocationPicker.web.tsx"))
const reportFlow = strip(read("../ReportFlowBody.tsx"))
const addressSearch = strip(read("../AddressSearch.tsx"))
const linkedEvent = strip(read("../LinkedEventCard.tsx"))
const linkedReport = strip(read("../LinkedReportCard.tsx"))
const notifications = strip(read("../NotificationsBody.tsx"))
const rsvpPill = strip(read("../../primitives/RsvpPill.tsx"))
const eventDetail = strip(read("../EventDetailBody.tsx"))

describe("Toggle: one row, one tab stop", () => {
  it("takes the label column out of the tab order with BOTH the web and the native prop", () => {
    expect(toggle).toMatch(/focusable=\{false\}/)
    expect(toggle).toMatch(/tabIndex: -1/)
  })

  it("leaves the switch as the single stop that owns the role, the label and the ring", () => {
    expect(settingsToggle).toContain('accessibilityRole="switch"')
    expect(settingsToggle).toContain("focusRingProps")
    expect(toggle).toMatch(/accessibilityLabel=\{label\}/)
    expect(toggle).not.toMatch(/accessibilityRole/)
  })

  it("keeps the label column clickable, and ring-tagged so a click cannot paint the UA outline", () => {
    expect(toggle).toMatch(/onPress=\{\(\) => onValueChange\(!value\)\}/)
    expect(toggle).toContain("focusRingProps")
  })
})

describe("controls that are not RNW Pressables still get the house ring", () => {
  it("LocationPicker.web's Reset writes the data attribute by hand", () => {
    const resetButton = locationPicker.match(/<button[\s\S]*?onClick=\{onReset\}[\s\S]*?>/)?.[0] ?? ""
    expect(resetButton).toContain('data-focus-ring=""')
    expect(locationPicker).toMatch(/overlayReset: \{[\s\S]*?borderRadius: t\.radius\.pill/)
  })

  it("AddressSearch answers focus on the WRAPPER, since webInputReset strips the input's UA ring", () => {
    expect(addressSearch).toContain("webInputReset")
    expect(addressSearch).toMatch(/style=\{\[styles\.field, focused \? styles\.fieldFocused : null\]\}/)
    expect(addressSearch).toMatch(/onFocus=\{\(\) => \{\s*setFocused\(true\)/)
    expect(addressSearch).toMatch(/onBlur=\{\(\) => setFocused\(false\)\}/)
    const focusedStyle = addressSearch.match(/fieldFocused:([\s\S]*?)\n {2}input: \{/)?.[1] ?? ""
    expect(focusedStyle).toContain("tokens.shadow.ring")
    expect(focusedStyle).toContain("t.colors.accent")
    expect(focusedStyle).toContain('Platform.OS === "web"')
  })
})

describe("the report wizard's rings hug their controls", () => {
  it("the library link is a hugging capsule, not a full-width square", () => {
    const style = reportFlow.match(/\n {2}libraryLink: \{([\s\S]*?)\n {2}\},/)?.[1] ?? ""
    expect(style).toContain("borderRadius: t.radius.pill")
    expect(style).toContain('alignSelf: "center"')
    expect(style).not.toContain("backgroundColor")
    expect(style).not.toContain("borderWidth")
  })
})

describe("the composer's two attach lists speak one web vocabulary", () => {
  it.each([
    ["LinkedEventCard", linkedEvent],
    ["LinkedReportCard", linkedReport],
  ])("%s carries the focus ring, the cursor, the hover branch and the house transition", (_name, src) => {
    expect(src).toContain("focusRingProps")
    expect(src).toContain("webTransition")
    expect(src).toContain("webCursor")
    expect(src).toContain("webHover(state)")
  })

  it("LinkedReportCard hovers with a FILL, because an opacity dim is invisible on a white card", () => {
    const hovered = linkedReport.match(/\n {2}hovered: \{([\s\S]*?)\n {2}\},/)?.[1] ?? ""
    expect(hovered).toContain("t.colors.surfaceTint")
    expect(hovered).toContain("t.colors.borderStrong")
    expect(hovered).not.toContain("opacity")
  })

  it("hovering a SELECTED picker card deepens its coral instead of repainting it tan", () => {
    expect(linkedReport).toMatch(/selectable && selected\s*\?\s*styles\.hoveredSelected/)
    const hoveredSelected = linkedReport.match(/\n {2}hoveredSelected: \{([\s\S]*?)\n {2}\},/)?.[1] ?? ""
    expect(hoveredSelected).toContain('t.colors.bloom["100"]')
  })

  it("the remove (x) sibling is ring-tagged on both cards", () => {
    for (const src of [linkedEvent, linkedReport]) {
      const removeButton = src.match(/onPress=\{onRemove\}[\s\S]*?style=\{/)?.[0] ?? ""
      expect(removeButton).toContain("focusRingProps")
    }
  })
})

describe("NotificationsBody rows answer the pointer like every other list root", () => {
  it("branches on webHover with the 120ms webTransition and is ring-tagged", () => {
    expect(notifications).toContain("webHover(state)")
    expect(notifications).toContain("webTransition")
    const row = notifications.match(/accessibilityLabel=\{item\.read[\s\S]*?\]\}/)?.[0] ?? ""
    expect(row).toContain("focusRingProps")
  })

  it("an unread row keeps its coral wash on hover rather than being repainted tan", () => {
    expect(notifications).toMatch(/item\.read \? styles\.rowHovered : styles\.rowUnreadHovered/)
    const unreadHover = notifications.match(/\n {2}rowUnreadHovered: \{([\s\S]*?)\n {2}\},/)?.[1] ?? ""
    expect(unreadHover).toContain('t.colors.bloom["100"]')
  })
})

describe("the event detail leads with one full-width RSVP", () => {
  it("the RSVP pill fills its cell only when the caller opts in, and only in landscape", () => {
    expect(rsvpPill).toMatch(/fill = false/)
    expect(rsvpPill).toMatch(/const fillCell = stretchToCell && fill/)
    expect(rsvpPill).toMatch(/const stretchToCell = useLayoutMode\(\) === "expanded"/)
    const visualFill = rsvpPill.match(/\n {2}visualFill: \{([\s\S]*?)\n {2}\},/)?.[1] ?? ""
    expect(visualFill).toContain("flexGrow: 1")
    expect(rsvpPill).toMatch(/POP_ENABLED \?[\s\S]*?fillCell \? styles\.visualFill : null/)
  })

  it("every other RsvpPill call site keeps the hugging 30/34pt pill", () => {
    const rsvpElements = (src: string) =>
      src.split("<RsvpPill").slice(1).map((seg) => seg.slice(0, seg.indexOf("/>")))
    const sites: Array<[string, string]> = [
      ["LinkedEventCard", linkedEvent],
      ["EventDetailBody", eventDetail],
      ["SearchResults", strip(read("../SearchResults.tsx"))],
      ["EventsBody", strip(read("../EventsBody.tsx"))],
    ]
    const filled = sites.flatMap(([name, src]) =>
      rsvpElements(src).filter((el) => /\bfill\b/.test(el)).map(() => name),
    )
    expect(filled).toEqual(["EventDetailBody"])
    expect(sites.every(([, src]) => rsvpElements(src).length > 0)).toBe(true)
  })

  it("the detail's RSVP is the page's single, full-width primary action", () => {
    expect(eventDetail.match(/<RsvpPill\b/g) ?? []).toHaveLength(1)
    expect(eventDetail).toMatch(/\n {2}rsvp: \{[\s\S]*?height: 44,/)
    expect(eventDetail).toMatch(/\n {2}rsvp: \{[\s\S]*?alignSelf: "stretch",/)
  })

  it("Repost is a quiet action row, so nothing competes with the pill", () => {
    expect(eventDetail).not.toMatch(/styles\.secondaryTall/)
    expect(eventDetail).not.toMatch(/useLayoutMode/)
    const repost = eventDetail.match(/label=\{t\("actions\.repost"\)\}[\s\S]*?\/>/)?.[0] ?? ""
    expect(repost).toContain("onPress={onRepost}")
    const actionRow = strip(read("../EventActionRow.tsx"))
    expect(actionRow).toContain("focusRingProps")
    expect(actionRow).toContain("webTransition")
    expect(actionRow).toContain("webHover(state)")
    expect(actionRow).toContain("webCursor(disabled)")
  })
})
