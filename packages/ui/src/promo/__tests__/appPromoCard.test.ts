import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { tokens } from "@civfix/shared/tokens"
import { sliceBetween } from "../../__tests__/sourceGuards"

const SRC = readFileSync(new URL("../AppPromoCard.tsx", import.meta.url), "utf8")
const styleBlock = (name: string): string => {
  return sliceBetween(SRC, `  ${name}: {`, "\n  },")
}

describe("the promo footer shares the feed's column", () => {
  it("insets to the timeline row's own 16, with no per-child compensation", () => {
    expect(styleBlock("section")).toContain('paddingHorizontal: t.space["4"]')
    expect(tokens.space["4"]).toBe(16)
    expect(styleBlock("body")).not.toContain("paddingHorizontal")
    expect(styleBlock("badges")).not.toContain("paddingHorizontal")
  })
})

describe("the dismiss control is a real target, optically centred on the title", () => {
  it("is 32x32 and centred, not a 19px glyph box baseline-aligned to display text", () => {
    expect(styleBlock("head")).toContain('alignItems: "center"')
    expect(styleBlock("head")).not.toContain("baseline")
    const dismiss = styleBlock("dismiss")
    expect(dismiss).toContain('width: t.space["8"]')
    expect(dismiss).toContain('height: t.space["8"]')
    expect(tokens.space["8"]).toBe(32)
    expect(dismiss).not.toContain("padding: 2")
  })

  it("keeps the glyph on the readable ink stop", () => {
    expect(SRC).toMatch(/icon=\{iconMap\.Close\}[\s\S]{0,60}color=\{th\.colors\.textMuted\}/)
  })
})

describe("the promo never renders collapsed - fully visible or dismissed, nothing between", () => {
  it("carries no compact variant, no viewport math, no reopen state", () => {
    expect(SRC).not.toContain("roomForFull")
    expect(SRC).not.toContain("openedByReader")
    expect(SRC).not.toContain("MAX_CARD_SHARE")
    expect(SRC).not.toContain("compactTrigger")
    expect(SRC).not.toContain("useWindowDimensions")
    expect(SRC).not.toContain("ChevronUp")
  })

  it("renders the sub-copy and the store badges unconditionally once visible", () => {
    expect(SRC.match(/return null/g)).toHaveLength(1)
    expect(SRC.match(/return \(\n/g)).toHaveLength(1)
    const card = SRC.slice(SRC.indexOf("return (\n"))
    expect(card).toContain("app_promo.card_body")
    expect(card).toContain("{links.map(")
  })
})

describe("the store badges answer the keyboard", () => {
  it("spreads the timeline's own link-key helper rather than re-typing it", () => {
    expect(SRC).toContain("linkKeyProps")
    const badge = sliceBetween(SRC, "{links.map(", "</Pressable>")
    expect(badge).toContain('accessibilityRole="link"')
    expect(badge).toContain("{...linkKeyProps(")
  })
})

describe("the store badges open through the host's external-link capability", () => {
  it("never calls Linking straight from a badge, which bypasses the host and drops a rejection", () => {
    expect(SRC).not.toContain("void Linking.openURL(link.href)")
    expect(SRC).toContain("const openExternal = useOpenExternal()")
    expect(SRC).toMatch(/openExternal \? openExternal\.open\(href\) : Linking\.openURL\(href\)/)
    const badge = sliceBetween(SRC, "{links.map(", "</Pressable>")
    expect(badge).toContain("onPress={() => openStore(link.href)}")
    expect(badge).toContain("{...linkKeyProps(() => openStore(link.href))}")
  })

  it("tells the reader when the store could not be opened", () => {
    expect(SRC).toMatch(/opening\.catch\(\(\) => \{\s*toast\.show\(t\("app_promo\.open_failed"\), \{ variant: "error" \}\)/)
  })
})
