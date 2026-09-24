import { readFileSync } from "node:fs"
import { describe, it, expect, beforeEach } from "vitest"
import {
  getOnboardingTourPresenter,
  setOnboardingTourPresenter,
  useOnboardingTourPresenter,
} from "../onboardingTour"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")

beforeEach(() => setOnboardingTourPresenter(null))

describe("the onboarding-tour presenter seam", () => {
  it("exports the setter, the plain reader and the subscribing hook", () => {
    expect(typeof setOnboardingTourPresenter).toBe("function")
    expect(typeof getOnboardingTourPresenter).toBe("function")
    expect(typeof useOnboardingTourPresenter).toBe("function")
  })

  it("starts unregistered, so a host that never registers keeps the row hidden", () => {
    expect(getOnboardingTourPresenter()).toBeNull()
  })

  it("hands back the exact function the host registered", () => {
    const present = () => {}
    setOnboardingTourPresenter(present)
    expect(getOnboardingTourPresenter()).toBe(present)
  })

  it("UNREGISTERS on null, so an unmounting host cannot leave a dead presenter behind", () => {
    setOnboardingTourPresenter(() => {})
    setOnboardingTourPresenter(null)
    expect(getOnboardingTourPresenter()).toBeNull()
  })

  it("stores the presenter itself rather than calling it as a state updater", () => {
    let calls = 0
    const present = () => {
      calls += 1
    }
    setOnboardingTourPresenter(present)
    expect(calls).toBe(0)
    getOnboardingTourPresenter()?.()
    expect(calls).toBe(1)
  })

  it("exports the host-facing setter and the subscribing hook from the bodies barrel, types included", () => {
    const barrel = read("../index.ts")
    expect(barrel).toContain("setOnboardingTourPresenter")
    expect(barrel).not.toContain("getOnboardingTourPresenter")
    expect(barrel).toContain("useOnboardingTourPresenter")
    expect(barrel).toContain('export type { OnboardingTourPresenter } from "./onboardingTour"')
  })
})

describe("Settings > App carries the tour row only when a host registers a presenter", () => {
  const SRC = read("../SettingsBody.tsx")

  it("reads the presenter through the SUBSCRIBING hook, so registering re-renders the body", () => {
    expect(SRC).toContain('import { useOnboardingTourPresenter } from "./onboardingTour"')
    expect(SRC).toContain("const presentTour = useOnboardingTourPresenter()")
    expect(SRC).not.toContain("getOnboardingTourPresenter")
  })

  it("renders a Compass SettingsRow guarded on the presenter and wired straight to it", () => {
    expect(SRC).toMatch(
      /\{presentTour \? \(\s*<SettingsRow\s+icon="Compass"\s+label=\{t\("tour\.label"\)\}\s+sub=\{t\("tour\.sub"\)\}\s+onPress=\{presentTour\}\s*\/>\s*\) : null\}/,
    )
  })

  it("sits in the App section, under the language row", () => {
    expect(SRC.indexOf('t("language.label")')).toBeLessThan(SRC.indexOf('t("tour.label")'))
    expect(SRC.indexOf('t("tour.label")')).toBeLessThan(SRC.indexOf('t("section.about")'))
  })

  it("takes Compass from the shared icon map rather than a one-off glyph", () => {
    expect(read("../../typography/iconMap.ts")).toContain('| "Compass"')
  })

  it("has the row's copy in all four settings catalogs", () => {
    for (const lng of ["en", "es", "de", "ko"]) {
      const catalog = JSON.parse(read(`../../i18n/locales/${lng}/settings.json`)) as {
        tour?: { label?: string; sub?: string }
      }
      expect(catalog.tour?.label, `${lng}/settings is missing tour.label`).toBeTruthy()
      expect(catalog.tour?.sub, `${lng}/settings is missing tour.sub`).toBeTruthy()
    }
  })
})

describe("ReportRowView's onPress override", () => {
  const SRC = read("../ReportRow.tsx")

  it("is optional, so every existing caller keeps the nav push", () => {
    expect(SRC).toContain("onPress?: () => void")
  })

  it("REPLACES the nav push when provided instead of firing alongside it", () => {
    expect(SRC).toContain("onPress={onPress ?? pushDetail}")
    expect(SRC).toMatch(
      /const pushDetail = useCallback\(\(\) => \{\s*useNavStore\.getState\(\)\.push\(\{ kind: "pin", id, lat, lng \}\)\s*\}, \[id, lat, lng\]\)/,
    )
    expect(SRC).not.toMatch(/onPress\?\.\(\)[\s\S]{0,120}useNavStore/)
  })

  it("keeps exactly one Pressable press handler on the row", () => {
    expect(SRC.match(/onPress=\{/g)).toHaveLength(1)
  })

  it("is exported from the bodies barrel with its props type", () => {
    const barrel = read("../index.ts")
    expect(barrel).toContain('export { ReportRowView } from "./ReportRow"')
    expect(barrel).toContain('export type { ReportRowViewProps } from "./ReportRow"')
  })
})
