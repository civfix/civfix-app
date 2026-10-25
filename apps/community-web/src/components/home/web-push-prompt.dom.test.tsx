import * as React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PushPermissionCapability, PushPermissionStatus } from "@civfix/ui/capabilities"

vi.mock("react-native", async () => {
  // @ts-expect-error react-native-web ships no type declarations; webpack aliases it for the real build
  const rnw: unknown = await import("react-native-web")
  return rnw as Record<string, unknown>
})

vi.mock("lucide-react-native/icons", () => {
  const Glyph = () => null
  return new Proxy({}, { has: () => true, get: (_target, key) => (key === "then" ? undefined : Glyph) })
})

// The root barrel reaches the map and the shell; the prompt needs only its card.
vi.mock("@civfix/ui", async () => ({
  PushPromptCard: (await import("../../../../../packages/ui/src/promo/PushPromptCard")).PushPromptCard,
}))

const authState = { isAuthenticated: true }
vi.mock("@civfix/ui/data", () => ({ useAuthState: () => authState }))

const { CapabilitiesProvider, makeFakeCapabilities } = await import("@civfix/ui/capabilities")
const { I18nProvider } = await import("@civfix/ui/i18n")
const { WebPushPrompt } = await import("./web-push-prompt")

const SEEN_KEY = "civfix.pushPromptSeen"
const TITLE = "Get notified about your reports and events?"

function permission(status: PushPermissionStatus, answer: PushPermissionStatus = status) {
  const capability: PushPermissionCapability = {
    status: vi.fn(async () => status),
    request: vi.fn(async () => answer),
  }
  return capability
}

function mount(pushPermission: PushPermissionCapability) {
  const capabilities = { ...makeFakeCapabilities(), pushPermission }
  return render(
    <CapabilitiesProvider value={capabilities}>
      <I18nProvider locale="en" setLocale={() => undefined}>
        <WebPushPrompt />
      </I18nProvider>
    </CapabilitiesProvider>,
  )
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

/** Lets the capability's first status() read settle, so an absent card is absent for its real reason. */
async function settle(capability: PushPermissionCapability) {
  await waitFor(() => expect(capability.status).toHaveBeenCalled())
  await flush()
}

beforeEach(() => {
  window.localStorage.clear()
  authState.isAuthenticated = true
})

afterEach(() => {
  cleanup()
})

describe("WebPushPrompt", () => {
  it("T17: asks once, signed in, in a browser that was never asked", async () => {
    mount(permission("undetermined"))

    expect(await screen.findByText(TITLE)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Turn on" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Not now" })).toBeTruthy()
  })

  for (const answer of ["granted", "denied"] as const) {
    it(`T18: Turn on shows the browser prompt, and after a ${answer} answer the card never returns`, async () => {
      const capability = permission("undetermined", answer)
      const view = mount(capability)

      fireEvent.click(await screen.findByRole("button", { name: "Turn on" }))

      await waitFor(() => expect(screen.queryByText(TITLE)).toBeNull())
      expect(capability.request).toHaveBeenCalledTimes(1)
      expect(window.localStorage.getItem(SEEN_KEY)).toBe("1")

      view.unmount()
      mount(permission("undetermined"))
      await flush()
      expect(screen.queryByText(TITLE)).toBeNull()
    })
  }

  for (const control of ["Not now", "Close"] as const) {
    it(`T19: ${control} hides the card for good without asking the browser`, async () => {
      const capability = permission("undetermined")
      const view = mount(capability)

      fireEvent.click(await screen.findByRole("button", { name: control }))

      await waitFor(() => expect(screen.queryByText(TITLE)).toBeNull())
      expect(capability.request).not.toHaveBeenCalled()
      expect(window.localStorage.getItem(SEEN_KEY)).toBe("1")

      view.unmount()
      mount(permission("undetermined"))
      await flush()
      expect(screen.queryByText(TITLE)).toBeNull()
    })
  }

  for (const status of ["granted", "denied", "unsupported"] as const) {
    it(`T20: no card when the permission is ${status}`, async () => {
      const capability = permission(status)
      mount(capability)
      await settle(capability)
      expect(screen.queryByText(TITLE)).toBeNull()
    })
  }

  it("T20: no card when signed out", async () => {
    authState.isAuthenticated = false
    const capability = permission("undetermined")
    mount(capability)
    await flush()
    expect(screen.queryByText(TITLE)).toBeNull()
  })

  it("T20: no card once this browser has seen it", async () => {
    window.localStorage.setItem(SEEN_KEY, "1")
    const capability = permission("undetermined")
    mount(capability)
    await flush()
    expect(screen.queryByText(TITLE)).toBeNull()
  })
})
