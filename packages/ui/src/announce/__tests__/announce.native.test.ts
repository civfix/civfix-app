import { beforeEach, describe, expect, it, vi } from "vitest"

const calls: Array<{ message: string; options: { queue?: boolean } }> = []

vi.mock("react-native", () => ({
  AccessibilityInfo: {
    announceForAccessibilityWithOptions: (message: string, options: { queue?: boolean }) => {
      calls.push({ message, options })
    },
  },
}))

const { announce } = await import("../announce.native")

beforeEach(() => {
  calls.length = 0
})

describe("announce (native)", () => {
  it("queues a polite message behind whatever is being spoken", () => {
    announce("Report filed")
    expect(calls).toEqual([{ message: "Report filed", options: { queue: true } }])
  })

  it("defaults to polite", () => {
    announce("Saved", {})
    expect(calls[0]?.options.queue).toBe(true)
  })

  it("interrupts for an assertive message instead of dropping its priority", () => {
    announce("Upload failed", { priority: "assertive" })
    expect(calls).toEqual([{ message: "Upload failed", options: { queue: false } }])
  })

  it("ignores an empty message", () => {
    announce("")
    expect(calls).toEqual([])
  })
})
