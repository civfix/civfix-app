/**
 * Loads the civfix typefaces via @expo-google-fonts. The root layout gates rendering on `loaded` so
 * text never flashes in a fallback face. The registered family names line up with theme.fontFamily.
 *
 *   - Bricolage Grotesque (display / headings / dates / stats): 400/500/600/700.
 *   - Hanken Grotesk (body / UI): 400/500/600/700/800.
 *   - JetBrains Mono (emails in the report timeline, share links): 400/500.
 *   - Baloo 2 (the per-letter "civfix" wordmark): 800. The design's wordmark is Baloo 2 800 -
 *     rounder/heavier than Bricolage - so the logo pill, About header, and splash match the handoff.
 */
import { useFonts } from "expo-font"
import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from "@expo-google-fonts/bricolage-grotesque"
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
} from "@expo-google-fonts/hanken-grotesk"
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from "@expo-google-fonts/jetbrains-mono"
import { Baloo2_800ExtraBold } from "@expo-google-fonts/baloo-2"
import { createAppFontRegistry } from "./fontAliases"

export const appFontRegistry = createAppFontRegistry({
  display: {
    regular: BricolageGrotesque_400Regular,
    medium: BricolageGrotesque_500Medium,
    semiBold: BricolageGrotesque_600SemiBold,
    bold: BricolageGrotesque_700Bold,
  },
  body: {
    regular: HankenGrotesk_400Regular,
    medium: HankenGrotesk_500Medium,
    semiBold: HankenGrotesk_600SemiBold,
    bold: HankenGrotesk_700Bold,
    extraBold: HankenGrotesk_800ExtraBold,
  },
  mono: { regular: JetBrainsMono_400Regular, medium: JetBrainsMono_500Medium },
  brand: { extraBold: Baloo2_800ExtraBold },
})

export function useAppFonts(): { loaded: boolean; error: Error | null } {
  const [loaded, error] = useFonts(appFontRegistry)
  return { loaded, error: error ?? null }
}
