/**
 * The quote / repost card is a button that opens the embedded post. Its name must carry who wrote it and
 * what it says, because an accessible button is one element on both platforms: VoiceOver and the web's
 * role=button read the label, never the text inside. EmbeddedPost imports react-native, so the card's
 * wiring is pinned by source and the label is exercised through its pure builder.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { embeddedPostA11yLabel } from "../embeddedPostLabel"

const t = (key: string, options?: Record<string, unknown>): string =>
  options ? `${key}${JSON.stringify(options)}` : key

describe("embeddedPostA11yLabel", () => {
  it("names the author and the quoted text", () => {
    expect(embeddedPostA11yLabel(t, { prominent: false, name: "Ana", excerpt: "Pothole on 5th", deleted: false })).toBe(
      'post_card.open_quote_a11y{"name":"Ana","excerpt":"Pothole on 5th"}',
    )
  })

  it("says reposted for the prominent repost card", () => {
    expect(embeddedPostA11yLabel(t, { prominent: true, name: "Ana", excerpt: "Pothole", deleted: false })).toBe(
      'post_card.open_repost_a11y{"name":"Ana","excerpt":"Pothole"}',
    )
  })

  it("reads the unavailable notice for a deleted post instead of a stale excerpt", () => {
    expect(embeddedPostA11yLabel(t, { prominent: false, name: "Deleted account", excerpt: "old", deleted: true })).toBe(
      'post_card.open_quote_a11y{"name":"Deleted account","excerpt":"post_card.unavailable"}',
    )
  })

  it("falls back to the author alone when the post has no text", () => {
    expect(embeddedPostA11yLabel(t, { prominent: false, name: "Ana", excerpt: "   ", deleted: false })).toBe(
      'post_card.open_thread_a11y{"name":"Ana"}',
    )
  })
})

const code = (relative: string): string =>
  readFileSync(new URL(relative, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")

describe("the embedded post stays an actionable button on native", () => {
  const embed = code("../EmbeddedPost.tsx")
  const start = embed.indexOf("<Pressable")
  const end = embed.indexOf("style=", start)

  it("is not opted out of the accessibility tree, and is labelled from author and excerpt", () => {
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const pressable = embed.slice(start, end)
    expect(pressable).toContain('accessibilityRole="button"')
    expect(pressable).toContain("accessibilityLabel={label}")
    expect(embed).not.toContain("accessible: false")
    expect(embed).toContain("embeddedPostA11yLabel(t, {")
  })
})
