import { afterEach } from "vitest"

if (typeof window !== "undefined") {
  if (typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
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

  if (typeof window.ResizeObserver === "undefined") {
    class TestResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(window, "ResizeObserver", {
      writable: true,
      value: TestResizeObserver,
    })
    Object.defineProperty(globalThis, "ResizeObserver", {
      writable: true,
      value: TestResizeObserver,
    })
  }

  if (typeof Element.prototype.scrollIntoView !== "function") {
    Element.prototype.scrollIntoView = function scrollIntoView() {}
  }
}

afterEach(() => {
  if (typeof document !== "undefined") document.body.innerHTML = ""
})
