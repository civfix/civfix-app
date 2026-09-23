/**
 * APP-BUG-162 for events: the event form's pickers showed the loading placeholder forever when the host's
 * centre resolution settled with nothing (location refused, no approximate point, backend off). The form
 * now carries the host's settled flag to both pickers, as the report flow does. The pickers import
 * react-native / maplibre, so the wiring is pinned by source.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const form = readFileSync(new URL("../CleanupForm.tsx", import.meta.url), "utf8")

function slice(start: string, end: string): string {
  const from = form.indexOf(start)
  expect(from).toBeGreaterThan(-1)
  const to = form.indexOf(end, from)
  expect(to).toBeGreaterThan(from)
  return form.slice(from, to)
}

describe("the event form's pickers learn when the centre resolution settled with nothing", () => {
  it("accepts the flag from its host", () => {
    const props = slice("export function CleanupForm({", "}) {")
    expect(props).toContain("centerSettled,")
    expect(props).toContain("centerSettled?: boolean")
  })

  it("passes it to the inline LocationPicker", () => {
    const pickers = form.split("\n").filter((line) => line.includes("<LocationPicker "))
    expect(pickers).toHaveLength(1)
    expect(pickers[0]).toContain("centerSettled={centerSettled}")
  })

  it("passes it through the compact field to the portrait pick step", () => {
    const compact = slice("function MeetLocationCompact({", "\n}\n")
    expect(compact).toMatch(/<PortraitMapPickStep[\s\S]*?centerSettled=\{centerSettled\}/)
    expect(form).toMatch(/<MeetLocationCompact[\s\S]*?centerSettled=\{centerSettled\}[\s\S]*?\/>/)
  })
})
