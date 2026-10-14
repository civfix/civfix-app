import { useEffect, useMemo } from "react"
import { Appearance, useColorScheme } from "react-native"
import * as SystemUI from "expo-system-ui"
import { getAppearancePreference, resolveColorScheme, themeFor, type ColorSchemeName, type Theme } from "@/theme"
import { useAppearanceStore } from "@/store/appearanceStore"

export function currentTheme(): Theme {
  return themeFor(resolveColorScheme(getAppearancePreference(), Appearance.getColorScheme()))
}

function useAppearanceScheme(): ColorSchemeName {
  const preference = useAppearanceStore((s) => s.preference)
  const system = useColorScheme()
  return resolveColorScheme(preference, system)
}

export function useAppearanceTheme(): Theme {
  const scheme = useAppearanceScheme()
  const theme = useMemo(() => themeFor(scheme), [scheme])

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.bg)
  }, [theme.colors.bg])

  return theme
}
