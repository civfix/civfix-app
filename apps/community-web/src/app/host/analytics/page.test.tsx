import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/home/home-shell", () => ({ HomeShell: () => null }))

import { metadata as hostMetadata } from "../layout"
import { metadata } from "./page"

describe("/host/analytics metadata", () => {
  it("titles the analytics page as analytics, not as the host-a-cleanup form", () => {
    expect(metadata.title).toBe("Analytics · civfix")
    expect(metadata.title).not.toBe(hostMetadata.title)
  })
})
