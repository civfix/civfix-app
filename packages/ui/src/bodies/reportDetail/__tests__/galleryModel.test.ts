import { describe, expect, it } from "vitest"
import type { ReportDTO } from "@civfix/shared"
import { partitionGalleryMedia } from "../galleryModel"

type Media = ReportDTO["media"][number]
const media = (id: string, status: Media["status"], kind: Media["kind"] = "image"): Media =>
  ({ id, status, kind, url: `https://x/${id}` }) as Media

describe("partitionGalleryMedia", () => {
  it("splits ready, processing and failed media and counts a tile for every unlisted pending upload", () => {
    const tiles = partitionGalleryMedia(
      [media("a", "ready"), media("b", "validating"), media("c", "rejected"), media("d", "held"), media("e", "ready")],
      2,
    )
    expect(tiles.ready.map((m) => m.id)).toEqual(["a", "e"])
    expect(tiles.ownerPending.map((m) => m.id)).toEqual(["b"])
    expect(tiles.ownerFailed.map((m) => m.id)).toEqual(["c", "d"])
    expect(tiles.tileCount).toBe(7)
  })
})
