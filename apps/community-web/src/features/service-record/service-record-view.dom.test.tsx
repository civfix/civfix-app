import * as React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})
vi.mock("@/components/detail-shell", () => ({
  DetailShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  api: {
    verifyServiceHoursCertificate: () => Promise.reject(new TypeError("Failed to fetch")),
  },
}))

const { ServiceRecordView } = await import("./service-record-view")

// The shape Next's app router leaves on its own history entries; __NA marks an entry it wrote itself.
const NEXT_ROUTER_STATE = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ["", {}] }

function nextRouterMarked(): boolean {
  return (window.history.state as { __NA?: unknown } | null)?.__NA !== undefined
}

afterEach(() => {
  cleanup()
})

describe("ServiceRecordView address bar", () => {
  it("writes a typed code's permalink as an unmarked entry so Next's router adopts it", async () => {
    window.history.replaceState(NEXT_ROUTER_STATE, "", "/service-record/")
    render(<ServiceRecordView />)

    fireEvent.change(screen.getByPlaceholderText("code_placeholder"), {
      target: { value: "CFX-A1B2-C3D4-E5F6" },
    })
    fireEvent.click(screen.getByRole("button", { name: "verify" }))

    expect(window.location.pathname).toBe("/service-record/A1B2C3D4E5F6/")
    expect(nextRouterMarked()).toBe(false)
    await screen.findByRole("button", { name: "try_again" })
  })

  it("clears the code from the address bar as an unmarked entry when the verifier starts over", async () => {
    window.history.replaceState(NEXT_ROUTER_STATE, "", "/service-record/CFX-A1B2-C3D4-E5F6/")
    render(<ServiceRecordView />)

    fireEvent.click(await screen.findByRole("button", { name: "try_again" }))

    expect(window.location.pathname).toBe("/service-record/")
    expect(nextRouterMarked()).toBe(false)
  })
})
