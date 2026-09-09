import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const source = read("../MapHeaderActions.tsx")
const controls = read("../MapControls.tsx")

describe("MapHeaderActions", () => {
  it("reuses the feed header controls so the map top-right is pixel-identical to Your Feed", () => {
    expect(source).toContain('from "../bodies/HeaderIconButton"')
    expect(source).toContain('from "../bodies/HeaderProfileButton"')
    expect(source).toContain('<HeaderProfileButton surface="solid" />')
    expect(source).toMatch(/icon="Plus"/)
  })

  it("opens the report wizard through openReportFlow, not the composer", () => {
    expect(source).toContain('import { openReportFlow } from "../bodies/composerCreateFlow"')
    expect(source).toContain("onPress={openReportFlow}")
    expect(source).not.toMatch(/kind: "composer"/)
    expect(source).not.toMatch(/selectView\("report"\)/)
  })

  it('labels the plus with the create menu key that already ships in every locale', () => {
    expect(source).toContain('t("create.report")')
  })

  it("mounts in the compact MapControls branch only, below the safe-area inset", () => {
    expect(source).toContain("topInset")
    const compact = controls.slice(controls.indexOf("if (mode === \"expanded\")"))
    expect(compact).toContain("<MapHeaderActions topInset={topInset} />")
    expect(controls.slice(0, controls.indexOf("if (mode === \"expanded\")"))).not.toContain(
      "<MapHeaderActions",
    )
  })
})
