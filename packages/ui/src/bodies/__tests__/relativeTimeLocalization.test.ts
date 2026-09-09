import { readFileSync, readdirSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { dayLabel, listTimeAgo, todayKey } from "../relativeTime"
import { buildRenderItems } from "../conversation/conversationModel"
import type { ChatItem } from "@civfix/shared"

function localIso(year: number, monthIndex: number, day: number, hour = 12): string {
  return new Date(year, monthIndex, day, hour).toISOString()
}

const DE = {
  today: "Heute",
  yesterday: "Gestern",
  locale: "de-DE",
}

describe("listTimeAgo takes the active locale's labels", () => {
  it("keeps the English defaults when no options are supplied", () => {
    const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString()
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString()
    expect(listTimeAgo(thirtySecondsAgo)).toBe("now")
    expect(listTimeAgo(twoHoursAgo)).toBe("2h")
  })

  it("uses the supplied just-now label and unit suffixes", () => {
    const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString()
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString()
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString()
    const units = { minute: "m", hour: "h", day: "T", week: "W" }
    expect(listTimeAgo(thirtySecondsAgo, { justNow: "jetzt", units })).toBe("jetzt")
    expect(listTimeAgo(twoHoursAgo, { justNow: "jetzt", units })).toBe("2h")
    expect(listTimeAgo(threeDaysAgo, { justNow: "jetzt", units })).toBe("3T")
  })

  it("formats the past-week absolute fallback in the supplied locale", () => {
    const longAgo = new Date(Date.now() - 40 * 86_400_000).toISOString()
    const en = listTimeAgo(longAgo, { locale: "en-US" })
    const de = listTimeAgo(longAgo, { locale: "de-DE" })
    expect(en).not.toBe("")
    expect(de).not.toBe("")
    expect(de).not.toBe(en)
  })
})

describe("dayLabel takes the active locale's Today/Yesterday", () => {
  it("keeps the English defaults when no options are supplied", () => {
    expect(dayLabel(new Date().toISOString())).toBe("Today")
    expect(dayLabel(new Date(Date.now() - 86_400_000).toISOString())).toBe("Yesterday")
  })

  it("returns the supplied labels for today and yesterday", () => {
    expect(dayLabel(new Date().toISOString(), DE)).toBe("Heute")
    expect(dayLabel(new Date(Date.now() - 86_400_000).toISOString(), DE)).toBe("Gestern")
  })

  it("measures the buckets against the supplied `now`, not the wall clock", () => {
    const opts = { ...DE, now: "2026-07-24" }
    expect(dayLabel(localIso(2026, 6, 24), opts)).toBe("Heute")
    expect(dayLabel(localIso(2026, 6, 23), opts)).toBe("Gestern")
    expect(dayLabel(localIso(2026, 6, 22), opts)).not.toBe("Gestern")
  })

  it("crosses a month and a year boundary when stepping back a day", () => {
    expect(dayLabel(localIso(2026, 5, 30), { now: "2026-07-01" })).toBe("Yesterday")
    expect(dayLabel(localIso(2025, 11, 31), { now: "2026-01-01" })).toBe("Yesterday")
  })

  it("only omits the year while the day is in the reference year", () => {
    const sameYear = dayLabel(localIso(2026, 2, 4), { now: "2026-07-24", locale: "en-US" })
    const otherYear = dayLabel(localIso(2024, 2, 4), { now: "2026-07-24", locale: "en-US" })
    expect(sameYear).not.toContain("2026")
    expect(otherYear).toContain("2024")
  })

  it("still returns '' for an unparseable date", () => {
    expect(dayLabel("not-a-date", DE)).toBe("")
  })
})

describe("todayKey", () => {
  it("is the local calendar day of the supplied clock", () => {
    expect(todayKey(new Date(2026, 6, 24, 23, 59))).toBe("2026-07-24")
    expect(todayKey(new Date(2026, 6, 25, 0, 1))).toBe("2026-07-25")
  })
})

describe("buildRenderItems threads the day labels into its separators", () => {
  const item = (iso: string, id: string): ChatItem =>
    ({
      message: { id, createdAt: iso, kind: "text", from: { id: "u1", name: "A" } },
      mine: false,
      pending: false,
      failed: false,
    }) as unknown as ChatItem

  it("labels the separator with the supplied copy", () => {
    const rows = buildRenderItems(
      [item(localIso(2026, 6, 23), "a"), item(localIso(2026, 6, 24), "b")],
      false,
      { ...DE, now: "2026-07-24" },
    )
    const separators = rows.filter((r) => r.type === "sep").map((r) => r.label)
    expect(separators).toEqual(["Gestern", "Heute"])
  })

  it("falls back to English when the caller supplies nothing", () => {
    const rows = buildRenderItems([item(new Date().toISOString(), "a")], false)
    expect(rows.filter((r) => r.type === "sep").map((r) => r.label)).toEqual(["Today"])
  })
})

/**
 * Half-adopting a localization seam is worse than not adopting it: a ko user seeing "3일" in the activity
 * inbox and "3d" in the feed on the same screen is a visible bug that the all-English original did not
 * have. So the guard is on the SEAM, not on any one screen - nothing outside relativeTime.ts and its hook
 * may call the bare formatter.
 */
describe("every list timestamp goes through the localized seam", () => {
  const SRC_ROOT = new URL("../../", import.meta.url)
  const EXEMPT = new Set(["relativeTime.ts", "useListTimeAgo.ts"])

  const walk = (dir: URL): string[] => {
    const out: string[] = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue
      const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dir)
      if (entry.isDirectory()) out.push(...walk(child))
      else if (/\.tsx?$/.test(entry.name) && !EXEMPT.has(entry.name)) out.push(child.pathname)
    }
    return out
  }

  it("leaves no un-localized listTimeAgo/dayLabel call anywhere in the package", () => {
    const offenders: string[] = []
    for (const file of walk(SRC_ROOT)) {
      const source = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
      for (const match of source.matchAll(/\b(listTimeAgo|dayLabel)\(([^)]*)\)/g)) {
        const args = (match[2] ?? "").split(",")
        if (args.length < 2) offenders.push(`${file.split("/src/")[1]}: ${match[0]}`)
      }
    }
    expect(offenders, "call useListTimeAgo() / pass DayLabelOptions instead").toEqual([])
  })

  it("keeps the pure model injectable so non-React callers still work", () => {
    const model = readFileSync(new URL("../postCardModel.ts", import.meta.url), "utf8")
    expect(model).toContain("timeAgo?: (iso: string) => string")
    expect(model).toContain("(options.timeAgo ?? listTimeAgo)(post.createdAt)")
  })
})
