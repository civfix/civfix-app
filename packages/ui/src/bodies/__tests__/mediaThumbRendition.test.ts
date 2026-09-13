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

describe("the thread surfaces open their photos in the lightbox", () => {
  for (const rel of ["../thread/ThreadFocalPost.tsx", "../thread/ThreadReplyRow.tsx"]) {
    const source = code(read(rel))

    it(`${rel} hands every media grid an onPressItem`, () => {
      const grids = source.match(/<PostMediaGrid[^>]*\/>/g) ?? []
      expect(grids.length).toBeGreaterThan(0)
      for (const grid of grids) expect(grid, rel).toContain("onPressItem={openMedia}")
    })

    it(`${rel} builds the lightbox items once per media array`, () => {
      expect(source).toContain('import { useLightbox } from "../../lightbox"')
      expect(source).toContain("const lightbox = useLightbox()")
      expect(source).toContain("if (items.length > 0) lightbox.open(items, index)")
      expect(source).toContain("[lightbox, media]")
      expect(source).toContain("const media = post.media ?? EMPTY_MEDIA")
    })
  }
})

describe("the lightbox keeps full resolution", () => {
  const source = code(read("../../lightbox/MediaLightboxBase.tsx"))

  it("hands MediaPreview no thumb rendition", () => {
    expect(source).toMatch(/uri=\{current\.url\}/)
    expect(source).not.toMatch(/thumbUri=/)
  })
})
