import { describe, expect, it } from "vitest"
import { composerAttachRows } from "../composerAttachRows"

describe("composerAttachRows", () => {
  it("native, poll-capable: photo, camera, poll", () => {
    expect(composerAttachRows({ isWeb: false, canCreatePoll: true })).toEqual(["photo", "camera", "poll"])
  })

  it("hides the poll row when the room cannot create polls (dm / channel read-only)", () => {
    expect(composerAttachRows({ isWeb: false, canCreatePoll: false })).toEqual(["photo", "camera"])
  })

  it("hides the camera row on web", () => {
    expect(composerAttachRows({ isWeb: true, canCreatePoll: true })).toEqual(["photo", "poll"])
    expect(composerAttachRows({ isWeb: true, canCreatePoll: false })).toEqual(["photo"])
  })

  it("photo is always present", () => {
    expect(composerAttachRows({ isWeb: true, canCreatePoll: false })).toContain("photo")
    expect(composerAttachRows({ isWeb: false, canCreatePoll: false })).toContain("photo")
  })
})
