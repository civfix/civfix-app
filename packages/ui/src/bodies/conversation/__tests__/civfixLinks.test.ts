import { describe, expect, it } from "vitest"
import { tokenizeChatBody } from "../chatLinks"
import {
  CIVFIX_LINK_HOSTS,
  MAX_EMBEDS_PER_MESSAGE,
  civfixLinkFromPath,
  classifyCivfixUrl,
  planChatEmbeds,
} from "../civfixLinks"

const HOSTS = ["civfix.org", "www.civfix.org", "civfix.dev", "www.civfix.dev"] as const

describe("classifyCivfixUrl recognises every entity shape on every civfix host", () => {
  it("lists exactly the production and staging hosts, with and without www", () => {
    expect([...CIVFIX_LINK_HOSTS]).toEqual([...HOSTS])
  })

  it.each(HOSTS)("maps the entity paths on https://%s", (host) => {
    const at = (path: string) => classifyCivfixUrl(`https://${host}${path}`)
    expect(at("/pin/rep-1")).toMatchObject({ kind: "report", id: "rep-1", path: "/pin/rep-1" })
    expect(at("/reports/rep-1")).toMatchObject({ kind: "report", id: "rep-1", path: "/pin/rep-1" })
    expect(at("/cleanups/evt-1")).toMatchObject({ kind: "event", id: "evt-1", path: "/cleanups/evt-1" })
    expect(at("/cleanups/CU-42-000001")).toMatchObject({ kind: "event", id: "CU-42-000001" })
    expect(at("/e/beach-day")).toMatchObject({ kind: "event", id: "beach-day", path: "/cleanups/beach-day" })
    expect(at("/post/post-1")).toMatchObject({ kind: "post", id: "post-1", path: "/post/post-1" })
    expect(at("/post/post-1/thread")).toMatchObject({ kind: "post", id: "post-1", path: "/post/post-1" })
    expect(at("/people/jane_doe")).toMatchObject({ kind: "person", id: "jane_doe", path: "/people/jane_doe" })
    expect(at("/orgs/friends-of-ballona")).toMatchObject({
      kind: "org",
      id: "friends-of-ballona",
      path: "/orgs/friends-of-ballona",
    })
  })

  it("keeps the original url on the ref and keys it by entity, not by host", () => {
    const prod = classifyCivfixUrl("https://civfix.org/pin/rep-1")
    const staging = classifyCivfixUrl("https://www.civfix.dev/pin/rep-1")
    expect(prod?.url).toBe("https://civfix.org/pin/rep-1")
    expect(staging?.url).toBe("https://www.civfix.dev/pin/rep-1")
    expect(prod?.key).toBe("report:rep-1")
    expect(staging?.key).toBe(prod?.key)
  })

  it("is case-insensitive on the host and tolerates the default port, a query and a hash", () => {
    expect(classifyCivfixUrl("HTTPS://WWW.CivFix.ORG/pin/rep-1")?.kind).toBe("report")
    expect(classifyCivfixUrl("https://civfix.org:443/cleanups/evt-1")?.kind).toBe("event")
    expect(classifyCivfixUrl("https://civfix.org/cleanups/evt-1?teamInvite=abc#top")).toMatchObject({
      kind: "event",
      id: "evt-1",
    })
    expect(classifyCivfixUrl("https://civfix.org/pin/rep-1/")?.id).toBe("rep-1")
  })

  it("accepts the app's own civfix:// scheme, including the triple-slash form", () => {
    expect(classifyCivfixUrl("civfix://pin/rep-1")).toMatchObject({ kind: "report", id: "rep-1" })
    expect(classifyCivfixUrl("civfix:///cleanups/evt-1")).toMatchObject({ kind: "event", id: "evt-1" })
    expect(classifyCivfixUrl("civfix://post/post-1/thread")).toMatchObject({ kind: "post", id: "post-1" })
  })
})

