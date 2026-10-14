import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => {} }) }))

import LegalIndexPage from "./page"

describe("/legal redirect page", () => {
  it("keeps the no-JS link to the Terms reachable by screen readers", () => {
    const html = renderToStaticMarkup(<LegalIndexPage />)
    expect(html).toContain('href="/legal/terms/"')
    expect(html).not.toContain("aria-hidden")
  })
})
