import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const replace = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }))

const { default: LegalIndexPage } = await import("./page")

describe("/legal", () => {
  it("T29: still goes to the Terms, whose page lists all four documents", () => {
    render(<LegalIndexPage />)
    expect(replace).toHaveBeenCalledWith("/legal/terms")
  })
})
