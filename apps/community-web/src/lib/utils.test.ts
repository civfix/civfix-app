import { describe, expect, it } from "vitest"

import { cn } from "./utils"

describe("cn", () => {
  it("keeps a console font size next to a console colour", () => {
    expect(cn("text-console-surface text-token-13")).toBe("text-console-surface text-token-13")
    expect(cn("text-token-14 font-semibold", "text-console-ink")).toBe(
      "text-token-14 font-semibold text-console-ink",
    )
  })

  it("still lets a later size or colour win over an earlier one", () => {
    expect(cn("text-token-13", "text-token-16")).toBe("text-token-16")
    expect(cn("text-console-ink-2", "text-console-ink")).toBe("text-console-ink")
  })

  it("still resolves stock conflicts", () => {
    expect(cn("p-2", "p-4")).toBe("p-4")
    expect(cn("bg-console-ink", "bg-console-surface")).toBe("bg-console-surface")
  })
})
