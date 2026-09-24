import { readFileSync } from "node:fs"
import { describe, it, expect } from "vitest"
import { DEFAULT_APPEARANCE_PREFERENCE } from "../../theme/schemes"
import type { AppearancePreference } from "../../theme/schemes"
import {
  appearanceCommit,
  appearancePressTarget,
  appearanceRowState,
  scheduleAfterPaint,
  type AppearancePending,
} from "../appearanceSelection"

function fakeFrames() {
  const queued = new Map<number, () => void>()
  let next = 1
  return {
    schedule: (callback: () => void): number => {
      const handle = next++
      queued.set(handle, callback)
      return handle
    },
    cancel: (handle: number): void => {
      queued.delete(handle)
    },
    pending: (): number => queued.size,
    paint: (): void => {
      const due = [...queued.entries()]
      queued.clear()
      for (const [, callback] of due) callback()
    },
  }
}

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")

const tap = (target: AppearancePreference, from: AppearancePreference): AppearancePending => ({
  target,
  from,
})

describe("the appearance option list is the one picker both surfaces mount", () => {
  const LIST = read("../AppearanceOptionList.tsx")
  const RADIO_ROW = read("../../primitives/RadioOptionRow.tsx")
  const BODY = read("../AppearanceSettingsBody.tsx")

  it("owns the rows, the radio group and the store write", () => {
    expect(LIST).toContain('accessibilityRole="radiogroup"')
    expect(LIST).toContain("<RadioOptionRow")
    expect(RADIO_ROW).toContain('accessibilityRole="radio"')
    expect(LIST).toContain("setAppearancePreference(commit.preference)")
  })

  it("leaves the settings body with nothing but the heading and the shared list", () => {
    expect(BODY).toContain('import { AppearanceOptionList } from "./AppearanceOptionList"')
    expect(BODY).toContain("<AppearanceOptionList />")
    expect(BODY).not.toContain("setAppearancePreference")
    expect(BODY).not.toContain('accessibilityRole="radio"')
  })

  it("is exported from the bodies barrel, so hosts outside settings can mount it", () => {
    expect(read("../index.ts")).toContain(
      'export { AppearanceOptionList } from "./AppearanceOptionList"',
    )
  })

  it("carries no beta pill and no experimental caption on the dark row", () => {
    expect(LIST).not.toMatch(/BetaPill/)
    expect(LIST).not.toMatch(/badge/)
    expect(LIST).not.toContain('t("option.dark_beta")')
    expect(LIST).not.toContain('t("option.dark_sub")')
    expect(LIST).toContain("label={label}")
    expect(RADIO_ROW).toContain("accessibilityLabel={label}")
  })

  it("paints from tokens only", () => {
    expect(LIST).not.toMatch(/#[0-9a-fA-F]{6}/)
    expect(RADIO_ROW).not.toMatch(/#[0-9a-fA-F]{6}/)
  })

  it("has dropped the beta copy from all four appearance catalogs, keeping the system caption", () => {
    for (const lng of ["en", "es", "de", "ko"]) {
      const catalog = JSON.parse(read(`../../i18n/locales/${lng}/appearance-settings.json`)) as {
        option?: { dark_beta?: string; dark_sub?: string; system_sub?: string }
      }
      expect(catalog.option?.dark_beta, `${lng} still has option.dark_beta`).toBeUndefined()
      expect(catalog.option?.dark_sub, `${lng} still has option.dark_sub`).toBeUndefined()
      expect(catalog.option?.system_sub, `${lng} is missing option.system_sub`).toBeTruthy()
    }
  })
})

describe("the tapped row answers before the theme commit", () => {
  const LIST = read("../AppearanceOptionList.tsx")
  const RADIO_ROW = read("../../primitives/RadioOptionRow.tsx")

  it("shows a spinner in the checkmark slot while the tap is pending", () => {
    expect(appearanceRowState("dark", tap("dark", "light"), "light")).toEqual({
      selected: true,
      pending: true,
    })
    expect(appearanceRowState("light", tap("dark", "light"), "light")).toEqual({
      selected: false,
      pending: false,
    })
  })

  it("swaps the spinner for the checkmark once the store reports the tapped preference", () => {
    expect(appearanceRowState("dark", tap("dark", "light"), "dark")).toEqual({
      selected: true,
      pending: false,
    })
  })

  it("marks nothing pending when no tap is in flight", () => {
    expect(appearanceRowState("light", null, "light")).toEqual({ selected: true, pending: false })
    expect(appearanceRowState("dark", null, "light")).toEqual({ selected: false, pending: false })
  })

  it("defers the store write to the commit after the pending paint, then clears itself", () => {
    expect(appearanceCommit(null, "light")).toEqual({ kind: "idle" })
    expect(appearanceCommit(tap("dark", "light"), "light")).toEqual({
      kind: "apply",
      preference: "dark",
    })
    expect(appearanceCommit(tap("dark", "light"), "dark")).toEqual({ kind: "clear" })
  })

  it("lets an external write win: a preference changed under an in-flight tap drops the tap", () => {
    expect(appearanceCommit(tap("dark", "light"), "system")).toEqual({ kind: "clear" })
    expect(appearanceRowState("dark", tap("dark", "light"), "system").pending).toBe(true)
  })

  it("ignores a tap on the row that is already showing, and retargets an in-flight one", () => {
    expect(appearancePressTarget("light", null, "light")).toBeNull()
    const inFlight = tap("dark", "light")
    expect(appearancePressTarget("dark", inFlight, "light")).toBe(inFlight)
    expect(appearancePressTarget("light", inFlight, "light")).toEqual(tap("light", "light"))
    expect(appearancePressTarget("system", inFlight, "light")).toEqual(tap("system", "light"))
  })

  it("walks a whole tap through pending, applied and cleared", () => {
    const applied: AppearancePreference = "light"
    const target = appearancePressTarget("dark", null, applied)
    expect(target).toEqual(tap("dark", "light"))
    expect(appearanceRowState("dark", target, applied).pending).toBe(true)
    const commit = appearanceCommit(target, applied)
    expect(commit).toEqual({ kind: "apply", preference: "dark" })
    const nextApplied: AppearancePreference = "dark"
    expect(appearanceRowState("dark", target, nextApplied)).toEqual({
      selected: true,
      pending: false,
    })
    expect(appearanceCommit(target, nextApplied)).toEqual({ kind: "clear" })
  })

  it("fires the selection haptic and announces busy from the shared capability seam", () => {
    expect(LIST).toContain("haptics.selection()")
    expect(LIST).toContain('from "../capabilities"')
    expect(LIST).toContain("pending={pending}")
    expect(RADIO_ROW).toContain("accessibilityState={{ checked: selected, busy: pending }}")
  })

  it("stays silent when the tap changes nothing, so the applied row never buzzes", () => {
    expect(LIST).toMatch(
      /const next = appearancePressTarget\(code, pending, preference\)\s*\n\s*if \(next === pending\) return\s*\n\s*haptics\.selection\(\)/,
    )
  })

  it("mirrors the radio state into the aria attributes react-native-web emits", () => {
    expect(RADIO_ROW).toContain("aria-checked={selected}")
    expect(RADIO_ROW).toContain("aria-busy={pending}")
  })

  it("writes the store from an effect, never straight out of the press handler", () => {
    expect(LIST).toContain("useEffect")
    expect(LIST).not.toContain("setTimeout")
    expect(LIST).not.toContain("InteractionManager")
    expect(LIST).toMatch(/setAppearancePreference\(commit\.preference\)/)
    expect(LIST).toContain("return scheduleAfterPaint(")
  })

  it("holds the store write for two frames, so the pending row gets a painted frame", () => {
    const frames = fakeFrames()
    let applied = 0
    scheduleAfterPaint(() => (applied += 1), frames.schedule, frames.cancel)

    expect(applied).toBe(0)
    frames.paint()
    expect(applied, "the first frame must only re-arm, never write").toBe(0)
    frames.paint()
    expect(applied, "the write lands on the frame after the pending paint").toBe(1)
  })

  it("cancels a scheduled write when the row is retargeted or unmounted", () => {
    const frames = fakeFrames()
    let applied = 0
    const cancel = scheduleAfterPaint(() => (applied += 1), frames.schedule, frames.cancel)
    cancel()
    frames.paint()
    frames.paint()
    expect(applied).toBe(0)
    expect(frames.pending()).toBe(0)
  })

  it("cancels the second frame too when the retarget lands between the two", () => {
    const frames = fakeFrames()
    let applied = 0
    const cancel = scheduleAfterPaint(() => (applied += 1), frames.schedule, frames.cancel)
    frames.paint()
    cancel()
    frames.paint()
    expect(applied).toBe(0)
  })

  it("paints the spinner with the checkmark's own token color", () => {
    expect(RADIO_ROW).toContain('<ActivityIndicator size="small" color={th.colors.brand.bloom} />')
    expect(RADIO_ROW).toContain("const CHECK_GLYPH = 18")
    expect(RADIO_ROW).toContain("<Icon icon={iconMap.Check} size={CHECK_GLYPH} color={th.colors.brand.bloom} />")
  })

  it("takes the spinner from react-native and pins the slot so nothing reflows", () => {
    expect(RADIO_ROW).toMatch(/import \{[^}]*ActivityIndicator[^}]*\} from "react-native"/s)
    expect(RADIO_ROW).toContain("const TRAILING_SLOT = 24")
    expect(RADIO_ROW).toMatch(/trailing: \{\s*width: TRAILING_SLOT,\s*height: TRAILING_SLOT,/)
  })
})

describe("the retained native map does not re-serialize its style on every render", () => {
  it("memoizes the raster style on the scheme and the key", () => {
    const MAP = read("../../map/Map.native.tsx")
    expect(MAP).toContain("[cartoApiKey, scheme]")
    expect(MAP).toMatch(/const resolvedStyle = useMemo\(/)
  })
})

describe("the shipped default appearance", () => {
  it("follows the device, so the splash, the boot gate and the first frame agree either way", () => {
    expect(DEFAULT_APPEARANCE_PREFERENCE).toBe("system")
  })
})
