import { describe, expect, it } from "vitest"
import type { ReportDTO, ReportStatus } from "@civfix/contract"
import { createI18n } from "../../i18n/config"
import { canMeToo } from "../reportDetail/useReportMeToo"

function report(over: Partial<ReportDTO>): ReportDTO {
  return {
    id: "r1",
    category: "trash",
    status: "published",
    visibility: "public",
    title: "Overflowing bin",
    mine: false,
    confirmCount: 0,
    confirmedByMe: false,
    ...over,
  } as unknown as ReportDTO
}

describe("canMeToo", () => {
  it.each<ReportStatus>(["published", "acknowledged", "in_progress"])(
    "T7: offers Me too on someone else's %s report",
    (status) => {
      expect(canMeToo(report({ mine: false, status }))).toBe(true)
    },
  )

  it("T8: never on a resolved report, even one already confirmed", () => {
    expect(canMeToo(report({ mine: false, status: "resolved", confirmedByMe: true }))).toBe(false)
  })

  it("T9: never on the reporter's own report", () => {
    expect(canMeToo(report({ mine: true, status: "published" }))).toBe(false)
  })
})

describe("vote copy", () => {
  it("T17: reads I see it too on the report page and the duplicate screen, Looks fixed, and counts neighbors", () => {
    const { t } = createI18n("en")
    expect(t("report-detail:confirm.see_too")).toBe("I see it too")
    expect(t("report-wizard:wizard.duplicate.see_too")).toBe("I see it too")
    expect(t("report-detail:confirm.fixed")).toBe("Looks fixed")
    expect(t("report-row:confirm_count", { count: 1 })).toBe("1 neighbor confirmed this")
  })
})
