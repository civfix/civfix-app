import { Platform, type ViewStyle } from "react-native"
import { tokens, categoryColor, type CategoryColorKey } from "@civfix/shared/tokens"
import { useColorSchemeName } from "./ThemeProvider"
import { themes, type Theme } from "./themes"

export { fontFamily } from "./fontFamily"

export {
  fontSize,
  noShadow,
  radius,
  space,
  lineHeight,
  motion,
  themes,
  themeFor,
  theme,
  colors,
  glass,
  imageFrame,
  shadows,
} from "./themes"
export type {
  NativeShadowStyle,
  WebShadowStyle,
  ShadowStyle,
  ShadowKey,
  ThemeShadows,
  ImageFrameStyle,
  Theme,
} from "./themes"

export {
  APPEARANCE_PREFERENCES,
  COLOR_SCHEMES,
  DEFAULT_APPEARANCE_PREFERENCE,
  DEFAULT_COLOR_SCHEME,
  colorSchemes,
  shadowSchemes,
  isAppearancePreference,
  isColorSchemeName,
  resolveSchemeName,
  resolveColorScheme,
  makeThemeColors,
  makeGlass,
} from "./schemes"
export type {
  AppearancePreference,
  ColorSchemeName,
  ColorPalette,
  ShadowTokens,
  ThemeColors,
  ThemeGlass,
} from "./schemes"

export {
  setAppearancePreferenceStore,
  getAppearancePreference,
  setAppearancePreference,
  useAppearancePreference,
  makeMemoryAppearanceStore,
} from "./appearance"
export type { AppearancePreferenceStore } from "./appearance"

export { ThemeProvider, useColorSchemeName, useThemePreference } from "./ThemeProvider"
export type { ThemeProviderProps, ThemeContextValue } from "./ThemeProvider"

export { makeThemedStyles } from "./themedStyles"
export type { ThemedStyleFactory, ThemedStylesHook } from "./themedStyles"

export function useTheme(): Theme {
  return themes[useColorSchemeName()]
}

export function coloredShadow(
  color: string,
  offsetY: number,
  blur: number,
  opacity: number,
  elevation: number,
): ViewStyle {
  if (Platform.OS === "web") {
    const a = Math.round(Math.min(Math.max(opacity, 0), 1) * 255)
      .toString(16)
      .padStart(2, "0")
    const webColor = /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}${a}` : color
    return { boxShadow: `0 ${offsetY}px ${blur}px ${webColor}` }
  }
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: blur,
    elevation,
  } as ViewStyle
}

export function pinGlow(
  color: string,
  offsetY: number,
  blur: number,
  opacity: number,
  elevation: number,
): ViewStyle {
  if (Platform.OS === "web") {
    const a = Math.round(Math.min(Math.max(opacity, 0), 1) * 255)
      .toString(16)
      .padStart(2, "0")
    const webColor = /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}${a}` : color
    return { filter: `drop-shadow(0 ${offsetY}px ${blur}px ${webColor})` } as unknown as ViewStyle
  }
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: blur,
    elevation,
  } as ViewStyle
}

export { categoryColor }
export type { CategoryColorKey }

export { MOTION, EASE_STANDARD_CSS, EASE_GRAVITY_CSS } from "./motion"
export type { TimingRecipe, SpringRecipe, EaseTuple } from "./motion"

export const cleanupColor: string = tokens.color.cleanup

export function tint(hex: string, amount: number): string {
  const n = hex.replace("#", "")
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

function mixHex(hex: string, toward: string, amount: number): string {
    const a = hex.replace("#", "")
    const b = toward.replace("#", "")
    const ch = (v: string, i: number) => parseInt(v.slice(i, i + 2), 16)
    const mix = (i: number) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * amount)
    return `rgb(${mix(0)}, ${mix(2)}, ${mix(4)})`
}

export function wash(hex: string, amount: number, theme: Theme): string {
  return theme.scheme === "dark" ? mixHex(hex, theme.colors.surface, amount) : tint(hex, amount)
}

export const wordmarkColors: readonly string[] = [
  tokens.color.brand.bloom,
  tokens.color.sun["600"],
  tokens.color.brand.moss,
  tokens.color.brand.sky,
  tokens.color.brand.lilac,
  tokens.color.brand.bloom,
]

export const supportsBlur = Platform.OS === "ios"

export { useLayoutMode, type LayoutMode } from "./useLayoutMode"

export { useReducedMotion } from "./useReducedMotion"

export {
  webCursor,
  webCursorPointer,
  webCursorDefault,
  webCursorColResize,
  webSelectableText,
  webNoSelect,
  webInputReset,
  webTransition,
  webHover,
  focusRingProps,
  webScrimProps,
  headingLevel,
  stopPress,
  FOCUS_RING_COLOR,
  FOCUS_RING_OFFSET,
  FOCUS_RING_WIDTH,
  FOCUS_RING_OUTLINE,
  FOCUS_RING_COLOR_DARK,
  FOCUS_RING_OUTLINE_DARK,
} from "./webAffordances"

export const POST_SURFACE: "flat" | "card" = "flat"
