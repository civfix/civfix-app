import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const LOCALES = new URL("../../../../../../packages/ui/src/i18n/locales/", import.meta.url)

const BILLING: Record<string, RegExp> = {
  en: /billing/i,
  es: /factura/i,
  de: /abrechnung/i,
  ko: /결제/,
}

function subtitle(locale: string): string {
  const catalog = JSON.parse(readFileSync(new URL(`${locale}/host-org.json`, LOCALES), "utf8")) as {
    members: { subtitle: string }
  }
  return catalog.members.subtitle
}

describe("the members roles line promises only what the console does", () => {
  it.each(Object.keys(BILLING))("%s does not mention billing, which the console has none of", (locale) => {
    expect(subtitle(locale)).not.toMatch(BILLING[locale]!)
  })

  it("keeps the in-code fallback in step with the English catalog", () => {
    const source = readFileSync(new URL("./members-screen.tsx", import.meta.url), "utf8")
    expect(source).not.toMatch(/billing/i)
    expect(source).toContain(JSON.stringify(subtitle("en")))
  })
})
