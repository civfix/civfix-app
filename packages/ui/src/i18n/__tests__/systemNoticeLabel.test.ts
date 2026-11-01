import { describe, expect, it } from "vitest"
import de from "../locales/de/common.json"
import en from "../locales/en/common.json"
import es from "../locales/es/common.json"
import ko from "../locales/ko/common.json"

const catalogs: Record<string, Record<string, unknown>> = { en, de, es, ko }

describe("the system notice's close label", () => {
  it.each(Object.keys(catalogs))("T25: common.dismiss_announcement is set in %s", (locale) => {
    const value = catalogs[locale]!["dismiss_announcement"]
    expect(typeof value).toBe("string")
    expect((value as string).trim()).not.toBe("")
  })

  it("T25: reads exactly Dismiss announcement in en", () => {
    expect(en).toHaveProperty("dismiss_announcement", "Dismiss announcement")
  })
})
