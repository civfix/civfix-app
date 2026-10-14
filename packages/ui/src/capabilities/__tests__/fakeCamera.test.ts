import { describe, expect, it } from "vitest"
import { FakeCamera } from "../fakes"

describe("the fake camera ships in the web export's dev galleries", () => {
  it("captures inline bytes, never a third-party URL", async () => {
    const media = await new FakeCamera().capture()
    expect(media?.uri.startsWith("data:image/")).toBe(true)
  })

  it("never simulates a device GPS fix", async () => {
    const media = await new FakeCamera().capture()
    expect(media?.location).toBeUndefined()
  })
})
