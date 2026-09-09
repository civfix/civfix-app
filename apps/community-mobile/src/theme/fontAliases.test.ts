import assert from "node:assert/strict"
import { test } from "node:test"
import { createAppFontRegistry } from "./fontAliases.ts"

test("the useFonts registry includes every app family alias", () => {
  const sources = {
    display: { regular: 1, medium: 2, semiBold: 3, bold: 4 },
    body: { regular: 5, medium: 6, semiBold: 7, bold: 8, extraBold: 9 },
    mono: { regular: 10, medium: 11 },
    brand: { extraBold: 12 },
  }
  const registry = createAppFontRegistry(sources)

  assert.deepEqual(registry, {
    BricolageGrotesque_400Regular: 1,
    BricolageGrotesque_500Medium: 2,
    BricolageGrotesque_600SemiBold: 3,
    BricolageGrotesque_700Bold: 4,
    HankenGrotesk_400Regular: 5,
    HankenGrotesk_500Medium: 6,
    HankenGrotesk_600SemiBold: 7,
    HankenGrotesk_700Bold: 8,
    HankenGrotesk_800ExtraBold: 9,
    JetBrainsMono_400Regular: 10,
    JetBrainsMono_500Medium: 11,
    Baloo2_800ExtraBold: 12,
  })
})
