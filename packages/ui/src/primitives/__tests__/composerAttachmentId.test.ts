/**
 * Regression coverage for attachment identity: the composer used to key every pending attachment by its
 * local `uri`, so picking the SAME library asset twice produced duplicate React keys, applied one
 * upload's `uploadId` to both rows, and dropped both copies on a single remove.
 */
import { describe, expect, it } from "vitest"
import { nextAttachmentId } from "../composerAttachmentId"

describe("nextAttachmentId", () => {
  it("hands two picks of the same asset two different ids", () => {
    const first = nextAttachmentId()
    const second = nextAttachmentId()

    expect(first).not.toBe(second)
  })

  it("stays unique across a long run of picks", () => {
    const ids = Array.from({ length: 200 }, () => nextAttachmentId())

    expect(new Set(ids).size).toBe(ids.length)
  })
})
