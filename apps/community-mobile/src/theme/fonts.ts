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

const appFontRegistry = createAppFontRegistry({
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
