import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import { eventIcsUid } from "@civfix/shared/ics"
import * as web from "../../primitives/calendarFile.web"
import * as native from "../../primitives/calendarFile.native"
import { makeFakeCapabilities } from "../../capabilities/fakes"

function code(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
}

const ticketSource = code("../host/MyTicketBody.tsx")
const webSource = code("../../primitives/calendarFile.web.ts")
const nativeSource = code("../../primitives/calendarFile.native.ts")

describe("calendarFile seam", () => {
  it("native needs a host writer; web never asks for one (it gates on the DOM instead)", () => {
    expect(native.calendarSaveAvailable({ writer: undefined })).toBe(false)
    expect(native.calendarSaveAvailable({ writer: { save: async () => true } })).toBe(true)
    expect(webSource).not.toContain("input.writer")
    expect(webSource).toContain("typeof Blob")
    expect(typeof web.saveCalendarFile).toBe("function")
  })

  it("native never opens icsUrl: the endpoint answers JSON, so an external open shows a page of JSON", () => {
    expect(nativeSource).not.toContain("openExternal")
    expect(nativeSource).not.toContain("icsUrl")
  })

  it("native hands the document to the writer and reports what happened", async () => {
    const save = vi.fn().mockResolvedValue(true)
    expect(await native.saveCalendarFile({ filename: "e1.ics", ics: "BEGIN", writer: { save } })).toBe(
      "downloaded",
    )
    expect(save).toHaveBeenCalledWith({ filename: "e1.ics", ics: "BEGIN" })
  })

  it("a writer that refuses or throws is `unavailable`, never an unhandled rejection", async () => {
    expect(
      await native.saveCalendarFile({
        filename: "e1.ics",
        ics: "BEGIN",
        writer: { save: async () => false },
      }),
    ).toBe("unavailable")
    expect(
      await native.saveCalendarFile({
        filename: "e1.ics",
        ics: "BEGIN",
        writer: {
          save: () => Promise.reject(new Error("no share sheet")),
        },
      }),
    ).toBe("unavailable")
  })

  it("the FAKE capability bundle provides no writer - the mobile host builds on it, and a no-op writer would show a button that does nothing", () => {
    expect(makeFakeCapabilities().calendarFile).toBeUndefined()
  })
})

describe("MyTicketBody add-to-calendar", () => {
  it("offers the SERVER document and nothing else", () => {
    expect(ticketSource).toContain("icsDocument.refetch()")
    expect(ticketSource).toContain("served.data.filename")
  })

  it("builds NO local .ics: MyEventTicketDTO has no event lifecycle, so a local copy would sit on the shared uid saying CONFIRMED for a cancelled event", () => {
    expect(ticketSource).not.toContain("buildIcs")
    expect(ticketSource).not.toContain("eventIcsUid")
    expect(ticketSource).toContain("served.isError")
  })

  it("shows the button only where the platform can actually save a file", () => {
    expect(ticketSource).toContain("calendarSaveAvailable({ writer: calendarWriter })")
  })

  it("the shared uid helper still exists for the builders that DO have full event data", () => {
    expect(eventIcsUid("e1")).toBe("cleanup-e1@civfix.org")
  })
})
