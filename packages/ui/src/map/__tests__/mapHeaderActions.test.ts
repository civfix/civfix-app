import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const source = read("../MapHeaderActions.tsx")
const controls = read("../MapControls.tsx")

describe("MapHeaderActions", () => {
  it("reuses the feed header controls so the map top-right is pixel-identical to Your Feed", () => {
    expect(source).toContain('from "../bodies/HeaderProfileButton"')
    expect(source).toContain('<HeaderProfileButton surface="solid" />')
  })

  it("puts the notifications bell before the avatar, where the appearance toggle was", () => {
    expect(source).toContain('from "../bodies/NotificationsButton"')
    const bell = source.indexOf('<NotificationsButton variant="solid" />')
    expect(bell).toBeGreaterThan(-1)
    expect(bell).toBeLessThan(source.indexOf("<HeaderProfileButton"))
    expect(source).not.toContain("MapThemeToggle")
  })

  it("carries no create affordance of its own - the dock's camera tab owns that entry", () => {
    expect(source).not.toMatch(/icon="Plus"/)
    expect(source).not.toContain("openReportFlow")
    expect(source).not.toMatch(/kind: "composer"/)
    expect(source).not.toMatch(/selectView\("report"\)/)
  })

  it("centres the row against the glass controls opposite it, off the shared tokens", () => {
    expect(source).toContain('import { HEADER_CONTROL_SIZE } from "../primitives/headerControls"')
    expect(source).toContain(
      "const rowCenterOffset = (GLASS_CONTROL_SIZE - HEADER_CONTROL_SIZE) / 2",
    )
  })

  it("mounts in the compact MapControls branch only, below the safe-area inset", () => {
    expect(source).toContain("topInset")
    const compact = controls.slice(controls.indexOf('if (mode === "expanded")'))
    expect(compact).toContain("<MapHeaderActions topInset={topInset} />")
    expect(controls.slice(0, controls.indexOf('if (mode === "expanded")'))).not.toContain(
      "<MapHeaderActions",
    )
  })
})
