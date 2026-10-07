import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { EMPTY_VALUE } from "../../../i18n/emptyValue"
import { byEventRowA11y } from "../analyticsModel"

const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

function catalog(ns: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(new URL(`../../../i18n/locales/en/${ns}.json`, import.meta.url), "utf8"),
  ) as Record<string, unknown>
}

const en = { "host-analytics": catalog("host-analytics") }

function lookup(tree: Record<string, unknown>, path: string): string {
  const found = path.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], tree)
  if (typeof found !== "string") throw new Error(`missing en key ${path}`)
  return found
}

const t = (key: string, options: Record<string, unknown> = {}): string => {
  const [ns, path] = key.includes(":") ? key.split(":") : ["host-analytics", key]
  const template = lookup(en[ns as keyof typeof en], path as string)
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name]))
}

describe("the by-event row's spoken label", () => {
  it("speaks the sign-up count when it is known", () => {
    expect(byEventRowA11y(t, "Creek Sweep", 12)).toBe(
      "Creek Sweep, 12 sign-ups. Open this event's analytics.",
    )
  })

  it("speaks the unknown word instead of the visible empty mark when the count is suppressed", () => {
    const label = byEventRowA11y(t, "Creek Sweep", null)
    expect(label).toBe("Creek Sweep, sign-ups not available. Open this event's analytics.")
    expect(label).not.toContain(`, ${EMPTY_VALUE} `)
  })

  it("is the label EventAnalyticsBody gives each row", () => {
    const body = code(readFileSync(new URL("../analytics/AllEventsMode.tsx", import.meta.url), "utf8"))
    expect(body).toContain("accessibilityLabel={byEventRowA11y(t, row.label, value)}")
    expect(body).not.toMatch(/by_event_a11y[\s\S]{0,120}EMPTY_VALUE/)
  })
})
