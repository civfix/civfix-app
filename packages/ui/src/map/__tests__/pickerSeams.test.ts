import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { DEFAULT_ATTRIBUTION } from "../mapStyle"

// Map seams and RN surfaces cannot render in node, so these fixes are pinned by source.
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

const webPicker = code(read("../LocationPicker.web.tsx"))
const nativePicker = code(read("../LocationPicker.native.tsx"))
const reportPickNative = code(read("../ReportPickMap.native.tsx"))

describe("the main-map picker mirrors an external value instead of reverting it", () => {
  const body = /function MainMapLocationPicker\([\s\S]*?\n\}\n/.exec(webPicker)?.[0] ?? ""

  it("commits a new draft only when the DRAFT moved, never because the parent's value moved", () => {
    expect(body).toMatch(
      /React\.useEffect\(\(\) => \{\n\s+if \(!draft\) return\n\s+const current = valueRef\.current\n\s+if \(current && samePickPoint\(draft, current\)\) return\n\s+onChangeRef\.current\(draft\.lat, draft\.lng\)\n\s+\}, \[draft\]\)/,
    )
    expect(body).not.toContain("}, [draft, value])")
  })

  it("moves the preview pin to an external value (an address pick) itself", () => {
    expect(body).toMatch(
      /React\.useEffect\(\(\) => \{\n\s+if \(!value\) return\n\s+const current = useLocationPick\.getState\(\)\.draft\n\s+if \(current && samePickPoint\(current, value\)\) return\n\s+useLocationPick\.getState\(\)\.setDraft\(value\.lat, value\.lng\)\n\s+\}, \[value\]\)/,
    )
  })
})

describe("the native picker's value effect has no side effects inside a state updater", () => {
  it("decides and flies in the effect body, then sets plain state", () => {
    const effect = /useEffect\(\(\) => \{\n\s+if \(!value\) \{[\s\S]*?\}, \[value, cameraSeed\]\)/.exec(nativePicker)?.[0] ?? ""
    expect(effect).not.toBe("")
    expect(effect).not.toContain("setPicked((")
    expect(effect).toContain("const prev = pickedRef.current")
    expect(effect).toContain("setPicked(value)")
    expect(nativePicker).toContain("pickedRef.current = picked")
  })
})

describe("the report picker's native pins do not wait for a camera move after getViewState fails", () => {
  it("falls back to a seed-zoom query instead of swallowing the rejection", () => {
    expect(reportPickNative).not.toContain(".catch(() => undefined)")
    expect(reportPickNative).toContain(".catch(() => runner.request())")
    expect(reportPickNative).toContain("if (mapReadyRef.current) setNodes(query(WORLD_BBOX, seedRef.current.zoom))")
  })
})

describe("the native pickers credit the basemap with the full OSM attribution", () => {
  it("shows DEFAULT_ATTRIBUTION rather than the shortened a11y string", () => {
    expect(DEFAULT_ATTRIBUTION).toContain("OpenStreetMap contributors")
    for (const src of [nativePicker, reportPickNative]) {
      expect(src).toContain("{DEFAULT_ATTRIBUTION}")
      expect(src).not.toContain('t("a11y.attribution")')
    }
  })
})

describe("a picker with no centre yet tells the user what is happening and how out", () => {
  it("web: a status with visible text replaces the bare busy div", () => {
    const pending = /if \(!cameraSeed\) \{[\s\S]*?\n {2}\}/.exec(webPicker)?.[0] ?? ""
    expect(pending).toContain('role="status"')
    expect(pending).toContain('{t("hint.pending")}')
  })

  it("native: the placeholder carries the same hint in a polite live region", () => {
    expect(nativePicker).toContain("if (!initialViewState) {")
    const pending = /if \(!initialViewState\) \{[\s\S]*?\n {2}\}/.exec(nativePicker)?.[0] ?? ""
    expect(pending).toContain("styles.pending")
    expect(pending).toContain('accessibilityLiveRegion="polite"')
    expect(pending).toContain('{t("hint.pending")}')
  })
})

describe("the expanded map header's profile entry", () => {
  const controls = code(read("../MapControls.tsx"))

  it("continues to the profile after sign-in, like the compact header's button", () => {
    expect(controls).not.toContain("requireAuth(() => {})")
    expect(controls).toContain('requireAuth(() => useNavStore.getState().push({ kind: "profile" }))')
  })

  it("uses the translated fallback name", () => {
    expect(controls).not.toContain('?? "You"')
    expect(controls).toContain('user?.displayName ?? tNav("fallback_you")')
  })
})

describe("the layers popover honours reduced motion", () => {
  const popover = code(read("../LayersPopover.tsx"))

  it("snaps to its end state and reports closed without animating", () => {
    expect(popover).toContain("const reducedMotion = useReducedMotion() === true")
    expect(popover).toMatch(
      /if \(reducedMotion\) \{\n\s+animRef\.current = null\n\s+progress\.setValue\(isClosing \? 0 : 1\)\n\s+if \(isClosing\) onClosedRef\.current\?\.\(\)\n\s+return\n\s+\}/,
    )
    expect(popover).toContain("}, [isClosing, reducedMotion])")
  })
})

describe("the web pick step is dismissable from the keyboard", () => {
  const step = code(read("../PortraitMapPickStep.web.tsx"))

  it("cancels on Escape while live, unless something inside already handled the key", () => {
    expect(step).toContain('if (e.key !== "Escape" || e.defaultPrevented) return')
    expect(step).toContain('document.addEventListener("keydown", onKeyDown)')
    expect(step).toContain('document.removeEventListener("keydown", onKeyDown)')
  })

  it("moves a keyboard user into the address search and hands focus back on close", () => {
    expect(step).toContain('if (opener?.matches(":focus-visible")) {')
    expect(step).toContain('topBar?.querySelector("input")?.focus()')
    expect(step).toContain("if (opener?.isConnected) opener.focus()")
  })
})
