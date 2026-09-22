import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { RegistrationSourceSchema } from "@civfix/shared"

const LOCALES = ["en", "es", "de", "ko"] as const

const EVENT_FUNNEL_STEPS = ["page_views", "signups", "checked_in", "logged_hours"] as const

const body = readFileSync(new URL("../EventAnalyticsBody.tsx", import.meta.url), "utf8")
const markdown = readFileSync(
  new URL("../../../primitives/Markdown.tsx", import.meta.url),
  "utf8",
)

function catalog(lng: string, ns: string): Record<string, Record<string, string>> {
  return JSON.parse(
    readFileSync(new URL(`../../../i18n/locales/${lng}/${ns}.json`, import.meta.url), "utf8"),
  )
}

function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

describe("the funnel labels key off the wire step id, not a prettier synonym", () => {
  it("names every step the event analytics endpoint emits, in all four catalogs", () => {
    for (const step of EVENT_FUNNEL_STEPS) {
      for (const lng of LOCALES) {
        expect(catalog(lng, "host-analytics").funnel?.[step], `${lng} funnel.${step}`).toBeTruthy()
      }
    }
  })

  it("has dropped the old hours_logged spelling that never matched a wire id", () => {
    for (const lng of LOCALES) {
      expect(catalog(lng, "host-analytics").funnel?.["hours_logged"], lng).toBeUndefined()
    }
  })

  it("resolves the label with no defaultValue, so a future miss fails loudly", () => {
    expect(code(body)).toContain("t(`funnel.${bar.step}`)")
    expect(code(body)).not.toContain("defaultValue: bar.step")
  })
})

describe("the sign-up source breakdown shows labels, not raw enum values", () => {
  it("translates every registration source through the enums catalog, in all four locales", () => {
    for (const source of RegistrationSourceSchema.options) {
      for (const lng of LOCALES) {
        expect(
          catalog(lng, "enums").registrationSource?.[source],
          `${lng} registrationSource.${source}`,
        ).toBeTruthy()
      }
    }
  })

  it("routes the source bars through that catalog instead of the server's raw label", () => {
    expect(code(body)).toContain("tEnums(`registrationSource.${row.key}`)")
  })
})

describe("the updated stamp never composes 'Updated now ago'", () => {
  it("carries a standalone just-now line in all four catalogs", () => {
    for (const lng of LOCALES) {
      expect(catalog(lng, "host-analytics").page?.["updated_just_now"], lng).toBeTruthy()
    }
  })

  it("picks that line off the relative-time helper's own zero-case label", () => {
    expect(code(body)).toContain("const { relative, justNow } = useRelativeTime()")
    expect(code(body)).toContain("updatedAgo === justNow")
    expect(code(body)).toContain('t("page.updated_just_now")')
  })
})

describe("the impact lines pluralize instead of reading '1 reports linked'", () => {
  it("keeps only the CLDR plural forms for both counted lines", () => {
    for (const lng of LOCALES) {
      const page = catalog(lng, "host-analytics").page ?? {}
      for (const key of ["reports_line", "posts_line"]) {
        expect(page[key], `${lng} ${key}`).toBeUndefined()
        expect(page[`${key}_one`], `${lng} ${key}_one`).toBeTruthy()
        expect(page[`${key}_other`], `${lng} ${key}_other`).toBeTruthy()
      }
    }
  })

  it("says one thing in the singular and another in the plural in English", () => {
    const page = catalog("en", "host-analytics").page ?? {}
    expect(page["reports_line_one"]).toContain("report linked")
    expect(page["reports_line_other"]).toContain("reports linked")
    expect(page["posts_line_one"]).toContain("post about")
    expect(page["posts_line_other"]).toContain("posts about")
  })

  it("passes the i18next count variable both plural selectors need", () => {
    const source = code(body)
    expect(source).toContain("count: data.kpis.reportsLinked ?? 0")
    expect(source).toContain('t("page.posts_line", { count: data.kpis.postsCreated ?? 0 })')
    expect(source).not.toContain("linked: data.kpis.reportsLinked")
    expect(source).not.toContain("posts: data.kpis.postsCreated")
  })
})

describe("markdown emphasis survives the inline run", () => {
  it("renders a text leaf as a bare string, so it cannot re-assert the body variant", () => {
    const source = code(markdown)
    expect(source).toContain("<React.Fragment key={key}>{node.value}</React.Fragment>")
    expect(source).not.toMatch(/case "text":\s*return <Text key=\{key\}>/)
  })

  it("spans emphasis with a variant-free RN Text that inherits the block's typography", () => {
    const source = code(markdown)
    expect(source).toContain('import { Text as RNText, View')
    expect(source).toContain("<RNText key={key} style={styles.strong}>")
    expect(source).toContain("<RNText key={key} style={styles.em}>")
    expect(source).not.toMatch(/<Text key=\{key\} style=\{styles\.(strong|em|link)\}/)
  })

  it("still carries the bold face and the italic slant the composer promises", () => {
    expect(markdown).toContain("fontFamily: t.fontFamily.bodyBold")
    expect(markdown).toContain('fontStyle: "italic"')
  })
})