describe("classifyCivfixUrl refuses everything that is not a civfix entity page", () => {
  it("ignores other hosts, lookalikes and other schemes", () => {
    expect(classifyCivfixUrl("https://example.com/pin/rep-1")).toBeNull()
    expect(classifyCivfixUrl("https://civfix.org.evil.com/pin/rep-1")).toBeNull()
    expect(classifyCivfixUrl("https://evil.com/civfix.org/pin/rep-1")).toBeNull()
    expect(classifyCivfixUrl("https://api.civfix.org/pin/rep-1")).toBeNull()
    expect(classifyCivfixUrl("https://civfix.dev.example/pin/rep-1")).toBeNull()
    expect(classifyCivfixUrl("https://civfix.org:8443/pin/rep-1")).toBeNull()
    expect(classifyCivfixUrl("http://civfix.org/pin/rep-1")).toBeNull()
    expect(classifyCivfixUrl("https://user@civfix.org/pin/rep-1")).toBeNull()
    expect(classifyCivfixUrl("ftp://civfix.org/pin/rep-1")).toBeNull()
    expect(classifyCivfixUrl("expo://pin/rep-1")).toBeNull()
    expect(classifyCivfixUrl("civfix.org/pin/rep-1")).toBeNull()
  })

  it("ignores list pages, sub-screens and unknown roots", () => {
    expect(classifyCivfixUrl("https://civfix.org/")).toBeNull()
    expect(classifyCivfixUrl("https://civfix.org/pin")).toBeNull()
    expect(classifyCivfixUrl("https://civfix.org/pin/")).toBeNull()
    expect(classifyCivfixUrl("https://civfix.org/cleanups")).toBeNull()
    expect(classifyCivfixUrl("https://civfix.org/cleanups/evt-1/edit")).toBeNull()
    expect(classifyCivfixUrl("https://civfix.org/cleanups/evt-1/host")).toBeNull()
    expect(classifyCivfixUrl("https://civfix.org/cleanups/evt-1/ticket/seat-1")).toBeNull()
    expect(classifyCivfixUrl("https://civfix.org/people/jane/followers")).toBeNull()
    expect(classifyCivfixUrl("https://civfix.org/post/post-1/other")).toBeNull()
    expect(classifyCivfixUrl("https://civfix.org/messages/dm/room-1")).toBeNull()
    expect(classifyCivfixUrl("https://civfix.org/events/evt-1")).toBeNull()
    expect(classifyCivfixUrl("https://civfix.org/legal/terms")).toBeNull()
    expect(classifyCivfixUrl("https://civfix.org/donate/org-1")).toBeNull()
  })

  it("rejects traversal, placeholders and ids outside the safe charset", () => {
    expect(classifyCivfixUrl("https://civfix.org/pin/../settings")).toBeNull()
    expect(classifyCivfixUrl("https://civfix.org/pin/..")).toBeNull()
    expect(classifyCivfixUrl("https://civfix.org/pin/.")).toBeNull()
    expect(classifyCivfixUrl("https://civfix.org/pin/_")).toBeNull()
    expect(classifyCivfixUrl("https://civfix.org/pin/.hidden")).toBeNull()
    expect(classifyCivfixUrl("https://civfix.org/pin/%2e%2e")).toBeNull()
    expect(classifyCivfixUrl("https://civfix.org/pin/<script>")).toBeNull()
    expect(classifyCivfixUrl("https://civfix.org/pin/a b")).toBeNull()
    expect(classifyCivfixUrl(`https://civfix.org/pin/${"a".repeat(101)}`)).toBeNull()
    expect(classifyCivfixUrl("https://civfix.org//pin//rep-1")).toMatchObject({ kind: "report", id: "rep-1" })
  })

  it("civfixLinkFromPath is the same decision on a bare path", () => {
    expect(civfixLinkFromPath("/orgs/acme")).toMatchObject({ kind: "org", id: "acme", url: "/orgs/acme" })
    expect(civfixLinkFromPath("/orgs")).toBeNull()
    expect(civfixLinkFromPath("/nope/acme")).toBeNull()
  })
})

