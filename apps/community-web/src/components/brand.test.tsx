import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

import { Wordmark } from "./brand"

describe("Wordmark", () => {
  it("exposes its label through an image role (aria-label is ignored on a generic span)", () => {
    const html = renderToStaticMarkup(<Wordmark />)
    expect(html).toMatch(/^<span[^>]*role="img"[^>]*aria-label="civfix"/)
  })
})
