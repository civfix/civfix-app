import { describe, expect, it, vi, afterEach } from "vitest"

import { downloadBlob } from "./download-blob"

URL.createObjectURL = URL.createObjectURL ?? (() => "blob:stub")
URL.revokeObjectURL = URL.revokeObjectURL ?? (() => {})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe("downloadBlob", () => {
  it("clicks a named anchor and cleans it out of the document", () => {
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:x")
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
    const clicks: HTMLAnchorElement[] = []
    const realClick = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
      clicks.push(this)
    }

    downloadBlob("civfix.ics", new Blob(["BEGIN:VCALENDAR"]))

    expect(create).toHaveBeenCalledTimes(1)
    expect(clicks).toHaveLength(1)
    expect(clicks[0]?.getAttribute("download")).toBe("civfix.ics")
    expect(clicks[0]?.getAttribute("href")).toBe("blob:x")
    expect(document.querySelector("a[download]")).toBeNull()
    HTMLAnchorElement.prototype.click = realClick
  })

  it("never revokes the object URL in the same task as the click - Safari cancels the download when it does", () => {
    vi.useFakeTimers()
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:x")
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
    const realClick = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = () => {}

    downloadBlob("civfix.ics", new Blob(["BEGIN:VCALENDAR"]))
    expect(revoke).not.toHaveBeenCalled()

    vi.runAllTimers()
    expect(revoke).toHaveBeenCalledWith("blob:x")
    HTMLAnchorElement.prototype.click = realClick
  })
})
