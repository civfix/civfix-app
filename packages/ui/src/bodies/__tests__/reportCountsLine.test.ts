import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { createI18n } from "../../i18n/config"
import { reportCountsLine } from "../reportCountsLine"

const { t } = createI18n("en")
const line = (confirmCount: number, fixedCount: number) => reportCountsLine(t, { confirmCount, fixedCount })

describe("GH#203 counts line", () => {
  it("T1: joins both counts with a comma when both are above 0", () => {
    expect(line(3, 1)).toBe("3 neighbors confirmed this, 1 neighbor says this is fixed")
  })

  it("T2: leaves out a zero confirm count with its comma", () => {
    expect(line(0, 1)).toBe("1 neighbor says this is fixed")
  })

  it("T3: leaves out a zero fixed count with its comma", () => {
    expect(line(2, 0)).toBe("2 neighbors confirmed this")
  })

  it("T4: has no line when both counts are 0", () => {
    expect(line(0, 0)).toBeNull()
  })

  it("T5: uses the singular for one and the plural otherwise", () => {
    expect(line(1, 0)).toBe("1 neighbor confirmed this")
    expect(line(0, 4)).toBe("4 neighbors say this is fixed")
  })
})

// The package root pulls in native-only modules under vitest, so its export is read from the barrels.
describe("reportCountsLine export", () => {
  it("is exported from @civfix/ui", () => {
    const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")
    expect(read("../../index.ts")).toMatch(/export \* from "\.\/bodies"/)
    expect(read("../index.ts")).toMatch(/export \{ reportCountsLine \} from "\.\/reportCountsLine"/)
  })
})
