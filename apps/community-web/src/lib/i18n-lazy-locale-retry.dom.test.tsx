/**
 * A locale chunk that fails (offline, or a deploy replaced the hashed file) must leave the page in English
 * without throwing, and choosing the language again must refetch it.
 */
import { describe, expect, it, vi } from "vitest"
import { act, render, screen, waitFor } from "@testing-library/react"
import { I18nProvider, useLocale, useT } from "@civfix/ui/i18n"

const germanAttempts = vi.hoisted(() => ({ count: 0 }))

vi.mock("../../../../packages/ui/src/i18n/catalogs/lazy", async () => {
  const german = await vi.importActual<{ default: Record<string, unknown> }>(
    "../../../../packages/ui/src/i18n/catalogs/de",
  )
  const fail = () => Promise.reject(new Error("ChunkLoadError"))
  return {
    lazyCatalogs: {
      de: () => {
        germanAttempts.count += 1
        return germanAttempts.count === 1 ? fail() : Promise.resolve(german)
      },
      es: fail,
      ko: fail,
    },
  }
})

let chooseLocale: (code: "de") => void = () => {}

function Probe() {
  const { t } = useT("common")
  const { locale, setLocale } = useLocale()
  chooseLocale = setLocale
  return <p data-testid="probe">{`${locale}:${t("save")}`}</p>
}

describe("a German chunk that fails to load", () => {
  it("keeps English, then loads German when German is chosen again", async () => {
    const setLocale = vi.fn()
    render(
      <I18nProvider locale="de" setLocale={setLocale}>
        <Probe />
      </I18nProvider>,
    )
    await waitFor(() => expect(germanAttempts.count).toBe(1))
    await act(async () => {})
    expect(screen.getByTestId("probe").textContent).toBe("en:Save")

    act(() => chooseLocale("de"))
    expect(setLocale).toHaveBeenCalledWith("de")
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("de:Speichern"))
    expect(germanAttempts.count).toBe(2)
  })
})
