import React from "react"
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("react-native", async () => {
  // @ts-expect-error react-native-web ships no type declarations; webpack aliases it for the real build
  const rnw: unknown = await import("react-native-web")
  return rnw as Record<string, unknown>
})

import { BodyTransition } from "../../../../../packages/ui/src/shell/BodyTransition.web"

const SETTLE_MS = 400

const mounts: string[] = []
const unmounts: string[] = []

const probes = new Map<string, React.ComponentType>()

function probeFor(id: string): React.ComponentType {
  const existing = probes.get(id)
  if (existing) return existing
  const Probe = () => {
    React.useEffect(() => {
      mounts.push(id)
      return () => {
        unmounts.push(id)
      }
    }, [])
    return <div data-testid={`body-${id}`}>{id}</div>
  }
  probes.set(id, Probe)
  return Probe
}

function Screen({ id }: { id: string }) {
  const Probe = probeFor(id)
  return <Probe />
}

function Host({ id, direction }: { id: string; direction: "push" | "pop" | "replace" }) {
  return (
    <BodyTransition transitionKey={id} direction={direction}>
      <Screen id={id} />
    </BodyTransition>
  )
}

const detailMounts: string[] = []

function Detail({ id }: { id: string }) {
  const mountedWith = React.useRef(id)
  React.useEffect(() => {
    detailMounts.push(mountedWith.current)
  }, [])
  return <div data-testid={`detail-${id}`}>{`mounted-with:${mountedWith.current}`}</div>
}

function DetailHost({ id, direction }: { id: string; direction: "push" | "pop" | "replace" }) {
  return (
    <BodyTransition transitionKey={id} direction={direction}>
      <Detail id={id} />
    </BodyTransition>
  )
}

function countOf(log: string[], id: string): number {
  return log.filter((entry) => entry === id).length
}

function bodies(): string[] {
  return Array.from(document.querySelectorAll("[data-testid^='body-']")).map(
    (node) => node.getAttribute("data-testid") ?? "",
  )
}

function layers(): Element[] {
  const host = document.body.firstElementChild?.firstElementChild
  return host ? Array.from(host.children) : []
}

function setReducedMotion(reduce: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: reduce && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

beforeEach(() => {
  mounts.length = 0
  unmounts.length = 0
  detailMounts.length = 0
  probes.clear()
  setReducedMotion(false)
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

async function settle(): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(SETTLE_MS)
  })
}

describe("BodyTransition (web seam) mounts each body exactly once per navigation", () => {
  it("mounts the destination once and never remounts the body that is animating out", async () => {
    const view = render(<Host id="feed" direction="replace" />)
    expect(mounts).toEqual(["feed"])

    await act(async () => {
      view.rerender(<Host id="events" direction="replace" />)
    })

    expect(countOf(mounts, "events")).toBe(1)
    expect(countOf(mounts, "feed")).toBe(1)
    expect(countOf(unmounts, "feed")).toBe(0)
    expect(bodies().sort()).toEqual(["body-events", "body-feed"])
  })

  it("does not remount the arrived body when the transition settles", async () => {
    const view = render(<Host id="feed" direction="replace" />)
    await act(async () => {
      view.rerender(<Host id="events" direction="replace" />)
    })
    await settle()

    expect(countOf(mounts, "events")).toBe(1)
    expect(countOf(unmounts, "events")).toBe(0)
    expect(countOf(unmounts, "feed")).toBe(1)
    expect(bodies()).toEqual(["body-events"])
  })

  it("mounts a returning body exactly once for the round trip's second arrival", async () => {
    const view = render(<Host id="feed" direction="replace" />)
    await act(async () => {
      view.rerender(<Host id="events" direction="replace" />)
    })
    await settle()
    await act(async () => {
      view.rerender(<Host id="feed" direction="replace" />)
    })

    expect(countOf(mounts, "feed")).toBe(2)
    expect(countOf(mounts, "events")).toBe(1)

    await settle()

    expect(countOf(mounts, "feed")).toBe(2)
    expect(countOf(mounts, "events")).toBe(1)
    expect(mounts).toEqual(["feed", "events", "feed"])
    expect(bodies()).toEqual(["body-feed"])
  })

  it("keeps one mount per arrival across a push then a pop", async () => {
    const view = render(<Host id="feed" direction="replace" />)
    await act(async () => {
      view.rerender(<Host id="pin:1" direction="push" />)
    })
    await settle()
    await act(async () => {
      view.rerender(<Host id="feed" direction="pop" />)
    })
    await settle()

    expect(mounts).toEqual(["feed", "pin:1", "feed"])
  })

  it("holds the SAME two layer nodes in every phase, so no body is ever re-parented", async () => {
    const view = render(<Host id="feed" direction="push" />)
    const initial = layers()
    expect(initial).toHaveLength(2)

    await act(async () => {
      view.rerender(<Host id="pin:1" direction="push" />)
    })
    const animating = layers()
    expect(animating).toHaveLength(2)
    expect(animating[0]).toBe(initial[0])
    expect(animating[1]).toBe(initial[1])

    await settle()
    const settled = layers()
    expect(settled).toHaveLength(2)
    expect(settled[0]).toBe(initial[0])
    expect(settled[1]).toBe(initial[1])
  })

  it("never hands one entity's live instance to another of the SAME body type", async () => {
    const view = render(<DetailHost id="pin:1" direction="push" />)
    await act(async () => {
      view.rerender(<DetailHost id="pin:2" direction="replace" />)
    })
    await act(async () => {
      vi.advanceTimersByTime(80)
    })
    await act(async () => {
      view.rerender(<DetailHost id="pin:3" direction="replace" />)
    })

    expect(detailMounts).toEqual(["pin:1", "pin:2", "pin:3"])
    expect(document.querySelector("[data-testid='detail-pin:3']")?.textContent).toBe(
      "mounted-with:pin:3",
    )

    await settle()
    expect(detailMounts).toEqual(["pin:1", "pin:2", "pin:3"])
  })

  it("reuses the instance when an interrupted navigation returns to the body still leaving", async () => {
    const view = render(<Host id="feed" direction="push" />)
    await act(async () => {
      view.rerender(<Host id="pin:1" direction="push" />)
    })
    await act(async () => {
      vi.advanceTimersByTime(80)
    })
    await act(async () => {
      view.rerender(<Host id="feed" direction="pop" />)
    })

    expect(mounts).toEqual(["feed", "pin:1"])

    await settle()

    expect(mounts).toEqual(["feed", "pin:1"])
    expect(bodies()).toEqual(["body-feed"])
  })

  it("starts a same-type entity swap from a cold body under reduced motion too", async () => {
    setReducedMotion(true)
    const view = render(<DetailHost id="pin:1" direction="replace" />)
    await act(async () => {
      view.rerender(<DetailHost id="pin:2" direction="replace" />)
    })

    expect(detailMounts).toEqual(["pin:1", "pin:2"])
    expect(document.querySelector("[data-testid='detail-pin:2']")?.textContent).toBe(
      "mounted-with:pin:2",
    )
  })

  it("swaps instantly with one mount when the OS asks for reduced motion", async () => {
    setReducedMotion(true)
    const view = render(<Host id="feed" direction="push" />)
    await act(async () => {
      view.rerender(<Host id="pin:1" direction="push" />)
    })

    expect(mounts).toEqual(["feed", "pin:1"])
    expect(bodies()).toEqual(["body-pin:1"])

    await settle()
    expect(mounts).toEqual(["feed", "pin:1"])
  })
})
