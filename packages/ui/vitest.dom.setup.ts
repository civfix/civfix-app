import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// Testing Library only auto-registers cleanup when test globals are enabled, and this package runs
// without them; an unmounted tree would keep its effects and timers alive into the next test.
afterEach(() => {
  cleanup()
})
