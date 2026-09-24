import { describe, expect, it } from "vitest"
import { shareSnapshotOf } from "../submitFlowModel"

const draft = {
  title: "  Couch on the curb  ",
  category: "trash" as const,
  addr: "12 Main St",
  media: [
    { id: "m1", uri: "file:///first.jpg", kind: "image" as const, mime: "image/jpeg" },
    { id: "m2", uri: "file:///second.jpg", kind: "image" as const, mime: "image/jpeg" },
  ],
  feedCaption: "Blocking the ramp",
}

describe("shareSnapshotOf", () => {
  it("captures the trimmed title, category, address, first photo and caption", () => {
    expect(shareSnapshotOf(draft, "Untitled")).toEqual({
      title: "Couch on the curb",
      category: "trash",
      addr: "12 Main St",
      thumbUrl: "file:///first.jpg",
      caption: "Blocking the ramp",
    })
  })

  it("falls back to the untitled copy, a null category and no thumb", () => {
    expect(shareSnapshotOf({ ...draft, title: "   ", category: null, addr: null, media: [] }, "Untitled")).toEqual({
      title: "Untitled",
      category: null,
      addr: null,
      thumbUrl: null,
      caption: "Blocking the ramp",
    })
  })
})
