import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import type * as ReactNative from "react-native"
import { CapabilitiesProvider, makeFakeCapabilities } from "../../capabilities"
import { I18nProvider } from "../../i18n"
import { LegalDocumentView } from "../LegalDocumentView"
import { readableLegalDocument, setLegalDocumentPresenter } from "../legalDocument"
import { legalDoc } from "./legalDocumentFixtures"

vi.mock("../../typography", async () => {
  const RN = await vi.importActual<typeof ReactNative>("react-native")
  return { Text: RN.Text, Icon: () => null, iconMap: new Proxy({}, { get: () => "icon" }) }
})

// The app's bundle resolves the .native file; this one runs the view as the phone app does.
vi.mock("../legalDocumentNav", () => import("../legalDocumentNav.native"))

const open = vi.fn(async (_url: string) => {})
const present = vi.fn()

function showLink(href: string) {
  const document = readableLegalDocument(
    legalDoc("terms", "2026-10-30", { blocks: [{ kind: "paragraph", text: `See [the link](${href}).` }] }),
  )
  if (document === null) throw new Error("fixture is not readable")
  const capabilities = { ...makeFakeCapabilities(), openExternal: { open } }
  render(
    <CapabilitiesProvider value={capabilities}>
      <I18nProvider locale="en">
        <LegalDocumentView document={document} current />
      </I18nProvider>
    </CapabilitiesProvider>,
  )
  fireEvent.click(screen.getByRole("link", { name: "the link" }))
}

beforeEach(() => {
  open.mockClear()
  present.mockClear()
  setLegalDocumentPresenter(present)
})

afterEach(() => {
  setLegalDocumentPresenter(null)
})

describe("LegalDocumentView in the phone app", () => {
  it.each(["https://civfix.org/legal/privacy", "https://civfix.org/legal/privacy/"])(
    "T13: %s opens the in-app legal screen for privacy",
    (href) => {
      showLink(href)
      expect(present).toHaveBeenCalledWith("privacy")
      expect(open).not.toHaveBeenCalled()
    },
  )

  it.each(["https://civfix.org/legal/unknown", "https://civfix.org/about", "https://example.org/legal/terms"])(
    "T14: %s opens in the browser",
    (href) => {
      showLink(href)
      expect(open).toHaveBeenCalledWith(href)
      expect(present).not.toHaveBeenCalled()
    },
  )
})
