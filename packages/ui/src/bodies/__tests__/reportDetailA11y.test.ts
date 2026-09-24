import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const detail = read("../ReportDetailBody.tsx")
const dropPin = read("../DropPinBody.tsx")

function unannouncedViewLabels(src: string): string[] {
  const tags = src.match(/<View\b[^>]*?\baccessibilityLabel=[^>]*>/g) ?? []
  return tags.filter((tag) => !/\saccessible[\s>]/.test(tag))
}

describe("report detail accessibility", () => {
  it("exposes the pending-info toggle's expanded state like the full-message toggle", () => {
    const toggle = /accessibilityLabel=\{t\("timeline\.pending_a11y"\)\}[\s\S]*?\/>/.exec(detail)?.[0] ?? ""
    expect(toggle).toContain("accessibilityState={{ expanded: open }}")
  })

  it("never puts a label on a View assistive tech does not treat as one element", () => {
    expect(unannouncedViewLabels(detail)).toEqual([])
    expect(unannouncedViewLabels(dropPin)).toEqual([])
  })

  it("names the icon-only status thumb as an image", () => {
    expect(detail).toContain(
      '<View style={[styles.thumb, styles.thumbStatus]} accessible accessibilityRole="image" accessibilityLabel={label}>',
    )
  })
})
