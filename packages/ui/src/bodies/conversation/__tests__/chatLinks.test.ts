import { describe, expect, it } from "vitest"
import {
  appLinkOrigins,
  mentionLookup,
  normalizeLinkOrigin,
  parseHttpsUrl,
  resolveChatLinkTarget,
  tokenizeChatBody,
  trimUrlPunctuation,
  type ChatBodyToken,
} from "../chatLinks"

const APP = ["https://civfix.org"] as const

const texts = (tokens: readonly ChatBodyToken[]): string[] => tokens.map((token) => token.text)

describe("parseHttpsUrl", () => {
  it("normalizes host case and the default port", () => {
    expect(parseHttpsUrl("HTTPS://CivFix.ORG/post/a")).toEqual({
      origin: "https://civfix.org",
      path: "/post/a",
    })
    expect(parseHttpsUrl("https://civfix.org:443/post/a")?.origin).toBe("https://civfix.org")
    expect(parseHttpsUrl("https://civfix.org:8443/post/a")?.origin).toBe("https://civfix.org:8443")
  })

  it("keeps the query and hash on the path and defaults a bare origin to /", () => {
    expect(parseHttpsUrl("https://civfix.org/post/a?ref=dm#top")?.path).toBe("/post/a?ref=dm#top")
    expect(parseHttpsUrl("https://civfix.org")?.path).toBe("/")
  })

  it("refuses every scheme but https, because the hosts only open https targets", () => {
    expect(parseHttpsUrl("http://civfix.org/post/a")).toBeNull()
    expect(parseHttpsUrl("ftp://civfix.org/x")).toBeNull()
    expect(parseHttpsUrl("civfix.org/post/a")).toBeNull()
    expect(parseHttpsUrl("https:///post/a")).toBeNull()
    expect(parseHttpsUrl("https://civfix org/post/a")).toBeNull()
  })

  it("refuses a userinfo authority, which reads as the app's own origin to a human", () => {
    expect(parseHttpsUrl("https://civfix.org@evil.test/post/a")).toBeNull()
  })
})

describe("trimUrlPunctuation", () => {
  it("peels sentence punctuation off the end", () => {
    expect(trimUrlPunctuation("https://civfix.org/post/a.")).toBe("https://civfix.org/post/a")
    expect(trimUrlPunctuation("https://civfix.org/post/a),")).toBe("https://civfix.org/post/a")
    expect(trimUrlPunctuation("https://civfix.org/post/a?!")).toBe("https://civfix.org/post/a")
  })

  it("keeps a bracket the URL opened itself", () => {
    expect(trimUrlPunctuation("https://x.test/a_(b)")).toBe("https://x.test/a_(b)")
  })

  it("leaves a clean URL untouched", () => {
    expect(trimUrlPunctuation("https://civfix.org/post/a")).toBe("https://civfix.org/post/a")
  })
})

describe("resolveChatLinkTarget", () => {
  it("hands the host a PATH for an own-origin target the shared route parser knows", () => {
    expect(resolveChatLinkTarget("https://civfix.org/pin/r1", APP)).toEqual({
      kind: "internal",
      path: "/pin/r1",
      url: "https://civfix.org/pin/r1",
    })
    expect(resolveChatLinkTarget("https://civfix.org/post/p1", APP)).toMatchObject({
      kind: "internal",
      path: "/post/p1",
    })
    expect(resolveChatLinkTarget("https://civfix.org/people/jane", APP)).toMatchObject({
      kind: "internal",
      path: "/people/jane",
    })
  })

  it("keeps the original url on an internal target, so a host that cannot present it can fall back", () => {
    const target = resolveChatLinkTarget("https://CIVFIX.ORG/pin/r1?x=1", APP)
    expect(target).toMatchObject({ kind: "internal", url: "https://CIVFIX.ORG/pin/r1?x=1" })
  })

  it("compares the ORIGIN exactly, so a lookalike host stays external", () => {
    for (const url of [
      "https://civfix.org.evil.com/post/p1",
      "https://notcivfix.org/post/p1",
      "https://civfix.org.evil.com:443/post/p1",
      "https://evil.test/?x=https://civfix.org/post/p1",
    ]) {
      expect(resolveChatLinkTarget(url, APP)).toEqual({ kind: "external", url })
    }
  })

  it("treats a www host as external - the allow list is exact, never a suffix match", () => {
    const url = "https://www.civfix.org/post/p1"
    expect(resolveChatLinkTarget(url, APP)).toEqual({ kind: "external", url })
  })

  it("keeps an own-origin path the app has NO in-app surface for external", () => {
    const url = "https://civfix.org/legal/terms"
    expect(resolveChatLinkTarget(url, APP)).toEqual({ kind: "external", url })
  })

  it("accepts a second origin (the page's own, on web) and normalizes what it is handed", () => {
    const origins = ["https://civfix.org", "https://staging.civfix.org:8443"]
    expect(resolveChatLinkTarget("https://staging.civfix.org:8443/post/p1", origins)).toMatchObject({
      kind: "internal",
      path: "/post/p1",
    })
    expect(resolveChatLinkTarget("https://CIVFIX.ORG:443/post/p1", ["https://civfix.org/"])).toMatchObject(
      { kind: "internal", path: "/post/p1" },
    )
  })

  it("leaves an http own-host link external, because the hosts refuse non-https targets", () => {
    const url = "http://civfix.org/post/p1"
    expect(resolveChatLinkTarget(url, APP)).toEqual({ kind: "external", url })
  })
})

