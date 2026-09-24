import { afterEach, describe, expect, it, vi } from "vitest"

import { PICKER_FOCUS_CANCEL_GRACE_MS, webCamera } from "@/lib/web-camera"

function pickerInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error("no picker input")
  return input
}

afterEach(() => {
  vi.useRealTimers()
})

describe("webCamera picker settling", () => {
  it("settles with null when focus returns with no file and no cancel event (older engines)", async () => {
    vi.useFakeTimers()
    const picked = webCamera.pickFromLibrary()
    window.dispatchEvent(new Event("focus"))
    await vi.advanceTimersByTimeAsync(PICKER_FOCUS_CANCEL_GRACE_MS)
    await expect(picked).resolves.toBeNull()
    expect(document.querySelector('input[type="file"]')).toBeNull()
  })

  it("settles with null at once on the cancel event", async () => {
    const picked = webCamera.pickFromLibrary()
    pickerInput().dispatchEvent(new Event("cancel"))
    await expect(picked).resolves.toBeNull()
  })

  it("still takes a file whose change event lands shortly after focus returns", async () => {
    vi.useFakeTimers()
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:photo" }))
    const picked = webCamera.pickFromLibrary()
    const input = pickerInput()
    window.dispatchEvent(new Event("focus"))
    await vi.advanceTimersByTimeAsync(PICKER_FOCUS_CANCEL_GRACE_MS - 1)
    const file = new File(["x"], "clip.mp4", { type: "video/mp4" })
    Object.defineProperty(input, "files", { configurable: true, value: [file] })
    input.dispatchEvent(new Event("change"))
    await expect(picked).resolves.toMatchObject({ uri: "blob:photo", kind: "video" })
    vi.unstubAllGlobals()
  })
})
