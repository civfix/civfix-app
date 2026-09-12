import {
  colorSchemes,
  shadowSchemes,
  type ColorPalette,
  type ColorSchemeName,
  type ShadowTokens,
} from "@civfix/shared/tokens"

export { colorSchemes, shadowSchemes }
export type { ColorSchemeName, ColorPalette, ShadowTokens }

export type AppearancePreference = "system" | ColorSchemeName

export const APPEARANCE_PREFERENCES: readonly AppearancePreference[] = ["system", "light", "dark"]

export const DEFAULT_APPEARANCE_PREFERENCE: AppearancePreference = "system"

export const COLOR_SCHEMES: readonly ColorSchemeName[] = ["light", "dark"]

export const DEFAULT_COLOR_SCHEME: ColorSchemeName = "light"

export function isAppearancePreference(value: unknown): value is AppearancePreference {
  return typeof value === "string" && (APPEARANCE_PREFERENCES as readonly string[]).includes(value)
}

export function isColorSchemeName(value: unknown): value is ColorSchemeName {
  return typeof value === "string" && (COLOR_SCHEMES as readonly string[]).includes(value)
}

export function resolveSchemeName(input: unknown): ColorSchemeName {
  return isColorSchemeName(input) ? input : DEFAULT_COLOR_SCHEME
}

export function resolveColorScheme(
  preference: AppearancePreference,
  system: ColorSchemeName | null | undefined,
): ColorSchemeName {
  if (preference === "system") return resolveSchemeName(system)
  return preference
}

interface SchemeExtras {
  sun700: string
  lilac100: string
  lilac300: string
  accentText: string
  glass: string
  glassBorder: string
  scrim: string
  scrimModal: string
  scrimStrong: string
  shadowColor: string
  onAccent: string
  onScrim: string
  stage: string
}

const EXTRAS: Readonly<Record<ColorSchemeName, SchemeExtras>> = {
  light: {
    sun700: "#A77B0A",
    lilac100: "#DED2F5",
    lilac300: "#BFA9EC",
    accentText: "#B03A2C",
    glass: "rgba(255,255,255,0.82)",
    glassBorder: "rgba(255,255,255,0.65)",
    scrim: "rgba(26,23,20,0.35)",
    scrimModal: "rgba(26,23,20,0.45)",
    scrimStrong: "rgba(26,23,20,0.55)",
    shadowColor: colorSchemes.light.neutral.ink,
    onAccent: "#FFFFFF",
    onScrim: "#FFFFFF",
    stage: "#000000",
  },
  dark: {
    sun700: "#F5D27A",
    lilac100: "#3A2F4C",
    lilac300: "#7B63B0",
    accentText: "#F79185",
    glass: "rgba(42,36,28,0.82)",
    glassBorder: "rgba(255,255,255,0.10)",
    scrim: "rgba(0,0,0,0.50)",
    scrimModal: "rgba(0,0,0,0.60)",
    scrimStrong: "rgba(0,0,0,0.70)",
    shadowColor: "#000000",
    onAccent: colorSchemes.dark.neutral.paper,
    onScrim: "#FFFFFF",
    stage: "#000000",
  },
}

export interface ThemeColors extends ColorPalette {
  sun: ColorPalette["sun"] & { "700": string }
  lilac: ColorPalette["lilac"] & { "100": string; "300": string }
  bg: string
  bgAlt: string
  surface: string
  surfaceTint: string
  text: string
  textMuted: string
  textSubtle: string
  border: string
  borderStrong: string
  accent: string
  accentText: string
  glass: string
  glassBorder: string
  scrim: string
  scrimModal: string
  scrimStrong: string
  shadowColor: string
  onAccent: string
  onScrim: string
  stage: string
}

export function makeThemeColors(scheme: ColorSchemeName): ThemeColors {
  const palette = colorSchemes[scheme]
  const extras = EXTRAS[scheme]
  return {
    ...palette,
    sun: { ...palette.sun, "700": extras.sun700 },
    lilac: { ...palette.lilac, "100": extras.lilac100, "300": extras.lilac300 },
    bg: palette.neutral.paper,
    bgAlt: palette.neutral.paper2,
    surface: palette.neutral.card,
    surfaceTint: palette.neutral.cardTint,
    text: palette.neutral.ink,
    textMuted: palette.neutral.ink2,
    textSubtle: palette.neutral.ink3,
    border: palette.neutral.ink5,
    borderStrong: palette.neutral.ink4,
    accent: palette.brand.bloom,
    accentText: extras.accentText,
    glass: extras.glass,
    glassBorder: extras.glassBorder,
    scrim: extras.scrim,
    scrimModal: extras.scrimModal,
    scrimStrong: extras.scrimStrong,
    shadowColor: extras.shadowColor,
    onAccent: extras.onAccent,
    onScrim: extras.onScrim,
    stage: extras.stage,
  }
}