describe("appLinkOrigins", () => {
  it("always carries the canonical web origin, normalized", () => {
    expect(appLinkOrigins()).toContain("https://civfix.org")
    expect(normalizeLinkOrigin("https://civfix.org/post/a")).toBe("https://civfix.org")
  })

  it("returns one stable array identity, so a bubble re-render does not churn props", () => {
    expect(appLinkOrigins()).toBe(appLinkOrigins())
  })
})

describe("mentionLookup", () => {
  it("maps a resolved mention to its user id and the city mention to null", () => {
    const lookup = mentionLookup([{ id: "u1", handle: "@alex" }], "cityofla")
    expect(lookup.get("alex")).toBe("u1")
    expect(lookup.get("cityofla")).toBeNull()
  })

  it("lets the city handle win over a same-handle user mention", () => {
    const lookup = mentionLookup([{ id: "u1", handle: "cityofla" }], "cityofla")
    expect(lookup.get("cityofla")).toBeNull()
    expect(lookup.size).toBe(1)
  })
})

describe("tokenizeChatBody", () => {
  it("returns one text token for a body with nothing to tokenize", () => {
    expect(tokenizeChatBody("just some words", { origins: APP })).toEqual([
      { kind: "text", text: "just some words" },
    ])
    expect(tokenizeChatBody("", { origins: APP })).toEqual([{ kind: "text", text: "" }])
  })

  it("does NOT invent a link out of a bare domain", () => {
    for (const body of ["foo.bar", "see foo.bar/baz", "mail me at a@foo.bar"]) {
      expect(tokenizeChatBody(body, { origins: APP }).every((token) => token.kind === "text")).toBe(true)
    }
  })

  it("tokenizes a bare URL that is the whole body", () => {
    const tokens = tokenizeChatBody("https://civfix.org/post/p1", { origins: APP })
    expect(tokens).toHaveLength(1)
    expect(tokens[0]).toMatchObject({ kind: "link", text: "https://civfix.org/post/p1" })
  })

  it("tokenizes a URL inside a sentence and leaves the punctuation in the TEXT", () => {
    const tokens = tokenizeChatBody("look at https://civfix.org/post/p1, it's bad.", {
      origins: APP,
    })
    expect(texts(tokens)).toEqual(["look at ", "https://civfix.org/post/p1", ", it's bad."])
    expect(tokens[1]).toMatchObject({ kind: "link", target: { kind: "internal", path: "/post/p1" } })
  })

  it("does not tokenize an http URL at all, so a dead tap is impossible", () => {
    const tokens = tokenizeChatBody("see http://example.test/x please", { origins: APP })
    expect(tokens).toEqual([{ kind: "text", text: "see http://example.test/x please" }])
  })

  it("classifies internal and external links in one body", () => {
    const tokens = tokenizeChatBody(
      "mine https://civfix.org/post/p1 theirs https://example.test/x",
      { origins: APP },
    )
    const links = tokens.filter((token) => token.kind === "link")
    expect(links).toHaveLength(2)
    expect(links[0]).toMatchObject({ target: { kind: "internal" } })
    expect(links[1]).toMatchObject({ target: { kind: "external", url: "https://example.test/x" } })
  })

  it("handles a mention and a URL in the same body", () => {
    const tokens = tokenizeChatBody("hey @alex see https://civfix.org/post/p1 ok", {
      mentions: mentionLookup([{ id: "u1", handle: "alex" }]),
      origins: APP,
    })
    expect(tokens.map((token) => token.kind)).toEqual(["text", "mention", "text", "link", "text"])
    expect(tokens[1]).toMatchObject({ kind: "mention", handle: "alex", userId: "u1" })
  })

  it("never turns an @handle INSIDE a URL into a mention", () => {
    const tokens = tokenizeChatBody("https://example.test/@alex/photos", {
      mentions: mentionLookup([{ id: "u1", handle: "alex" }]),
      origins: APP,
    })
    expect(tokens).toHaveLength(1)
    expect(tokens[0]).toMatchObject({ kind: "link", text: "https://example.test/@alex/photos" })
  })

  it("keeps the attacker-style lookalike EXTERNAL even inside prose", () => {
    const tokens = tokenizeChatBody("check https://civfix.org.evil.com/post/x now", {
      origins: APP,
    })
    expect(tokens[1]).toEqual({
      kind: "link",
      text: "https://civfix.org.evil.com/post/x",
      target: { kind: "external", url: "https://civfix.org.evil.com/post/x" },
    })
  })

  it("reconstructs the original body exactly from the token texts", () => {
    const body = "hi @alex https://civfix.org/post/p1 and https://example.test/a) end"
    const tokens = tokenizeChatBody(body, {
      mentions: mentionLookup([{ id: "u1", handle: "alex" }]),
      origins: APP,
    })
    expect(texts(tokens).join("")).toBe(body)
  })
})
