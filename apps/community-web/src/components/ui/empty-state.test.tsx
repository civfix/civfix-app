import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

import { EmptyState } from "./empty-state"

describe("EmptyState heading level", () => {
  it("never renders its title as a skipped-level h4 by default", () => {
    const html = renderToStaticMarkup(<EmptyState title="Nothing here" />)
    expect(html).toMatch(/<h2[^>]*>Nothing here<\/h2>/)
  })

  it("renders the page-level h1 when the empty state is the whole page", () => {
    const html = renderToStaticMarkup(<EmptyState title="Link expired" titleAs="h1" />)
    expect(html).toMatch(/<h1[^>]*>Link expired<\/h1>/)
  })
})
