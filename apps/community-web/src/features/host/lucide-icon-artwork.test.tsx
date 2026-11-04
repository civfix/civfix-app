import { readFileSync } from "node:fs"
import { Building2, CalendarDays, type LucideIcon } from "lucide-react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

// lucide-react 1 redrew these icons, and the website has to draw them as on main (D28 holds 0.x).
function iconChildren(Icon: LucideIcon): string {
  const html = renderToStaticMarkup(createElement(Icon))
  const match = /^<svg[^>]*>([\s\S]*)<\/svg>$/.exec(html)
  if (!match?.[1]) throw new Error(`not a single <svg>: ${html}`)
  return match[1]
}

const APP = new URL("../../../", import.meta.url)

describe("lucide-react icon artwork", () => {
  it("T1: the website holds lucide-react on 0.469 and the lockfile resolves only 0.469.0", () => {
    const pkg = JSON.parse(readFileSync(new URL("package.json", APP), "utf8")) as {
      dependencies: Record<string, string>
    }
    expect(pkg.dependencies["lucide-react"]).toBe("^0.469.0")

    const lockfile = readFileSync(new URL("../../pnpm-lock.yaml", APP), "utf8")
    const resolved = new Set(
      [...lockfile.matchAll(/^ {2}lucide-react@([^(:]+)[(:]/gm)].map((m) => m[1]),
    )
    expect([...resolved]).toEqual(["0.469.0"])
  })

  it("T2: Building2 draws as on main", () => {
    expect(iconChildren(Building2)).toBe(
      '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path><path d="M10 6h4"></path><path d="M10 10h4"></path><path d="M10 14h4"></path><path d="M10 18h4"></path>',
    )
  })

  it("T2: CalendarDays draws as on main", () => {
    expect(iconChildren(CalendarDays)).toBe(
      '<path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path><path d="M16 18h.01"></path>',
    )
  })
})
