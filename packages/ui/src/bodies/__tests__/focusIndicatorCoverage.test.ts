import { readdirSync, readFileSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const SRC = fileURLToPath(new URL("../../", import.meta.url))
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8")
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) {
      if (name !== "__tests__" && name !== "__snapshots__") tsxFiles(abs, out)
    } else if (name.endsWith(".tsx")) {
      out.push(abs.slice(SRC.length))
    }
  }
  return out
}

const RESET_DEFINITION_SITES = new Set(["primitives/ModalCardSheet.tsx"])

const fieldFiles = tsxFiles(SRC)
  .filter((rel) => !RESET_DEFINITION_SITES.has(rel))
  .filter((rel) => /webInputReset/.test(strip(read(rel))))

describe("a field that strips the UA focus ring must draw one of its own", () => {
  it("finds the field files by their reset, not by a hand-kept list", () => {
    expect(fieldFiles.length).toBeGreaterThanOrEqual(18)
  })

  it.each(fieldFiles)("%s reports focus to a focus STATE", (rel) => {
    const src = strip(read(rel))
    expect(src).toMatch(/onFocus=/)
    expect(src).toMatch(/onBlur=/)
  })

  it.each(fieldFiles)("%s owns a focused STYLE for that state", (rel) => {
    const src = strip(read(rel))
    expect(src).toMatch(/Focused|WEB_FIELD_RING/)
  })
})

describe("the focused-field recipe is ONE recipe", () => {
  const HOUSE = /Platform\.OS === "web"\s*\?\s*\(\{ boxShadow: tokens\.shadow\.ring, borderColor: (?:theme|t)\.colors\.accent \}/

  it.each([
    ["bodies/AddressSearch.tsx", "fieldFocused"],
    ["bodies/SearchBody.tsx", "fieldFocused"],
    ["bodies/EventsBody.tsx", "searchFieldFocused"],
    ["bodies/SocialBody.tsx", "searchFieldFocused"],
    ["bodies/ReportsBody.tsx", "searchFieldFocused"],
    ["bodies/MessagingListBody.tsx", "searchFieldFocused"],
    ["bodies/ConnectionsBody.tsx", "searchFieldFocused"],
    ["bodies/MemberPicker.tsx", "searchWrapFocused"],
    ["bodies/DeleteAccountModal.tsx", "codeInputFocused"],
    ["primitives/BringInput.tsx", "inputRowFocused"],
    ["primitives/ModalCardSheet.tsx", "modalSheetInputFocusedStyle"],
  ])("%s's %s is the coral border + the ring token on web", (rel, name) => {
    const src = strip(read(rel))
    expect(src).toContain(name)
    expect(HOUSE.test(src)).toBe(true)
  })

  it("the four dialogs take the shared style rather than re-stating it", () => {
    for (const rel of [
      "primitives/CancelEventSheet.tsx",
      "primitives/ReportContentSheet.tsx",
      "primitives/RequestResourcesSheet.tsx",
      "primitives/PollCreateSheet.tsx",
    ]) {
      expect(strip(read(rel))).toContain("modalSheetInputFocusedStyle")
    }
  })

  it("the slot card's BORDERLESS fields take the house ring's own constants", () => {
    const src = strip(read("bodies/SlotEditor.tsx"))
    expect(src).toMatch(/outlineWidth: FOCUS_RING_WIDTH/)
    expect(src).toMatch(/outlineColor: FOCUS_RING_COLOR/)
    expect(src).toMatch(/outlineOffset: FOCUS_RING_OFFSET/)
  })

  it("every tab stop the slot board added carries the ring, and the disclosure announces its state", () => {
    // Four stops per expanded row: the claim pill, the disclosure, each person row, and the overflow link.
    const src = strip(read("bodies/EventSlotsBlock.tsx"))
    expect((src.match(/\{\.\.\.focusRingProps\}/g) ?? []).length).toBeGreaterThanOrEqual(4)
    expect(src).toContain("accessibilityState={{ expanded }}")
    expect(src).toContain('accessibilityHint={t(expanded ? "row.collapse_hint" : "row.expand_hint")}')
  })
})

describe("the ring traces the control, not the hit target", () => {
  it("RsvpPill's 44pt target carries the capsule's radius", () => {
    const src = strip(read("primitives/RsvpPill.tsx"))
    expect(/target: \{[\s\S]*?borderRadius: t\.radius\.pill/.test(src)).toBe(true)
  })

  it("the change-photo control is the settings ROW, so its ring traces the row, not the avatar", () => {
    const view = strip(read("bodies/ProfileView.tsx"))
    expect(view).not.toContain("avatarWrap")
    const row = strip(read("bodies/settings/AvatarSettingRow.tsx"))
    expect(row).toContain("{...focusRingProps}")
    expect(/row: \{[\s\S]*?minHeight: SETTINGS_ROW_MIN_HEIGHT/.test(row)).toBe(true)
    expect(/avatarWrap: \{[\s\S]*?borderRadius: t\.radius\.pill/.test(row)).toBe(true)
  })

  it("the events list's card tap pushes its ring out to the CARD's edge and curve", () => {
    const src = strip(read("bodies/EventsBody.tsx"))
    expect(src).toMatch(/const CARD_RING_INSET = space\["4"\] \+ StyleSheet\.hairlineWidth/)
    expect(src).toMatch(/outlineOffset: CARD_RING_INSET/)
    expect(src).toMatch(/borderRadius: t\.radius\.lg - CARD_RING_INSET/)
  })

  it("the events card ring is INLINE, or the stylesheet's own offset would outrank it", () => {
    const src = strip(read("bodies/EventsBody.tsx"))
    expect(src).toMatch(/const WEB_CARD_RING: ViewStyle/)
    expect(src).toMatch(/styles\.cardTap,\s*WEB_CARD_RING/)
  })
})
