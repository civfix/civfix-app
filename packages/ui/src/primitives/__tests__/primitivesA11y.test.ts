/**
 * These components are React Native views that cannot render under plain Node, so most checks are narrow
 * source assertions on the exact prop that carries the semantics; pure models are exercised directly.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { sliceBetween, sliceFrom } from "../../__tests__/sourceGuards"
import { statTileSpokenLabel, STAT_VALUE_UNKNOWN } from "../statTileModel"
import { toastLiveSemantics } from "../toastModel"
import { a11yState } from "../../theme/a11yState"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const code = (rel: string): string =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")

describe("APP-A11Y-009 TextField labels its input for VoiceOver", () => {
  const field = code("../TextField.tsx")

  it("sets an explicit label after the spread, so a caller's own label still wins", () => {
    const input = sliceBetween(field, "<TextInput", "placeholderTextColor")
    expect(input.indexOf("{...rest}")).toBeLessThan(input.indexOf("accessibilityLabel="))
    expect(input).toContain("accessibilityLabel={rest.accessibilityLabel ?? label}")
    expect(input).toContain("accessibilityHint={rest.accessibilityHint ?? helper}")
    expect(input).toContain("accessibilityLabelledBy={label ? labelId : undefined}")
  })
})

describe("APP-A11Y-010 the Terms links are reachable outside the checkbox", () => {
  const terms = code("../TermsConfirmation.tsx")
  const checkbox = sliceBetween(terms, "<Pressable", "</Pressable>")

  it("keeps the checkbox to the box and its short label", () => {
    expect(checkbox).toContain('accessibilityRole="checkbox"')
    expect(checkbox).toContain('accessibilityLabel={t("a11y.affirmation")}')
    expect(checkbox).not.toContain('accessibilityRole="link"')
  })

  it("renders both legal links after the checkbox closes", () => {
    const after = sliceFrom(terms, "</Pressable>")
    expect(after.match(/accessibilityRole="link"/g)).toHaveLength(2)
  })

  it("keeps the row and the checkbox target tall enough to hit", () => {
    expect(terms).toContain("minHeight: 52")
    expect(terms).toContain("minHeight: 44")
  })
})

describe("APP-A11Y-011 dialog errors are announced", () => {
  const sheet = code("../ModalCardSheet.tsx")

  it("gives the error an alert role and a polite live region", () => {
    const error = sliceBetween(sheet, "{error ? (", "{error}")
    expect(error).toContain('accessibilityRole="alert"')
    expect(error).toContain('accessibilityLiveRegion="polite"')
    expect(error).not.toContain("numberOfLines")
  })

  it("speaks it on iOS, which does not announce a newly mounted alert", () => {
    expect(sheet).toContain('if (visible && error && Platform.OS === "ios") announce(error)')
  })
})

describe("APP-A11Y-012 FilterChip announces the semantics its caller means", () => {
  const chip = code("../FilterChip.tsx")

  it("maps single, multiple and action to radio, checkbox and button", () => {
    expect(chip).toContain('single: "radio"')
    expect(chip).toContain('multiple: "checkbox"')
    expect(chip).toContain('action: "button"')
    expect(chip).toContain("accessibilityRole={SELECTION_ROLE[selection]}")
    expect(chip).not.toContain('accessibilityRole="radio"')
  })

  it("gives an action chip no checked state and speaks the count in the default label", () => {
    expect(chip).toContain('{...a11yState(selection === "action" ? { disabled } : { checked: selected, disabled })}')
    expect(a11yState({ disabled: false })).not.toHaveProperty("aria-checked")
    expect(a11yState({ checked: true, disabled: false })).toMatchObject({ "aria-checked": true })
    expect(chip).toContain("count === undefined ? label : `${label}, ${count}`")
  })
})

describe("APP-A11Y-013 the one-time code field exposes its progress", () => {
  it("reports how many digits are entered on native", () => {
    const input = code("../SegmentedCodeInput.tsx")
    expect(input).toContain('t("verification_code.progress", { count: value.length, total: length })')
    expect(input).toContain("accessibilityValue={progress}")
  })
})

describe("APP-A11Y-014 EventCard's label keeps the date, place and organizer", () => {
  it("builds the label from the full detail template", () => {
    const card = code("../EventCard.tsx")
    expect(card).not.toContain('t("a11y.card", {')
    expect(card).toContain('t("a11y.card_detail", {')
    for (const slot of ["title:", "when:", "location:", "going:", "organizer:"]) expect(card).toContain(slot)
  })
})

describe("APP-A11Y-015 toasts interrupt only for errors, and hold while in use", () => {
  it("uses status for success and info, alert for errors", () => {
    expect(toastLiveSemantics("success", true)).toEqual({ role: "status", liveRegion: "polite" })
    expect(toastLiveSemantics("info", true)).toEqual({ role: "status", liveRegion: "polite" })
    expect(toastLiveSemantics("error", true)).toEqual({ role: "alert", liveRegion: "assertive" })
    expect(toastLiveSemantics("error", false)).toEqual({ role: "alert", liveRegion: "none" })
  })

  it("pauses the retire timer on hover or focus and restarts it after", () => {
    const toast = code("../Toast.tsx")
    expect(toast).toContain("const held = hovered || focused")
    expect(toast).toMatch(/if \(held\) \{\s*clearTimer\(id\)\s*return\s*\}/)
    expect(toast).toContain("onPointerEnter={() => setHovered(true)}")
    expect(toast).toContain("onFocus={() => setFocused(true)}")
    expect(toast).not.toContain('accessibilityRole="alert"')
  })
})

describe("APP-A11Y-017 report reasons are a radio group", () => {
  it("wraps the reasons in a radiogroup of checked radios", () => {
    const sheet = code("../ReportContentSheet.tsx")
    expect(sheet).toContain('accessibilityRole="radiogroup"')
    expect(sheet).toContain('accessibilityRole="radio"')
    expect(sheet).toContain("{...a11yState({ checked: selected })}")
    expect(a11yState({ checked: false })).toMatchObject({ "aria-checked": false })
    expect(sheet).not.toContain("accessibilityState={{ selected }}")
  })
})

describe("APP-A11Y-018 the toggle label column is not a duplicate screen-reader stop", () => {
  it.each(["../Toggle.tsx", "../SettingsRow.tsx"])("%s hides the label column and hints the switch", (file) => {
    const source = code(file)
    const column = sliceBetween(source, "focusable={false}", "<SettingsToggle")
    expect(column).toContain("accessibilityElementsHidden")
    expect(column).toContain('importantForAccessibility="no-hide-descendants"')
    expect(source).toMatch(/accessibilityHint=\{(helper|sub)\}/)
  })

  it.each(["../SettingsToggle.web.tsx", "../SettingsToggle.native.tsx"])("%s forwards the hint", (file) => {
    expect(code(file)).toContain("accessibilityHint={accessibilityHint}")
  })
})

describe("APP-A11Y-019 StatTile is one readable element", () => {
  it("speaks a word for an unknown value instead of the dash", () => {
    expect(statTileSpokenLabel("Check-ins", null, "Not available")).toBe("Check-ins: Not available")
    expect(statTileSpokenLabel("Check-ins", "12", "Not available")).toBe("Check-ins: 12")
    expect(statTileSpokenLabel("Signups", null, "Not available")).not.toContain(STAT_VALUE_UNKNOWN)
  })

  it("groups the tile without the non-ARIA summary role", () => {
    const tile = code("../StatTile.tsx")
    expect(tile).not.toContain('accessibilityRole="summary"')
    expect(tile).toMatch(/accessible\s+accessibilityRole="text"/)
    expect(tile).toContain('statTileSpokenLabel(label, value, t("stat_unknown"))')
  })
})

describe("APP-A11Y-020 loading is announced", () => {
  it("labels the spinner and the skeleton path", () => {
    const view = code("../StateView.tsx")
    expect(view).toContain("<ActivityIndicator color={t.colors.brand.bloom} accessibilityLabel={loading} />")
    expect(view).toContain('accessible accessibilityRole="progressbar" accessibilityLabel={loading}')
  })
})

describe("APP-A11Y-021 the About card is modal", () => {
  it("confines screen readers and hands keyboard focus to the card", () => {
    const card = code("../BrandAboutCard.tsx")
    expect(card).toContain("accessibilityViewIsModal")
    expect(card).toContain("onAccessibilityEscape={onClose}")
    expect(card).toContain('role="dialog"')
    expect(card).toContain("aria-modal")
    expect(card).toContain("closeRef.current?.focus()")
  })
})

describe("APP-A11Y-022 composer thumbs say which attachment they remove and when one is uploading", () => {
  it("numbers the remove control and labels the spinner", () => {
    const thumbs = code("../ComposerThumbs.tsx")
    expect(thumbs).toContain('t("media.remove_attachment_n", { index: index + 1, count: attachments.length })')
    expect(thumbs).toContain('accessibilityLabel={t("media.uploading")}')
  })
})

describe("APP-A11Y-024 the reaction rows are labelled toolbars", () => {
  it("never puts a bare label on a generic view", () => {
    const menu = code("../MessageContextMenu.tsx")
    expect(menu.match(/accessibilityRole="toolbar"\s+accessibilityLabel=\{t\("context_menu\.reactions"\)\}/g)).toHaveLength(2)
  })
})

describe("APP-A11Y-026 the switch knob honors reduced motion", () => {
  it("drops the overshooting transition on web", () => {
    expect(code("../SettingsToggle.web.tsx")).toContain("transition: still ? undefined : KNOB_TRANSITION")
  })

  it("snaps instead of springing on native", () => {
    expect(code("../SettingsToggle.native.tsx")).toContain("still ? x : withSpring(x, SPRING)")
  })
})
