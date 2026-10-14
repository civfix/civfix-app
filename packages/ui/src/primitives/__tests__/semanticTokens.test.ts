import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const NEW_SURFACES = [
  "../SectionCard.tsx",
  "../SegmentedControl.tsx",
  "../FilterChip.tsx",
  "../StatTile.tsx",
  "../HeroStat.tsx",
  "../Meter.tsx",
  "../TrendSparkline.tsx",
  "../trendSparklineModel.ts",
  "../meterModel.ts",
  "../statTileModel.ts",
  "../../bodies/host/PhaseHeader.tsx",
  "../../bodies/host/HostSkeletons.tsx",
]

describe("the new host surfaces are token-only", () => {
  it.each(NEW_SURFACES)("hardcodes no colour in %s", (rel) => {
    expect(strip(read(rel))).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it.each(NEW_SURFACES)("reads the scheme at render time in %s, never the static theme", (rel) => {
    const src = strip(read(rel))
    expect(src).not.toMatch(/import \{[^}]*\b(theme|colors|glass|shadows)\b[^}]*\} from "(\.\.\/)+theme"/)
  })
})

describe("the coral CTA", () => {
  const button = strip(read("../PrimaryButton.tsx"))

  it("labels the primary fill with the ink neutral that clears 4.5:1, not white", () => {
    expect(button).toContain("return t.colors.onCta")
    expect(button).toContain('case "primary":')
  })

  it("drops the coral glow for the neutral elevation token", () => {
    expect(button).not.toContain("t.shadows.pin")
    expect(button).toContain("t.shadows.s2")
  })

  it("carries a destructive variant filled with the danger role", () => {
    expect(button).toContain(
      'export type ButtonVariant = "primary" | "destructive" | "dark" | "outline" | "ghost"',
    )
    expect(button).toContain("backgroundColor: t.colors.dangerFill")
    expect(button).toContain("return t.colors.onDanger")
  })

  it("leaves the dark variant on onAccent, which 113 other surfaces share", () => {
    expect(button).toContain("return t.colors.onAccent")
  })
})

describe("destructive affordances read as danger, not as the brand accent", () => {
  it("colours a destructive menu item with the danger ink", () => {
    const menu = strip(read("../PopoverMenu.tsx"))
    expect(menu).toContain("th.colors.dangerInk")
    expect(menu).not.toContain('th.colors.bloom["600"]')
  })

  it("colours a destructive message context-menu action with the same danger ink", () => {
    const menu = strip(read("../MessageContextMenu.tsx"))
    expect(menu).toContain("action.destructive ? th.colors.dangerInk : th.colors.text")
    expect(menu).not.toContain('th.colors.bloom["600"]')
  })

  it("keeps a network error neutral instead of coral", () => {
    const notice = strip(read("../../bodies/FeedNotice.tsx"))
    expect(notice).toContain("color={t.colors.textMuted}")
    expect(notice).not.toMatch(/t\.colors\.brand\.bloom/)
  })
})

describe("selection is neutral", () => {
  it("fills a selected chip with the selection role, never the accent", () => {
    const chip = strip(read("../FilterChip.tsx"))
    expect(chip).toContain("backgroundColor: t.colors.selectedFill")
    expect(chip).toContain("color: t.colors.selectedInk")
    expect(chip).not.toMatch(/t\.colors\.(brand\.bloom|accent\b)/)
  })

  it("raises the selected segment with a surface and a shadow instead of a fill colour", () => {
    const segmented = strip(read("../SegmentedControl.tsx"))
    expect(segmented).toContain("backgroundColor: t.colors.surface")
    expect(segmented).toContain("t.shadows.s1")
    expect(segmented).not.toMatch(/t\.colors\.(brand\.bloom|accent\b)/)
  })

  it("lets a segmented picker go busy the way every other control does", () => {
    const segmented = strip(read("../SegmentedControl.tsx"))
    expect(segmented).toContain("disabled?: boolean")
    expect(segmented).toContain("disabled = false,")
    expect(segmented).toContain("disabled={disabled}")
    expect(segmented).toContain("accessibilityState={{ checked: on, disabled }}")
    expect(segmented).toContain("webCursor(disabled)")
    expect(segmented).toContain("!on && !disabled && webHover(state)")
    expect(segmented).toContain("!on && state.pressed && !disabled")
    expect(segmented).toContain("disabled ? styles.segmentTextDisabled : null")
    expect(segmented).toContain("segmentTextDisabled: {\n    color: t.colors.textSubtle,")
  })

  it("keeps the pickers that became segmented gated on their in-flight request", () => {
    const fields = strip(read("../../bodies/host/InviteIdentifierFields.tsx"))
    const control = fields.slice(fields.indexOf("<SegmentedControl"))
    expect(control.slice(0, control.indexOf("/>")), "the identifier picker lost its busy gate").toContain(
      "disabled={disabled}",
    )
    const sites = [
      "../../bodies/host/HostTeamInviteSheet.tsx",
      "../../bodies/host/dashboard/OrgInviteSheet.tsx",
    ]
    for (const rel of sites) {
      const src = strip(read(rel))
      const fieldsUse = src.slice(src.indexOf("<InviteIdentifierFields"))
      expect(fieldsUse.slice(0, fieldsUse.indexOf("/>")), `${rel} lost its busy gate`).toContain(
        "disabled={invite.isPending}",
      )
    }
  })
})

describe("the chart wears the chart tokens only", () => {
  it("paints the sparkline with chartInk / chartInkMuted and nothing else", () => {
    const spark = strip(read("../TrendSparkline.tsx"))
    expect(spark).toContain("t.colors.chartInk")
    expect(spark).toContain("t.colors.chartInkMuted")
    expect(spark).not.toMatch(/t\.colors\.(brand\.moss|moss\[)/)
  })

  it("runs the meter track on chartTrack and escalates to the warning ramp", () => {
    const meter = strip(read("../Meter.tsx"))
    expect(meter).toContain("backgroundColor: t.colors.chartTrack")
    expect(meter).toContain("backgroundColor: t.colors.chartInk")
    expect(meter).toContain('backgroundColor: t.colors.sun["600"]')
    expect(meter).toContain('accessibilityRole="progressbar"')
    expect(meter).toContain("accessibilityValue={{ min: 0, max, now: value }}")
  })

  it("gates the meter animation on the reduced-motion setting", () => {
    const meter = strip(read("../Meter.tsx"))
    expect(meter).toContain("useReducedMotion")
    expect(meter).toContain("if (reducedMotion)")
  })
})

describe("the phase dot is the only phase colour", () => {
  const header = strip(read("../../bodies/host/PhaseHeader.tsx"))

  it("maps every phase to a role token", () => {
    expect(header).toContain("t.colors.successInk")
    expect(header).toContain('t.colors.sky["500"]')
    expect(header).toContain("t.colors.dangerInk")
    expect(header).toContain("t.colors.textSubtle")
  })

  it("renders at most one primary button, and never a second coral fill", () => {
    expect((header.match(/<PrimaryButton/g) ?? []).length).toBe(1)
    expect(header).not.toMatch(/variant="(primary|destructive)"/)
  })

  it("holds the live pulse still under reduced motion", () => {
    expect(header).toContain("useReducedMotion")
    expect(header).toContain("reducedMotion !== false")
  })
})
