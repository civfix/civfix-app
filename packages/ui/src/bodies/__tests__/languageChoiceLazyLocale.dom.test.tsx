/**
 * While a locale's chunk is in flight, or after it failed, the page still shows the previous language,
 * and the language settings must still let the visitor pick that language.
 */
import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type * as ReactNative from "react-native"
import type { SupportedLocale } from "@civfix/contract"
import { I18nProvider, useLocale, useT } from "../../i18n"
import { LanguageSettingsBody } from "../LanguageSettingsBody"

// The icon set pulls in native-only modules; the rows only need text to be pressed by name.
vi.mock("../../typography", async () => {
  const { Text } = await vi.importActual<typeof ReactNative>("react-native")
  return { Text, Icon: () => null, iconMap: {} }
})

const spanish = vi.hoisted(() => ({ release: (_: unknown) => {} }))

vi.mock("../../i18n/catalogs/lazy", async () => {
  const es = await vi.importActual<{ default: Record<string, unknown> }>(
    "../../i18n/catalogs/es",
  )
  return {
    lazyCatalogs: {
      es: () =>
        new Promise((resolve) => {
          spanish.release = () => resolve(es)
        }),
      de: () => Promise.reject(new Error("ChunkLoadError")),
      ko: () => Promise.reject(new Error("ChunkLoadError")),
    },
  }
})

function Probe() {
  const { t } = useT("common")
  const { locale } = useLocale()
  return <p data-testid="probe">{`${locale}:${t("save")}`}</p>
}

function Host({ initial, onChoose }: { initial: SupportedLocale; onChoose: (code: SupportedLocale) => void }) {
  const [locale, setLocale] = React.useState(initial)
  const choose = React.useCallback(
    (code: SupportedLocale) => {
      onChoose(code)
      setLocale(code)
    },
    [onChoose],
  )
  return (
    <I18nProvider locale={locale} setLocale={choose}>
      <Probe />
      <LanguageSettingsBody />
    </I18nProvider>
  )
}

describe("choosing a language while another one's catalog is missing", () => {
  it("goes back to English while the Spanish chunk is still loading, and stays there once it lands", async () => {
    const onChoose = vi.fn()
    render(<Host initial="es" onChoose={onChoose} />)
    expect(screen.getByTestId("probe").textContent).toBe("en:Save")

    fireEvent.click(screen.getByText("English"))
    expect(onChoose).toHaveBeenCalledWith("en")

    await act(async () => spanish.release(undefined))
    expect(screen.getByTestId("probe").textContent).toBe("en:Save")
  })

  it("goes back to English after the German chunk failed", async () => {
    const onChoose = vi.fn()
    render(<Host initial="de" onChoose={onChoose} />)
    await act(async () => {})
    expect(screen.getByTestId("probe").textContent).toBe("en:Save")

    fireEvent.click(screen.getByText("English"))
    expect(onChoose).toHaveBeenCalledWith("en")
  })

  it("does nothing for the language already chosen and shown", async () => {
    const onChoose = vi.fn()
    render(<Host initial="en" onChoose={onChoose} />)
    fireEvent.click(screen.getByText("English"))
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("en:Save"))
    expect(onChoose).not.toHaveBeenCalled()
  })
})
