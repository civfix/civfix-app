import { Platform, type ViewStyle } from "react-native"
import { tokens, categoryColor, type CategoryColorKey } from "@civfix/shared/tokens"
import { useColorSchemeName } from "./ThemeProvider"
import { themes, type Theme } from "./themes"
import { hexWithAlpha } from "./color"

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
  DEFAULT_APPEARANCE_PREFERENCE,
  DEFAULT_COLOR_SCHEME,
  colorSchemes,
  shadowSchemes,
  isAppearancePreference,
  resolveSchemeName,
  resolveColorScheme,
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
} from "./appearance"
export type { AppearancePreferenceStore } from "./appearance"

export { ThemeProvider, useColorSchemeName } from "./ThemeProvider"
export type { ThemeProviderProps, ThemeContextValue } from "./ThemeProvider"

export { makeThemedStyles } from "./themedStyles"
export type { ThemedStyleFactory, ThemedStylesHook } from "./themedStyles"

export function useTheme(): Theme {
  return themes[useColorSchemeName()]
}

function nativeShadow(
  color: string,
  offsetY: number,
  blur: number,
  opacity: number,
  elevation: number,
): ViewStyle {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: blur,
    elevation,
  } as ViewStyle
}

export function coloredShadow(
  color: string,
  offsetY: number,
  blur: number,
  opacity: number,
  elevation: number,
): ViewStyle {
  if (Platform.OS === "web") {
    return { boxShadow: `0 ${offsetY}px ${blur}px ${hexWithAlpha(color, opacity)}` }
  }
  return nativeShadow(color, offsetY, blur, opacity, elevation)
}

export function pinGlow(
  color: string,
  offsetY: number,
  blur: number,
  opacity: number,
  elevation: number,
): ViewStyle {
  if (Platform.OS === "web") {
    return { filter: `drop-shadow(0 ${offsetY}px ${blur}px ${hexWithAlpha(color, opacity)})` } as unknown as ViewStyle
  }
  return nativeShadow(color, offsetY, blur, opacity, elevation)
}

export { categoryColor }
export type { CategoryColorKey }

export { MOTION, EASE_STANDARD_CSS } from "./motion"
export {
  PRESSED_OPACITY,
  PRESSED_OPACITY_SUBTLE,
  HOVERED_OPACITY,
  DISABLED_OPACITY,
  DISABLED_OPACITY_FAINT,
} from "./opacity"
export { MIN_TOUCH_TARGET, hitSlopToTarget } from "./touchTarget"
export type { TimingRecipe, EaseTuple } from "./motion"

export { tint, wash } from "./color"

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

export { a11yState } from "./a11yState"
export type { A11yStateProps } from "./a11yState"

export {
  webCursor,
  webCursorPointer,
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
  linkKeyProps,
  inputFocusedStyle,
  ROW_A11Y_PROPS,
  WEB_ROW_FOCUS_INSET,
  FOCUS_RING_FOOTPRINT,
  FOCUS_RING_COLOR,
  FOCUS_RING_OFFSET,
  FOCUS_RING_WIDTH,
  FOCUS_RING_OUTLINE,
} from "./webAffordances"

export const POST_SURFACE: "flat" | "card" = "flat"
