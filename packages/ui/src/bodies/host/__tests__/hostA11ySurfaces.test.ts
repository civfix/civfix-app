import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const read = (rel: string): string => code(readFileSync(new URL(rel, import.meta.url), "utf8"))

const constant = (src: string, name: string): number => {
  const match = src.match(new RegExp(`const ${name} = (\\d+)\\n`))
  if (!match) throw new Error(`no constant ${name}`)
  return Number(match[1])
}

const announce = read("../HostAnnounceBody.tsx")
const manage = read("../OrgManageBody.tsx")
const roster = read("../RosterCheckinList.tsx")
const consent = read("../registration/ConsentChecks.tsx")
const questions = read("../registration/RegistrationQuestions.tsx")
const panels = read("../HostInsightsPanels.tsx")
const analytics = read("../EventAnalyticsBody.tsx")

describe("the audience picker's radios", () => {
  it("announce checked, like every other radio in the package", () => {
    expect(announce).toContain('accessibilityRole="radio"')
    expect(announce).toContain("accessibilityState={{ checked: selected, disabled: create.isPending }}")
    expect(announce).not.toContain("accessibilityState={{ selected, disabled: create.isPending }}")
  })
})

describe("small controls reach 44 px on native and at least 24 px on web", () => {
  it.each([
    ["HostAnnounceBody Preview toggle", announce, "TOGGLE"],
    ["OrgManageBody Remove logo", manage, "GHOST"],
    ["RosterCheckinList Check in", roster, "CHECK_IN"],
  ])("%s", (_name, src, prefix) => {
    const height = constant(src, `${prefix}_MIN_HEIGHT`)
    expect(height).toBeGreaterThanOrEqual(24)
    expect(constant(src, "MIN_TOUCH_TARGET")).toBe(44)
    expect(src).toContain(`const ${prefix}_SLOP_Y = (MIN_TOUCH_TARGET - ${prefix}_MIN_HEIGHT) / 2`)
    expect(src).toContain(`hitSlop={${prefix}_HIT_SLOP}`)
    expect(src).toContain(`minHeight: ${prefix}_MIN_HEIGHT,`)
  })

  it("drops the padding-only sizing the toggle and ghost button had", () => {
    expect(announce).not.toMatch(/toggle: \{\n\s+paddingVertical: 4,/)
    expect(manage).not.toMatch(/ghost: \{\n\s+paddingVertical: 6,/)
  })
})

describe("the terms consent row", () => {
  const termsRow = consent.slice(
    consent.indexOf("checked={value.terms}"),
    consent.indexOf("</Row>", consent.indexOf("checked={value.terms}")),
  )

  it("keeps the checkbox label as plain text, with no link nested inside the checkbox", () => {
    expect(termsRow).not.toContain('accessibilityRole="link"')
    expect(termsRow).not.toContain("onPress")
    expect(termsRow).toContain('{t("consent.terms_link")}')
  })

  it("puts Terms and Privacy Policy in focusable links beside it", () => {
    expect(consent).toContain('<TextLink variant="caption" standalone onPress={() => openLegal(TERMS_URL)}>')
    expect(consent).toContain('<TextLink variant="caption" standalone onPress={() => openLegal(PRIVACY_URL)}>')
  })
})

describe("registration questions", () => {
  it("say required in the label a screen reader reads", () => {
    expect(questions).toContain('t("questions.required_a11y", { prompt: question.prompt })')
    expect(questions).not.toContain("accessibilityLabel={question.prompt}")
    expect(questions).not.toContain("a11yLabel={question.prompt}")
  })

  it("label the multi-select options as one group, as the single-select radiogroup is", () => {
    expect(questions).toContain('<View style={styles.options} role="group" accessibilityLabel={promptA11y}>')
  })
})

describe("the ticket-type capacity bar", () => {
  it("reads a localized sentence with formatted numbers", () => {
    expect(panels).toContain('accessibilityLabel={t("by_type.meter_a11y", {')
    expect(panels).not.toContain("accessibilityLabel={`${type.name}: ")
  })
})

describe("the analytics funnel", () => {
  it("labels a group rather than a plain view no platform announces", () => {
    expect(analytics).toContain('<View style={styles.block} role="group" accessibilityLabel={t("funnel.a11y")}>')
  })
})
