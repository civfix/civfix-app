import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const SRC = readFileSync(new URL("../DropPinBody.tsx", import.meta.url), "utf8")

const catalog = (locale: string): { dropPin: Record<string, unknown> } =>
  JSON.parse(
    readFileSync(new URL(`../../i18n/locales/${locale}/map-ui.json`, import.meta.url), "utf8"),
  ) as { dropPin: Record<string, unknown> }

describe("the drop-pin menu offers one thing to do with the spot", () => {
  it("keeps 'Report an issue here' as the only action card", () => {
    expect(SRC).toContain('title={t("dropPin.report.title")}')
    expect(SRC.match(/<ActionCard/g) ?? []).toHaveLength(1)
  })

  it("no longer hosts an event from the pin", () => {
    expect(SRC).not.toContain("dropPin.host")
    expect(SRC).not.toContain("onHost")
    expect(SRC).not.toMatch(/kind: "create-cleanup"/)
  })

  it("still cancels back off the map, and still guards an unfinished report", () => {
    expect(SRC).toContain('t("dropPin.cancel")')
    expect(SRC).toContain("planDropPinReportSeed")
  })

  it("carries no orphaned host copy in any of the four catalogs", () => {
    for (const locale of ["en", "es", "de", "ko"]) {
      const dropPin = catalog(locale).dropPin
      expect(dropPin.host, `${locale} still ships dropPin.host`).toBeUndefined()
      expect(dropPin.report).toBeTruthy()
    }
  })
})