export interface ThemeGlass {
  button: {
    fill: string
    fillFallback: string
    border: string
    blurIntensity: number
    sheen: string
  }
  active: { fill: string; icon: string }
  on: string
  sheet: {
    fill: string
    fillFallback: string
    blurIntensity: number
    sheen: string
    input: string
  }
  popover: { fill: string; fillFallback: string; border: string; blurIntensity: number }
  grabHandle: string
  dock: {
    fill: string
    fillFallback: string
    border: string
    blurIntensity: number
    sheen: string
    selected: string
    shadow: { color: string; offsetY: number; radius: number }
    height: number
    orbSize: number
    radius: number
  }
}

const GLASS: Readonly<Record<ColorSchemeName, Omit<ThemeGlass, "active" | "on">>> = {
  light: {
    button: {
      fill: "rgba(255,255,255,0.95)",
      fillFallback: "rgba(255,255,255,0.98)",
      border: "rgba(0,0,0,0.06)",
      blurIntensity: 28,
      sheen: "rgba(255,255,255,0.7)",
    },
    sheet: {
      fill: "rgba(252,250,246,0.78)",
      fillFallback: "rgba(252,250,246,0.94)",
      blurIntensity: 34,
      sheen: "rgba(255,255,255,0.6)",
      input: "rgba(120,120,128,0.12)",
    },
    popover: {
      fill: "rgba(255,255,255,0.96)",
      fillFallback: "rgba(255,255,255,0.99)",
      border: "rgba(0,0,0,0.06)",
      blurIntensity: 30,
    },
    grabHandle: "rgba(60,60,67,0.26)",
    dock: {
      fill: "rgba(253,250,244,0.62)",
      fillFallback: "rgba(253,250,244,0.92)",
      border: "rgba(255,255,255,0.9)",
      blurIntensity: 48,
      sheen: "rgba(255,255,255,0.8)",
      selected: "rgba(33,27,19,0.10)",
      shadow: { color: "rgba(33,27,19,0.14)", offsetY: 8, radius: 18 },
      height: 64,
      orbSize: 58,
      radius: 999,
    },
  },
  dark: {
    button: {
      fill: "rgba(44,38,30,0.92)",
      fillFallback: "rgba(44,38,30,0.98)",
      border: "rgba(255,255,255,0.08)",
      blurIntensity: 28,
      sheen: "rgba(255,255,255,0.10)",
    },
    sheet: {
      fill: "rgba(30,26,20,0.80)",
      fillFallback: "rgba(30,26,20,0.95)",
      blurIntensity: 34,
      sheen: "rgba(255,255,255,0.06)",
      input: "rgba(120,120,128,0.24)",
    },
    popover: {
      fill: "rgba(42,36,28,0.96)",
      fillFallback: "rgba(42,36,28,0.99)",
      border: "rgba(255,255,255,0.08)",
      blurIntensity: 30,
    },
    grabHandle: "rgba(235,235,245,0.30)",
    dock: {
      fill: "rgba(33,28,21,0.62)",
      fillFallback: "rgba(33,28,21,0.92)",
      border: "rgba(255,255,255,0.12)",
      blurIntensity: 48,
      sheen: "rgba(255,255,255,0.10)",
      selected: "rgba(241,234,224,0.12)",
      shadow: { color: "rgba(0,0,0,0.45)", offsetY: 8, radius: 18 },
      height: 64,
      orbSize: 58,
      radius: 999,
    },
  },
}

export function makeGlass(scheme: ColorSchemeName): ThemeGlass {
  const palette = colorSchemes[scheme]
  return {
    ...GLASS[scheme],
    active: { fill: palette.neutral.ink, icon: palette.neutral.card },
    on: palette.brand.bloom,
  }
}

export function shadowTokensFor(scheme: ColorSchemeName): ShadowTokens {
  return shadowSchemes[scheme]
}
