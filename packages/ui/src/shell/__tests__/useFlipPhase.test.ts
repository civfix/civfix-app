import { afterEach, describe, expect, it, vi } from "vitest"
import { forceReflow } from "../useFlipPhase"

function layoutNode(height: number | undefined) {
  const read = vi.fn(() => height)
  const node = {}
  Object.defineProperty(node, "offsetHeight", { get: read })
  return { node, read }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("forceReflow", () => {
  it("reads layout from the first node that has it and stops there", () => {
    const first = layoutNode(120)
    const second = layoutNode(80)
    forceReflow([first.node, second.node], true)
    expect(first.read).toHaveBeenCalled()
    expect(second.read).not.toHaveBeenCalled()
  })

  it("skips a missing or unmounted node and reads the next one", () => {
    const unmounted = layoutNode(undefined)
    const outgoing = layoutNode(80)
    forceReflow([null, unmounted.node, outgoing.node], true)
    expect(unmounted.read).toHaveBeenCalled()
    expect(outgoing.read).toHaveBeenCalled()
  })

  it("falls back to the document only when asked to", () => {
    const documentRead = vi.fn(() => 0)
    const documentElement = {}
    Object.defineProperty(documentElement, "offsetHeight", { get: documentRead })
    vi.stubGlobal("document", { documentElement })

    forceReflow([null], false)
    expect(documentRead).not.toHaveBeenCalled()

    forceReflow([null], true)
    expect(documentRead).toHaveBeenCalledTimes(1)
  })

  it("does nothing without a document", () => {
    expect(() => forceReflow([null], true)).not.toThrow()
  })
})
