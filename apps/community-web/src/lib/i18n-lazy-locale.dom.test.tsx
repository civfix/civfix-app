/**
 * The web bundles only English; every other locale arrives as a chunk. These render the real shared
 * provider with the real catalogs to pin what a German or Spanish visitor sees while one is in flight.
 */
import { describe, expect, it } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { I18nProvider, useLocale, useT, type SupportedLocale } from "@civfix/ui/i18n"

// The first import of a locale transforms its ~100 JSON catalogs, which takes seconds on a loaded runner.
const CATALOG_ARRIVAL = { timeout: 15_000 }
const TEST_TIMEOUT = 30_000

function Probe({ seen }: { seen: string[] }) {
  const { t } = useT("common")
  const { locale } = useLocale()
  const text = `${locale}:${t("save")}`
  seen.push(text)
  return <p data-testid="probe">{text}</p>
}

function renderAt(locale: SupportedLocale, seen: string[]) {
  return render(
    <I18nProvider locale={locale}>
      <Probe seen={seen} />
    </I18nProvider>,
  )
}

describe("a non-English locale on web", () => {
  it("renders English until the German catalog arrives, then German, and never a raw key", async () => {
    const seen: string[] = []
    renderAt("de", seen)
    expect(screen.getByTestId("probe").textContent).toBe("en:Save")

    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("de:Speichern"), CATALOG_ARRIVAL)
    expect(new Set(seen)).toEqual(new Set(["en:Save", "de:Speichern"]))
  }, TEST_TIMEOUT)

  it("keeps the current language while the next one loads, then switches", async () => {
    const seen: string[] = []
    const view = renderAt("de", seen)
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("de:Speichern"), CATALOG_ARRIVAL)

    const afterGerman = seen.length
    view.rerender(
      <I18nProvider locale="es">
        <Probe seen={seen} />
      </I18nProvider>,
    )
    expect(screen.getByTestId("probe").textContent).toBe("de:Speichern")
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("es:Guardar"), CATALOG_ARRIVAL)
    expect(new Set(seen.slice(afterGerman))).toEqual(new Set(["de:Speichern", "es:Guardar"]))
  }, TEST_TIMEOUT)
})
