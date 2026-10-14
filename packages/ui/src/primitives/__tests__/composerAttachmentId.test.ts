/**
 * Keying attachments by local `uri` breaks when the same library asset is picked twice: duplicate React
 * keys, one upload's `uploadId` applied to both rows, and both copies dropped on a single remove.
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
