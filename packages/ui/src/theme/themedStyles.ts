import { StyleSheet } from "react-native"
import { useColorSchemeName } from "./ThemeProvider"
import type { ColorSchemeName } from "./schemes"
import { themes, type Theme } from "./themes"

type NamedStyles<T> = StyleSheet.NamedStyles<T>

export type ThemedStyleFactory<T> = (theme: Theme) => T & NamedStyles<T>

export interface ThemedStylesHook<T> {
  (): T
  for(scheme: ColorSchemeName): T
}

export function makeThemedStyles<T extends NamedStyles<T>>(
  factory: ThemedStyleFactory<T>,
): ThemedStylesHook<T> {
  const cache: Partial<Record<ColorSchemeName, T>> = {}
  const styleFor = (scheme: ColorSchemeName): T => {
    const cached = cache[scheme]
    if (cached) return cached
    const created = StyleSheet.create(factory(themes[scheme]))
    cache[scheme] = created
    return created
  }
  const useStyles = (() => styleFor(useColorSchemeName())) as ThemedStylesHook<T>
  useStyles.for = styleFor
  return useStyles
}
