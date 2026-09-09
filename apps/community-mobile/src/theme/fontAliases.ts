export const appFontAliases = [
  "BricolageGrotesque_400Regular",
  "BricolageGrotesque_500Medium",
  "BricolageGrotesque_600SemiBold",
  "BricolageGrotesque_700Bold",
  "HankenGrotesk_400Regular",
  "HankenGrotesk_500Medium",
  "HankenGrotesk_600SemiBold",
  "HankenGrotesk_700Bold",
  "HankenGrotesk_800ExtraBold",
  "JetBrainsMono_400Regular",
  "JetBrainsMono_500Medium",
  "Baloo2_800ExtraBold",
] as const

export type AppFontAlias = (typeof appFontAliases)[number]
export type AppFontRegistry<FontSource> = Record<AppFontAlias, FontSource>

export interface AppFontSources<FontSource> {
  display: {
    regular: FontSource
    medium: FontSource
    semiBold: FontSource
    bold: FontSource
  }
  body: {
    regular: FontSource
    medium: FontSource
    semiBold: FontSource
    bold: FontSource
    extraBold: FontSource
  }
  mono: { regular: FontSource; medium: FontSource }
  brand: { extraBold: FontSource }
}

export function createAppFontRegistry<FontSource>(
  sources: AppFontSources<FontSource>,
): AppFontRegistry<FontSource> {
  return {
    BricolageGrotesque_400Regular: sources.display.regular,
    BricolageGrotesque_500Medium: sources.display.medium,
    BricolageGrotesque_600SemiBold: sources.display.semiBold,
    BricolageGrotesque_700Bold: sources.display.bold,
    HankenGrotesk_400Regular: sources.body.regular,
    HankenGrotesk_500Medium: sources.body.medium,
    HankenGrotesk_600SemiBold: sources.body.semiBold,
    HankenGrotesk_700Bold: sources.body.bold,
    HankenGrotesk_800ExtraBold: sources.body.extraBold,
    JetBrainsMono_400Regular: sources.mono.regular,
    JetBrainsMono_500Medium: sources.mono.medium,
    Baloo2_800ExtraBold: sources.brand.extraBold,
  }
}
