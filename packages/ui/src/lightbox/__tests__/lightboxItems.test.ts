import { describe, expect, it } from "vitest"
import { toLightboxItems } from "../lightboxItems"

describe("toLightboxItems", () => {
  it("keeps the full-resolution url and passes the thumb and real dimensions on", () => {
    expect(
      toLightboxItems([
        { url: "https://cdn/a.jpg", kind: "image", thumbUrl: "https://cdn/a-400.jpg", width: 1200, height: 800 },
      ]),
    ).toEqual([
      { url: "https://cdn/a.jpg", kind: "image", thumbUrl: "https://cdn/a-400.jpg", width: 1200, height: 800 },
    ])
  })

  it("nulls every missing optional so the lightbox never reads undefined", () => {
    expect(toLightboxItems([{ url: "https://cdn/v.mp4", kind: "video" }])).toEqual([
      { url: "https://cdn/v.mp4", kind: "video", thumbUrl: null, width: null, height: null },
    ])
  })

  it("keeps the order, so the tapped index opens the tapped item", () => {
    const items = toLightboxItems([
      { url: "1", kind: "image" },
      { url: "2", kind: "video" },
    ])
    expect(items.map((item) => item.url)).toEqual(["1", "2"])
  })
})
