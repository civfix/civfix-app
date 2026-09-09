import React, { createContext, useContext, useMemo } from "react"
import { useColorScheme } from "react-native"
import { useAppearancePreference } from "./appearance"
import {
  DEFAULT_APPEARANCE_PREFERENCE,
  resolveColorScheme,
  type AppearancePreference,
  type ColorSchemeName,
} from "./schemes"

export interface ThemeContextValue {
  scheme: ColorSchemeName
  preference: AppearancePreference
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export interface ThemeProviderProps {
  preference?: AppearancePreference
  children: React.ReactNode
}

export function ThemeProvider({ preference, children }: ThemeProviderProps) {
  const registered = useAppearancePreference()
  const effective = preference ?? registered
  const system = useColorScheme()
  const scheme = resolveColorScheme(effective, system)
  const value = useMemo<ThemeContextValue>(
    () => ({ scheme, preference: effective }),
    [scheme, effective],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useColorSchemeName(): ColorSchemeName {
  return useContext(ThemeContext)?.scheme ?? "light"
}

export function useThemePreference(): AppearancePreference {
  return useContext(ThemeContext)?.preference ?? DEFAULT_APPEARANCE_PREFERENCE
}
