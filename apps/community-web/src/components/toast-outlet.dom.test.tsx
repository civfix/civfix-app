import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("react-native", async () => {
  // @ts-expect-error react-native-web ships no type declarations; webpack aliases it for the real build
  const rnw: unknown = await import("react-native-web")
  return rnw as Record<string, unknown>
})

// Both ship untranspiled sources the jsdom project cannot load; the toast reads neither for what is tested.
vi.mock("react-native-safe-area-context", async () => {
  const { createContext } = await import("react")
  return { SafeAreaInsetsContext: createContext(null) }
})

vi.mock("lucide-react-native/icons", () => {
  const Glyph = () => null
  return new Proxy({}, { has: () => true, get: (_target, key) => (key === "then" ? undefined : Glyph) })
})

import { I18nProvider } from "../../../../packages/ui/src/i18n"
import { ModalCardSheet } from "../../../../packages/ui/src/primitives/ModalCardSheet"
import { ToastProvider, useToast, type ToastApi } from "../../../../packages/ui/src/primitives/Toast"

const MESSAGE = "Couldn't send to Ana_with_a_very_long_name_without_any_spaces"

const toastRef: { current: ToastApi | null } = { current: null }

function Harness({ sheetOpen }: { sheetOpen: boolean }) {
  const toast = useToast()
  React.useEffect(() => {
    toastRef.current = toast
  })
  return (
    <ModalCardSheet
      visible={sheetOpen}
      onClose={() => {}}
      headerIcon="Share"
      title="Share post"
      dismissLabel="Close"
      actions={null}
    >
      <></>
    </ModalCardSheet>
  )
}

function tree(sheetOpen: boolean) {
  return (
    <I18nProvider locale="en">
      <ToastProvider>
        <Harness sheetOpen={sheetOpen} />
      </ToastProvider>
    </I18nProvider>
  )
}

function mount(sheetOpen: boolean) {
  return render(tree(sheetOpen))
}

function showRetryToast(retry: () => void): void {
  act(() => {
    toastRef.current!.show(MESSAGE, { variant: "error", action: { label: "Try again", onPress: retry } })
  })
}

function dialog(): HTMLElement {
  return screen.getByRole("dialog")
}

afterEach(() => {
  cleanup()
  toastRef.current = null
})

describe("a toast shown while a sheet is open", () => {
  it("paints inside the open sheet's modal, once, where one tap reaches its action", () => {
    mount(true)
    const retry = vi.fn()
    showRetryToast(retry)

    const messages = screen.getAllByText(MESSAGE)
    expect(messages).toHaveLength(1)
    expect(dialog().contains(messages[0]!)).toBe(true)
    expect(screen.getAllByRole("alert")).toHaveLength(1)

    fireEvent.click(screen.getByText("Try again"))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it("paints in the root host when no sheet is open", () => {
    mount(false)
    showRetryToast(() => {})

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getAllByText(MESSAGE)).toHaveLength(1)
    expect(screen.getAllByRole("alert")).toHaveLength(1)
  })

  it("moves to the root host when the sheet closes, without announcing a second time", () => {
    const view = mount(true)
    showRetryToast(() => {})
    expect(dialog().contains(screen.getByText(MESSAGE))).toBe(true)

    view.rerender(tree(false))

    const messages = screen.getAllByText(MESSAGE)
    expect(messages).toHaveLength(1)
    expect(screen.queryByRole("dialog")?.contains(messages[0]!) ?? false).toBe(false)
    expect(screen.queryAllByRole("alert")).toHaveLength(0)
  })

  it("moves into a sheet opened over it, still painted once", () => {
    const view = mount(false)
    showRetryToast(() => {})

    view.rerender(tree(true))

    const messages = screen.getAllByText(MESSAGE)
    expect(messages).toHaveLength(1)
    expect(dialog().contains(messages[0]!)).toBe(true)
  })
})