describe("planChatEmbeds decides which links in a message become cards", () => {
  const plan = (body: string, limit?: number) =>
    planChatEmbeds(tokenizeChatBody(body, { origins: ["https://civfix.org"] }), limit)

  it("gives a civfix report link an embed and leaves a foreign link as a plain link", () => {
    expect(plan("look at https://civfix.org/pin/rep-1")).toEqual({
      refs: [
        {
          kind: "report",
          id: "rep-1",
          path: "/pin/rep-1",
          url: "https://civfix.org/pin/rep-1",
          key: "report:rep-1",
        },
      ],
      linkOnly: false,
    })
    expect(plan("look at https://example.com/pin/rep-1")).toEqual({ refs: [], linkOnly: false })
    expect(plan("no links here")).toEqual({ refs: [], linkOnly: false })
  })

  it("recognises the staging host even when the build's own origin is production", () => {
    expect(plan("https://civfix.dev/cleanups/evt-1").refs).toMatchObject([{ kind: "event", id: "evt-1" }])
  })

  it("shows the card alone when the message is nothing but one civfix link", () => {
    expect(plan("https://civfix.org/post/post-1").linkOnly).toBe(true)
    expect(plan("  https://civfix.org/post/post-1 \n").linkOnly).toBe(true)
    expect(plan("https://civfix.org/post/post-1.").linkOnly).toBe(true)
    expect(plan("https://civfix.org/post/post-1, ").linkOnly).toBe(true)
  })

  it("keeps anything the sender typed alongside the link, punctuation included", () => {
    expect(plan("https://civfix.org/pin/rep-1 :)").linkOnly).toBe(false)
    expect(plan("https://civfix.org/pin/rep-1!").linkOnly).toBe(false)
    expect(plan("https://civfix.org/pin/rep-1?").linkOnly).toBe(false)
    expect(plan("https://civfix.org/pin/rep-1 ...").linkOnly).toBe(false)
    expect(plan("https://civfix.org/pin/rep-1 .").linkOnly).toBe(false)
    expect(plan("https://civfix.org/pin/rep-1 ,").linkOnly).toBe(false)
    expect(plan("!!! https://civfix.org/pin/rep-1").linkOnly).toBe(false)
    expect(plan("... https://civfix.org/pin/rep-1").linkOnly).toBe(false)
  })

  it("keeps the text when a note, a mention, a second link or a foreign link accompanies it", () => {
    expect(plan("check this out\nhttps://civfix.org/post/post-1").linkOnly).toBe(false)
    expect(plan("https://civfix.org/post/post-1 https://civfix.org/pin/rep-1").linkOnly).toBe(false)
    expect(plan("https://civfix.org/post/post-1 https://civfix.org/post/post-1").linkOnly).toBe(false)
    expect(plan("https://civfix.org/post/post-1 https://example.com").linkOnly).toBe(false)
    expect(
      planChatEmbeds(
        tokenizeChatBody("@jane https://civfix.org/post/post-1", {
          origins: ["https://civfix.org"],
          mentions: new Map([["jane", "user-1"]]),
        }),
      ).linkOnly,
    ).toBe(false)
  })

  it("bounds the embeds per message and de-duplicates repeated entities", () => {
    expect(MAX_EMBEDS_PER_MESSAGE).toBe(2)
    const many = plan(
      [
        "https://civfix.org/pin/rep-1",
        "https://civfix.org/pin/rep-1",
        "https://www.civfix.dev/pin/rep-1",
        "https://civfix.org/cleanups/evt-1",
        "https://civfix.org/people/jane",
        "https://civfix.org/orgs/acme",
      ].join(" "),
    )
    expect(many.refs.map((ref) => ref.key)).toEqual(["report:rep-1", "event:evt-1"])
    expect(plan("https://civfix.org/pin/rep-1 https://civfix.org/cleanups/evt-1", 1).refs).toHaveLength(1)
  })

  it("returns the same frozen empty plan for every embed-less message", () => {
    expect(plan("hello")).toBe(plan("https://example.com"))
  })
})
