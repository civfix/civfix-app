import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), "utf8")

const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const SEAMS = {
  "MediaPreview.native.tsx": code(read("../../primitives/MediaPreview.native.tsx")),
  "MediaPreview.web.tsx": code(read("../../primitives/MediaPreview.web.tsx")),
}
const SHARED = code(read("../../primitives/MediaPreview.shared.tsx"))

describe("the MediaPreview seams decode the thumb rendition for images only", () => {
  it("the shared seam hook resolves the image source from thumbUri and keys the fallback on it", () => {
    expect(SHARED).toMatch(/const source = kind === "image" && thumbUri \? thumbUri : uri/)
    expect(SHARED).toMatch(/setFailedUri\(source\)/)
    expect(SHARED).toMatch(/failed: failedUri === source/)
  })

  for (const [name, source] of Object.entries(SEAMS)) {
    it(`${name} resolves its image source from thumbUri`, () => {
      expect(source).toMatch(/const \{ label, source, failed, onError \} = useMediaPreviewSource\(\{ kind, uri, thumbUri, alt \}\)/)
      expect(source).toMatch(/source=\{\{ uri: source \}\}/)
    })

    it(`${name} keys its error fallback on the source it rendered`, () => {
      expect(source).toMatch(/if \(failed\) return <MediaPreviewFallback/)
      expect(source.match(/onError=\{onError\}|\bonError,/g)).toHaveLength(2)
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
      expect(source).toContain('import { usePostRowActions } from "../postCardActions"')
      expect(source).toMatch(/\bmedia, openMedia \}\s*=\s*usePostRowActions\(/)
    })
  }

  it("builds the lightbox items once per media array in the shared row and lightbox hooks", () => {
    const actions = code(read("../postCardActions.ts"))
    expect(actions).toContain("const media = post.media ?? EMPTY_MEDIA")
    expect(actions).toContain("const openMedia = usePostMediaLightbox(media)")
    const hook = code(read("../../lightbox/usePostMediaLightbox.ts"))
    expect(hook).toContain("const lightbox = useLightbox()")
    expect(hook).toContain("if (items.length > 0) lightbox.open(items, index)")
    expect(hook).toContain("[lightbox, media]")
  })
})

describe("the lightbox keeps full resolution", () => {
  const source = code(read("../../lightbox/MediaLightboxBase.tsx"))

  it("hands MediaPreview no thumb rendition", () => {
    expect(source).toMatch(/uri=\{current\.url\}/)
    expect(source).not.toMatch(/thumbUri=/)
  })
})
