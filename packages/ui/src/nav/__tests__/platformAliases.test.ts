import { describe, expect, it } from "vitest"
import { entryFromPath, entryFromPlatformPath, pathForEntry, platformPathForEntry } from "../routes"
import { ALL_DETAIL_KINDS, type DetailEntry } from "../types"

describe("platform address aliases", () => {
  it("reads a /post link as its thread on web and as the post card on native", () => {
    expect(entryFromPlatformPath("/post/p1", "web")).toEqual({ kind: "post-thread", id: "p1" })
    expect(entryFromPlatformPath("/post/p1", "native")).toEqual({ kind: "post", id: "p1" })
    expect(entryFromPlatformPath("/post/p1/thread", "web")).toEqual({ kind: "post-thread", id: "p1" })
  })

  it("writes a web thread at the short post address and a native one at /thread", () => {
    expect(platformPathForEntry({ kind: "post-thread", id: "p1" }, "web")).toBe("/post/p1")
    expect(platformPathForEntry({ kind: "post-thread", id: "p1" }, "native")).toBe("/post/p1/thread")
  })

  it("leaves an id-less post address alone on both platforms", () => {
    expect(entryFromPlatformPath("/post", "web")).toEqual(entryFromPath("/post"))
    expect(platformPathForEntry({ kind: "post-thread" }, "web")).toBe(pathForEntry({ kind: "post-thread" }))
  })

  it("is the shared table everywhere else", () => {
    for (const kind of ALL_DETAIL_KINDS) {
      if (kind === "post-thread") continue
      const entry: DetailEntry = { kind, id: "x1" }
      for (const platform of ["web", "native"] as const) {
        expect(platformPathForEntry(entry, platform), `${kind} ${platform}`).toBe(pathForEntry(entry))
        const path = pathForEntry(entry)
        if (kind === "post" && platform === "web") continue
        expect(entryFromPlatformPath(path, platform), `${path} ${platform}`).toEqual(entryFromPath(path))
      }
    }
  })
})
