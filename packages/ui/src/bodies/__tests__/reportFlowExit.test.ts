import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { reportFlowSource } from "../reportFlow/__tests__/reportFlowSource"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")

const body = reportFlowSource()
const LOCALES = ["en", "es", "de", "ko"] as const

describe("every exit from the report wizard returns to the surface it was launched from", () => {
  it("never resets the nav store back to the home feed", () => {
    expect(body).not.toContain(".reset()")
  })

  it("routes the first-step Back through leaveReportFlow", () => {
    expect(body).toContain("if (stepIndex <= 0) {\n      useNavStore.getState().leaveReportFlow()")
  })

  it("routes the three success hand-offs through finishReportFlow", () => {
    expect(body.match(/finishReportFlow\(/g)).toHaveLength(3)
    expect(body).toContain('finishReportFlow({ kind: "post-thread", id: postId })')
    expect(body).toContain('finishReportFlow({ kind: "composer" })')
    expect(body).toContain('finishReportFlow({\n                kind: "pin",')
  })

  it("labels the last success action Done and leaves through leaveReportFlow", () => {
    expect(body).toContain('t("submit.done")')
    expect(body).toContain('onPress={() => useNavStore.getState().leaveReportFlow()}')
  })

  it("carries no back_to_map copy in any locale", () => {
    for (const locale of LOCALES) {
      const catalog = read(`../../i18n/locales/${locale}/report-wizard.json`)
      expect(catalog).not.toContain("back_to_map")
      expect(JSON.parse(catalog).submit.done).toBeTruthy()
    }
  })
})
