/**
 * Locale regression coverage for two strings that were shipped as byte-copies of the English source.
 *
 * 1. `event-card` linked.a11y_card interpolates an Intl SHORT MONTH NAME and a numeric day. The English
 *    order is month-then-day; German and Spanish say the day first ("12. JULI", "12 JUL"), so a copied
 *    English template made screen readers announce "JULI 12." Reordering placeholders is exactly what
 *    per-language catalogs exist for. (Korean's "{{month}} {{day}}" is already correct - its month is
 *    "7월".)
 * 2. `map-ui` layers.clearAll / clearAllA11y label a control that DESELECTS the report-category filters.
 *    The Spanish copy said "Borrar" (delete/erase), which reads as a destructive action on a filter
 *    panel; German ("abwählen") and Korean ("해제") correctly say deselect.
 */
import { describe, expect, it } from "vitest"
import enCard from "../../i18n/locales/en/event-card.json"
import esCard from "../../i18n/locales/es/event-card.json"
import deCard from "../../i18n/locales/de/event-card.json"
import koCard from "../../i18n/locales/ko/event-card.json"
import esMap from "../../i18n/locales/es/map-ui.json"
import deMap from "../../i18n/locales/de/map-ui.json"
import koMap from "../../i18n/locales/ko/map-ui.json"

const CARDS: Record<string, { linked: { a11y_card: string; a11y_card_compact: string } }> = {
  en: enCard,
  es: esCard,
  de: deCard,
  ko: koCard,
}

describe("linked event card a11y label", () => {
  it("keeps both date placeholders in every locale", () => {
    for (const [locale, catalog] of Object.entries(CARDS)) {
      const template = catalog.linked.a11y_card
      expect(template, locale).toContain("{{day}}")
      expect(template, locale).toContain("{{month}}")
      for (const slot of ["{{title}}", "{{schedule}}", "{{location}}", "{{going}}"]) {
        expect(template, `${locale} ${slot}`).toContain(slot)
      }
    }
  })

  it("announces the day BEFORE the month in de and es", () => {
    for (const locale of ["de", "es"] as const) {
      const template = CARDS[locale]!.linked.a11y_card
      expect(template.indexOf("{{day}}"), locale).toBeLessThan(template.indexOf("{{month}}"))
    }
  })

  it("keeps the month-first order English and Korean actually want", () => {
    for (const locale of ["en", "ko"] as const) {
      const template = CARDS[locale]!.linked.a11y_card
      expect(template.indexOf("{{month}}"), locale).toBeLessThan(template.indexOf("{{day}}"))
    }
  })

  it("keeps a compact, attendance-free variant with the same date order in every locale", () => {
    for (const [locale, catalog] of Object.entries(CARDS)) {
      const compact = catalog.linked.a11y_card_compact
      expect(compact, locale).not.toContain("{{going}}")
      for (const slot of ["{{month}}", "{{day}}", "{{title}}", "{{schedule}}", "{{location}}"]) {
        expect(compact, `${locale} ${slot}`).toContain(slot)
      }
      const full = catalog.linked.a11y_card
      expect(
        compact.indexOf("{{day}}") < compact.indexOf("{{month}}"),
        `${locale} compact date order must match a11y_card`,
      ).toBe(full.indexOf("{{day}}") < full.indexOf("{{month}}"))
      expect(compact, locale).not.toContain("{{month}}.")
    }
  })

  it("does not double-punctuate after a month abbreviation that carries its own period", () => {
    // Full-ICU runtimes render de/es short months as "Jan." / "sept.", so a "{{month}}." template would
    // read "12. JAN.."; the de/es catalogs separate the date from the title with a comma instead.
    for (const [locale, catalog] of Object.entries(CARDS)) {
      expect(catalog.linked.a11y_card, locale).not.toContain("{{month}}.")
    }
  })
})

describe("map layers clear-all copy", () => {
  it("says DESELECT, never delete, in every non-English locale", () => {
    // "borrar" / "eliminar" (es), "löschen" (de), "삭제" (ko) all mean delete - the control only clears
    // the category selection.
    const destructive = /borrar|elimina|löschen|삭제/i
    for (const [locale, catalog] of Object.entries({ es: esMap, de: deMap, ko: koMap })) {
      const layers = catalog.layers as Record<string, string>
      expect(layers.clearAll, `${locale} clearAll`).not.toMatch(destructive)
      expect(layers.clearAllA11y, `${locale} clearAllA11y`).not.toMatch(destructive)
    }
  })
})
