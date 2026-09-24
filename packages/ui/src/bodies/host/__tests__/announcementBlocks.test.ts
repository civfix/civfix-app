import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { seeAllTotal } from "../announcementModel"

const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const read = (rel: string): string => code(readFileSync(new URL(rel, import.meta.url), "utf8"))

const eventBlock = read("../EventAnnouncementsBlock.tsx")
const hostBlock = read("../HostAnnouncementsBlock.tsx")

describe("seeAllTotal", () => {
  it("reports the count once every page has loaded", () => {
    expect(seeAllTotal(7, false)).toBe(7)
  })

  it("claims no count while more pages exist, since the loaded rows are only a floor", () => {
    expect(seeAllTotal(20, true)).toBeNull()
  })
})

describe("the see-all link", () => {
  it.each([
    ["EventAnnouncementsBlock", eventBlock],
    ["HostAnnouncementsBlock", hostBlock],
  ])("%s drops the number rather than print the loaded page size", (_name, src) => {
    expect(src).toContain("const total = seeAllTotal(rows.length, query.hasNextPage)")
    expect(src).toContain('total === null ? t("announce.see_all_open") : t("announce.see_all", { total })')
    expect(src).not.toContain("{ total: rows.length }")
  })
})

describe("the event page's announcements section", () => {
  it("offers the retry row when the very first load fails", () => {
    expect(eventBlock).toContain("if (rows.length === 0 && !query.isError) return null")
    expect(eventBlock).not.toMatch(/if \(rows\.length === 0\) return null/)
  })

  it("is a heading one level under the event title", () => {
    expect(eventBlock).toContain('accessibilityRole="header" {...headingLevel(3)}')
  })
})

describe("load-more links ignore taps while a page is already loading", () => {
  it.each([
    ["EventDashboardBody.tsx", "hosted"],
    ["dashboard/CollaboratorsSection.tsx", "membersQuery"],
    ["AnnouncementsBody.tsx", "query"],
    ["OrgPageBody.tsx", "query"],
  ])("%s", (file, name) => {
    const src = read(`../${file}`)
    expect(src).toContain(`disabled={${name}.isFetchingNextPage}`)
    expect(src).toContain(`if (!${name}.isFetchingNextPage) void ${name}.fetchNextPage()`)
    expect(src).not.toMatch(new RegExp(`\\{\\s*void ${name}\\.fetchNextPage\\(\\)\\s*\\}`))
  })
})

describe("the org page", () => {
  it("marks its upcoming and past event lists as headings", () => {
    expect(read("../OrgPageBody.tsx")).toContain(
      '<Text style={styles.sectionTitle} accessibilityRole="header" {...headingLevel(2)}>',
    )
  })
})
