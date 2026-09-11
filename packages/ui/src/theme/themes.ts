import { Platform, type ViewStyle } from "react-native"
import { tokens } from "@civfix/shared/tokens"
import { fontFamily } from "./fontFamily"
import { MOTION, EASE_STANDARD as EASE_STANDARD_TOKEN } from "./motion"
import {
  COLOR_SCHEMES,
  makeGlass,
  makeThemeColors,
  shadowTokensFor,
  type ColorSchemeName,
  type ThemeColors,
  type ThemeGlass,
} from "./schemes"

function remToPx(rem: string): number {
  return Math.round(parseFloat(rem) * 16)
}

export const fontSize = {
  "12": remToPx(tokens.fontSize["12"]),
  "13": remToPx(tokens.fontSize["13"]),
  "14": remToPx(tokens.fontSize["14"]),
  "15": remToPx(tokens.fontSize["15"]),
  "16": remToPx(tokens.fontSize["16"]),
  "18": remToPx(tokens.fontSize["18"]),
  "20": remToPx(tokens.fontSize["20"]),
  "24": remToPx(tokens.fontSize["24"]),
  "30": remToPx(tokens.fontSize["30"]),
  "38": remToPx(tokens.fontSize["38"]),
  "48": remToPx(tokens.fontSize["48"]),
  "64": remToPx(tokens.fontSize["64"]),
} as const

export type NativeShadowStyle = {
  shadowColor: string
  shadowOffset: { width: number; height: number }
  shadowOpacity: number
  shadowRadius: number
  elevation: number
}

export type WebShadowStyle = { boxShadow: string }

export type ShadowStyle = NativeShadowStyle | WebShadowStyle

function nativeShadow(
  hex: string,
  opacity: number,
  height: number,
  radius: number,
  elevation: number,
): NativeShadowStyle {
  return {
    shadowColor: hex,
    shadowOffset: { width: 0, height },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation,
  }
}

function shadow(cssToken: string, native: NativeShadowStyle): ShadowStyle {
  return Platform.OS === "web" ? { boxShadow: cssToken } : native
}

export type ShadowKey = "s1" | "s2" | "s3" | "s4" | "pin"

export type ThemeShadows = Readonly<Record<ShadowKey, ShadowStyle>>

const DARK_SHADOW_OPACITY_BOOST = 2.5

function makeShadows(scheme: ColorSchemeName, colors: ThemeColors): ThemeShadows {
  const css = shadowTokensFor(scheme)
  const boost = scheme === "dark" ? DARK_SHADOW_OPACITY_BOOST : 1
  const ink = colors.shadowColor
  return {
    s1: shadow(css.s1, nativeShadow(ink, Math.min(1, 0.05 * boost), 1, 2, 1)),
    s2: shadow(css.s2, nativeShadow(ink, Math.min(1, 0.08 * boost), 8, 16, 4)),
    s3: shadow(css.s3, nativeShadow(ink, Math.min(1, 0.12 * boost), 14, 24, 8)),
    s4: shadow(css.s4, nativeShadow(ink, Math.min(1, 0.18 * boost), 22, 40, 16)),
    pin: shadow(css.pin, nativeShadow(colors.brand.bloom, 0.45, 6, 10, 10)),
  }
}

export const noShadow: ViewStyle =
  Platform.OS === "web"
    ? ({ boxShadow: "none" } as ViewStyle)
    : ({ shadowOpacity: 0, elevation: 0 } as ViewStyle)

export const radius = {
  xs: tokens.radius.xs,
  sm: tokens.radius.sm,
  md: tokens.radius.md,
  lg: tokens.radius.lg,
  xl: tokens.radius.xl,
  "2xl": tokens.radius["2xl"],
  pill: tokens.radius.pill,
} as const

export const space = tokens.space

export const lineHeight = tokens.lineHeight

const EASE_STANDARD = EASE_STANDARD_TOKEN

export const motion = {
  ...tokens.motion,
  ...MOTION,
  easing: EASE_STANDARD,
  slide: { duration: 280, easing: EASE_STANDARD, distance: 24 },
  fade: { duration: 200, easing: EASE_STANDARD },
  fadeUp: { duration: 250, easing: EASE_STANDARD, distance: 14, scaleFrom: 0.96 },
  slideUp: { duration: 300, easing: EASE_STANDARD, distance: 60 },
  glassIn: { duration: 250, easing: EASE_STANDARD, scaleFrom: 0.92 },
  pop: {
    duration: 400,
    from: 0.6,
    overshoot: 1.08,
    to: 1,
    spring: { damping: 12, stiffness: 260, mass: 0.8 },
  },
} as const

export interface ImageFrameStyle {
  borderWidth: number
  borderColor: string
}

export interface Theme {
  scheme: ColorSchemeName
  colors: ThemeColors
  glass: ThemeGlass
  imageFrame: ImageFrameStyle
  fontFamily: typeof fontFamily
  fontSize: typeof fontSize
  space: typeof space
  radius: typeof radius
  shadows: ThemeShadows
  lineHeight: typeof lineHeight
  motion: typeof motion
}

function makeTheme(scheme: ColorSchemeName): Theme {
  const colors = makeThemeColors(scheme)
  return {
    scheme,
    colors,
    glass: makeGlass(scheme),
    imageFrame: { borderWidth: 1, borderColor: colors.borderStrong },
    fontFamily,
    fontSize,
    space,
    radius,
    shadows: makeShadows(scheme, colors),
    lineHeight,
    motion,
  }
}

export const themes: Readonly<Record<ColorSchemeName, Theme>> = Object.fromEntries(
  COLOR_SCHEMES.map((scheme) => [scheme, makeTheme(scheme)]),
) as Record<ColorSchemeName, Theme>

export function themeFor(scheme: ColorSchemeName): Theme {
  return themes[scheme]
}
