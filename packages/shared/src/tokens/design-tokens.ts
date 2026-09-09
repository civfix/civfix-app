
export const tokens = {
  color: {
    brand: {
      bloom: "#F0685C",
      moss: "#63A45A",
      sun: "#D9A21B",
      sunDark: "#B98A14",
      sky: "#74A9D8",
      lilac: "#9B7ED9",
    },
    bloom: {
      "50": "#FDEAE7",
      "100": "#FAD0CB",
      "300": "#F5A199",
      "500": "#F0685C",
      "600": "#E4574A",
      "700": "#C74537",
    },
    moss: {
      "50": "#EAF3E8",
      "100": "#CFE5CB",
      "300": "#98C790",
      "500": "#63A45A",
      "600": "#4C8A47",
      "700": "#2F7D46",
    },
    sun: {
      "50": "#F8EED3",
      "100": "#EDDCAC",
      "300": "#E7C155",
      "500": "#D9A21B",
      "600": "#B98A14",
      "700": "#81610E",
    },
    sky: {
      "50": "#E9F1FA",
      "100": "#CFE0F1",
      "300": "#A5C6E6",
      "500": "#74A9D8",
      "600": "#4E86BE",
      "700": "#356291",
    },
    lilac: {
      "50": "#F0EAFA",
      "500": "#9B7ED9",
      "600": "#7A5CC0",
      "700": "#7457B6",
    },
    chipInk: {
      bloom: "#BD4234",
      moss: "#2D7743",
      sun: "#81610E",
      sky: "#356291",
      lilac: "#7457B6",
    },
    neutral: {
      paper: "#EDE6D8",
      paper2: "#E5DDCD",
      card: "#FFFDF8",
      cardTint: "#F8F1E4",
      ink: "#211B13",
      ink2: "#5C5546",
      ink3: "#8D8577",
      ink4: "#BDB5A6",
      ink5: "#ECE5D8",
    },
    category: {
      trash: "#776C60",
      recycling: "#63A45A",
      graffiti: "#9B7ED9",
      hazard: "#E4574A",
      encampment: "#3E9E8E",
      water: "#74A9D8",
      other: "#8D8577",
    },
    cleanup: "#D9A21B",
  },
  scan: {
    qrInk: "#000000",
    qrPaper: "#FFFFFF",
  },
  font: {
    display: "Bricolage Grotesque",
    body: "Hanken Grotesk",
    mono: "JetBrains Mono",
  },
  fontSize: {
    "12": "0.75rem",
    "13": "0.8125rem",
    "14": "0.875rem",
    "15": "0.9375rem",
    "16": "1rem",
    "18": "1.125rem",
    "20": "1.25rem",
    "24": "1.5rem",
    "30": "1.875rem",
    "38": "2.375rem",
    "48": "3rem",
    "64": "4rem",
  },
  lineHeight: {
    tight: 1.05,
    snug: 1.2,
    base: 1.45,
    loose: 1.6,
  },
  tracking: {
    tight: "-0.02em",
    snug: "-0.01em",
    base: "0",
    wide: "0.06em",
  },
  space: {
    "1": 4,
    "2": 8,
    "3": 12,
    "4": 16,
    "5": 20,
    "6": 24,
    "8": 32,
    "10": 40,
    "12": 48,
    "16": 64,
  },
  radius: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 20,
    xl: 28,
    "2xl": 36,
    pill: 999,
    pin: "50% 50% 50% 6px",
  },
  shadow: {
    s1: "0 1px 0 rgba(26,23,20,0.04), 0 1px 2px rgba(26,23,20,0.05)",
    s2: "0 1px 0 rgba(26,23,20,0.03), 0 2px 4px rgba(26,23,20,0.04), 0 8px 16px -6px rgba(26,23,20,0.08)",
    s3: "0 1px 0 rgba(26,23,20,0.03), 0 4px 8px rgba(26,23,20,0.05), 0 18px 32px -10px rgba(26,23,20,0.12)",
    s4: "0 2px 4px rgba(26,23,20,0.05), 0 12px 20px rgba(26,23,20,0.08), 0 32px 56px -16px rgba(26,23,20,0.18)",
    pin: "0 6px 10px -2px rgba(240,104,92,0.45), 0 2px 4px rgba(26,23,20,0.20)",
    sheenTop: "inset 0 1px 0 rgba(255,255,255,0.6)",
    ring: "0 0 0 3px rgba(240,104,92,0.30)",
  },
  motion: {
    ease: {
      out: "cubic-bezier(0.22,1,0.36,1)",
      spring: "cubic-bezier(0.34,1.56,0.64,1)",
      inOut: "cubic-bezier(0.65,0,0.35,1)",
    },
    dur: {
      d1: 120,
      d2: 200,
      d3: 320,
      d4: 500,
    },
  },
} as const

