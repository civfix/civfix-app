import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const SOURCE = readFileSync(new URL("../ProfileStatsRow.tsx", import.meta.url), "utf8")
const VIEW = readFileSync(new URL("../ProfileView.tsx", import.meta.url), "utf8")
const PERSON = readFileSync(new URL("../PersonDetailBody.tsx", import.meta.url), "utf8")
const LINK = readFileSync(new URL("../../typography/TextLink.tsx", import.meta.url), "utf8")
const catalog = JSON.parse(
  readFileSync(new URL("../../i18n/locales/en/profile-view.json", import.meta.url), "utf8"),
) as { stats?: Record<string, string>; impact?: Record<string, string> }

const items = [...SOURCE.matchAll(/\{ key: "([a-z]+)", value: ([^,]+), labelKey: "([a-z.]+)", connection: ([^ ]+) \}/g)]

describe("the profile's five numbers", () => {
  it("runs Following, Followers, Reports, Fixed, Cleanups - in that order", () => {
    expect(items.map((m) => m[1])).toEqual(["following", "followers", "reports", "fixed", "cleanups"])
    expect(items.map((m) => m[2])).toEqual([
      "source.following",
      "source.followers",
      "source.stats.reports",
      "source.stats.fixed",
      "source.stats.cleanups",
    ])
  })

  it("makes ONLY the two connection counts pressable", () => {
    expect(items.map((m) => m[4])).toEqual(['"following"', '"followers"', "null", "null", "null"])
    expect(SOURCE).toMatch(/if \(!which \|\| !onOpenConnections\) \{/)
    expect(SOURCE).toContain("onOpenConnections(which)")
    expect(SOURCE).toContain('accessibilityRole="button"')
  })

  it("names only real profile-view keys, and the card stack's keys are gone", () => {
    const keys = items.map((m) => m[3] as string)
    expect(keys).toEqual([
      "stats.following",
      "stats.followers",
      "stats.reports",
      "stats.fixed",
      "stats.cleanups",
    ])
    for (const key of keys) {
      const leaf = key.split(".")[1] as string
      const entry = catalog.stats?.[leaf] ?? catalog.stats?.[`${leaf}_other`]
      expect(entry, `en profile-view is missing ${key}`).toBeTruthy()
    }
    expect(catalog.impact, "the tiles' catalog block is orphaned copy now").toBeUndefined()
    expect(SOURCE).not.toContain('"Followers"')
    expect(SOURCE).not.toContain('"Cleanups"')
  })

  it("counts go through the ONE compact formatter the app already has", () => {
    expect(SOURCE).toContain('import { formatPostActionCount } from "../primitives/postActionModel"')
    expect(SOURCE).toContain("formatPostActionCount(item.value)")
    expect(SOURCE).not.toMatch(/toLocaleString|Intl\.NumberFormat/)
    expect(SOURCE).toContain("accessibilityLabel={`${count} ${label}`}")
    expect(SOURCE).not.toContain("${item.value} ${label}")
  })

  it("is ONE row of five equal columns: no cards, no wrap, flex-shared width", () => {
    expect(SOURCE).not.toMatch(/backgroundColor: theme\.colors\.surface/)
    expect(SOURCE).not.toMatch(/borderWidth/)
    expect(SOURCE).not.toMatch(/theme\.shadows/)
    expect(SOURCE).not.toMatch(/flexWrap/)
    expect(SOURCE).toMatch(/stat: \{\n {4}flex: 1,/)
    expect(SOURCE).toContain("<View style={styles.row}>{items.map(renderStat)}</View>")
    expect(SOURCE).not.toContain("useLayoutMode")
  })

  it("keeps the pressable labels unselectable on web", () => {
    expect(SOURCE).toContain("webNoSelect")
    expect(SOURCE).toMatch(/styles\.stat,\n\s+webNoSelect,/)
  })

  it("soft-underlines ONLY the two pressable labels, through the shared TextLink primitive", () => {
    expect(SOURCE).toContain('import { Text, TextLink } from "../typography"')
    expect(SOURCE).toMatch(/pressable \? \(\s*<TextLink style=\{styles\.label\}/)
    expect(SOURCE).not.toContain("labelPressable")
    const linkStyle = /link: \{[^}]*\}/.exec(LINK)?.[0] ?? ""
    expect(linkStyle).toContain('textDecorationLine: "underline"')
    expect(linkStyle).toContain("t.colors.textMuted")
    expect(linkStyle).toContain("t.fontFamily.bodySemiBold")
    const plainLabel = /\n {2}label: \{[^}]*\}/.exec(SOURCE)?.[0] ?? ""
    expect(plainLabel).not.toContain("textDecorationLine")
  })
})

describe("both profiles read the same run", () => {
  it("the own profile mounts it and wires its connection pushes", () => {
    expect(VIEW).toContain("<ProfileStatsRow")
    expect(VIEW).toContain("onOpenConnections={onOpenConnections}")
    expect(VIEW).not.toContain("align=")
  })

  it("the public profile mounts the SAME component with no layout fork", () => {
    expect(PERSON).toContain("<ProfileStatsRow")
    expect(PERSON).not.toContain("align=")
    expect(PERSON).toContain("onOpenConnections={onOpenConnections}")
    expect(PERSON).not.toContain("ImpactTiles")
    expect(PERSON).not.toContain("ProfileConnections")
  })

  it("keeps each host pushing its OWN id", () => {
    expect(VIEW).not.toContain("kind: which")
    expect(PERSON).toMatch(/useNavStore\.getState\(\)\.push\(\{ kind: which, id: profile\.id \}\)/)
  })
})
