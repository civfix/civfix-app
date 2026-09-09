import { describe, expect, it } from "vitest"
import { fontFamily } from "../fontFamily"

describe("theme font aliases", () => {
  it("maps every body weight to the host-loaded Hanken Grotesk aliases", () => {
    const bodyAliases = new Set([
      fontFamily.bodyRegular,
      fontFamily.bodyMedium,
      fontFamily.bodySemiBold,
      fontFamily.bodyBold,
      fontFamily.bodyExtraBold,
    ])

    expect(bodyAliases).toEqual(
      new Set([
        "HankenGrotesk_400Regular",
        "HankenGrotesk_500Medium",
        "HankenGrotesk_600SemiBold",
        "HankenGrotesk_700Bold",
        "HankenGrotesk_800ExtraBold",
      ]),
    )
  })

  it("keeps Bricolage as display and Baloo as the brand-only face", () => {
    const displayAliases = new Set([
      fontFamily.displayRegular,
      fontFamily.displayMedium,
      fontFamily.displaySemiBold,
      fontFamily.displayBold,
    ])

    expect(displayAliases).toEqual(
      new Set([
        "BricolageGrotesque_400Regular",
        "BricolageGrotesque_500Medium",
        "BricolageGrotesque_600SemiBold",
        "BricolageGrotesque_700Bold",
      ]),
    )
    expect(fontFamily.brand).toBe("Baloo2_800ExtraBold")
    expect(Object.values(fontFamily).filter((alias) => alias.startsWith("Baloo2_"))).toEqual([
      fontFamily.brand,
    ])
  })
})
