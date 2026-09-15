import { describe, expect, it } from "vitest"
import { nativeShareContent } from "../shareContent"

const url = "https://civfix.dev/post/abc"

describe("nativeShareContent", () => {
  it("hands iOS the message and the url as separate items, never doubling the link", () => {
    expect(nativeShareContent("ios", { title: "Post", message: "Check out this post on civfix!", url })).toEqual({
      title: "Post",
      message: "Check out this post on civfix!",
      url,
    })
  })

  it("folds the url into the message on Android, which ignores the url field", () => {
    expect(nativeShareContent("android", { title: "Post", message: "Check out this post on civfix!", url })).toEqual({
      title: "Post",
      message: `Check out this post on civfix!\n${url}`,
      url,
    })
  })

  it("does not append the url twice when the message already carries it", () => {
    const message = `Post\n${url}`
    expect(nativeShareContent("android", { title: "Post", message, url }).message).toBe(message)
  })

  it("falls back to the title as the message text", () => {
    expect(nativeShareContent("ios", { title: "Post", url }).message).toBe("Post")
    expect(nativeShareContent("android", { title: "Post", url }).message).toBe(`Post\n${url}`)
  })
})