export type Tokens = typeof tokens

type WidenLeaves<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : T[K] extends number ? number : WidenLeaves<T[K]>
}

export type ColorPalette = WidenLeaves<typeof tokens.color>
export type ShadowTokens = WidenLeaves<typeof tokens.shadow>
export type ColorSchemeName = "light" | "dark"

export const darkColor: ColorPalette = {
  brand: {
    bloom: "#F4796C",
    moss: "#78B56E",
    sun: "#E3B138",
    sunDark: "#F0C455",
    sky: "#8BB9E2",
    lilac: "#AE95E2",
  },
  bloom: {
    "50": "#3A211E",
    "100": "#4C2A26",
    "300": "#B25549",
    "500": "#F4796C",
    "600": "#F79185",
    "700": "#FAB0A7",
  },
  moss: {
    "50": "#1F2E1D",
    "100": "#2A3F27",
    "300": "#5E8F57",
    "500": "#78B56E",
    "600": "#93C78A",
    "700": "#A9D6A1",
  },
  sun: {
    "50": "#332A14",
    "100": "#4A3C18",
    "300": "#B08A28",
    "500": "#E3B138",
    "600": "#F0C455",
    "700": "#F5D480",
  },
  sky: {
    "50": "#1B2733",
    "100": "#243646",
    "300": "#5A87B0",
    "500": "#8BB9E2",
    "600": "#A6CAEA",
    "700": "#C2DBF1",
  },
  lilac: {
    "50": "#2B2438",
    "500": "#AE95E2",
    "600": "#C3B0EB",
    "700": "#D5C7F1",
  },
  chipInk: {
    bloom: "#FAB0A7",
    moss: "#A9D6A1",
    sun: "#F5D480",
    sky: "#C2DBF1",
    lilac: "#D5C7F1",
  },
  neutral: {
    paper: "#17130E",
    paper2: "#211C15",
    card: "#2A241C",
    cardTint: "#332C22",
    ink: "#F1EAE0",
    ink2: "#BDB4A4",
    ink3: "#948C7F",
    ink4: "#4F473C",
    ink5: "#332D25",
  },
  category: {
    trash: "#A89C8E",
    recycling: "#78B56E",
    graffiti: "#B79FE6",
    hazard: "#F4796C",
    encampment: "#5EBBAA",
    water: "#8BB9E2",
    other: "#A39B8D",
  },
  cleanup: "#E3B138",
}

export const darkShadow: ShadowTokens = {
  s1: "0 1px 0 rgba(0,0,0,0.25), 0 1px 2px rgba(0,0,0,0.35)",
  s2: "0 1px 0 rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.3), 0 8px 16px -6px rgba(0,0,0,0.45)",
  s3: "0 1px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.35), 0 18px 32px -10px rgba(0,0,0,0.55)",
  s4: "0 2px 4px rgba(0,0,0,0.35), 0 12px 20px rgba(0,0,0,0.45), 0 32px 56px -16px rgba(0,0,0,0.65)",
  pin: "0 6px 10px -2px rgba(244,121,108,0.45), 0 2px 4px rgba(0,0,0,0.50)",
  sheenTop: "inset 0 1px 0 rgba(255,255,255,0.08)",
  ring: "0 0 0 3px rgba(244,121,108,0.40)",
}

export const colorSchemes: Readonly<Record<ColorSchemeName, ColorPalette>> = {
  light: tokens.color,
  dark: darkColor,
}

export const shadowSchemes: Readonly<Record<ColorSchemeName, ShadowTokens>> = {
  light: tokens.shadow,
  dark: darkShadow,
}

export const color = tokens.color
export const font = tokens.font
export const fontSize = tokens.fontSize
export const lineHeight = tokens.lineHeight
export const tracking = tokens.tracking
export const space = tokens.space
export const radius = tokens.radius
export const shadow = tokens.shadow
export const motion = tokens.motion

export type CategoryColorKey = keyof typeof tokens.color.category

export const cleanupColor: string = tokens.color.cleanup

export const qrInk: string = tokens.scan.qrInk

export const qrPaper: string = tokens.scan.qrPaper

export function cleanupColorFor(scheme: ColorSchemeName): string {
  return colorSchemes[scheme].cleanup
}

export function categoryColor(
  category: CategoryColorKey | string,
  scheme: ColorSchemeName = "light",
): string {
  const map = colorSchemes[scheme].category as Record<string, string>
  return map[category] ?? colorSchemes[scheme].category.other
}
