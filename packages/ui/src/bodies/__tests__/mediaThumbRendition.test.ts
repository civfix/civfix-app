import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), "utf8")

const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const SEAMS = {
  "MediaPreview.native.tsx": code(read("../../primitives/MediaPreview.native.tsx")),
  "MediaPreview.web.tsx": code(read("../../primitives/MediaPreview.web.tsx")),
}

describe("the MediaPreview seams decode the thumb rendition for images only", () => {
  for (const [name, source] of Object.entries(SEAMS)) {
    it(`${name} resolves its image source from thumbUri`, () => {
      expect(source).toMatch(/const source = kind === "image" && thumbUri \? thumbUri : uri/)
      expect(source).toMatch(/source=\{\{ uri: source \}\}/)
    })

    it(`${name} keys its error fallback on the source it rendered`, () => {
      expect(source).toMatch(/setFailedUri\(source\)/)
      expect(source).toMatch(/failedUri === source/)
    })

    it(`${name} still posters video from posterUri`, () => {
      expect(source).toMatch(/posterUri/)
    })
  }
})

describe("PostMediaGrid spends the thumb on split cells only", () => {
  const source = code(read("../PostMediaGrid.tsx"))

  it("passes the rendition through the shared rule", () => {
    expect(source).toMatch(/thumbUri=\{postMediaGridThumbUri\(item, split\)\}/)
    expect(source).toMatch(/return split \? media\.thumbUrl \?\? null : null/)
  })
})

describe("the lightbox keeps full resolution", () => {
  const source = code(read("../../lightbox/MediaLightboxBase.tsx"))

  it("hands MediaPreview no thumb rendition", () => {
    expect(source).toMatch(/uri=\{current\.url\}/)
    expect(source).not.toMatch(/thumbUri=/)
  })
})
