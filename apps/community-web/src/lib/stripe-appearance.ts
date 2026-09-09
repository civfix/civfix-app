import { colorSchemes, tokens, type ColorSchemeName } from "@civfix/shared/tokens"
import type { Appearance } from "@stripe/stripe-js"

const FONT_STACK = `"${tokens.font.body}", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

export function stripeAppearance(scheme: ColorSchemeName): Appearance {
  const color = colorSchemes[scheme]
  return {
    theme: scheme === "dark" ? "night" : "stripe",
    variables: {
      fontFamily: FONT_STACK,
      fontSizeBase: tokens.fontSize["16"],
      fontWeightNormal: "400",
      fontWeightMedium: "500",
      fontWeightBold: "700",
      spacingUnit: `${tokens.space["1"]}px`,
      borderRadius: `${tokens.radius.sm}px`,
      colorPrimary: color.brand.bloom,
      colorBackground: color.neutral.card,
      colorText: color.neutral.ink,
      colorTextSecondary: color.neutral.ink2,
      colorTextPlaceholder: color.neutral.ink3,
      colorDanger: color.bloom["600"],
      colorSuccess: color.moss["600"],
      colorWarning: color.sun["600"],
      iconColor: color.neutral.ink2,
      accessibleColorOnColorPrimary: color.neutral.card,
    },
    rules: {
      ".Input": {
        border: `1px solid ${color.neutral.ink4}`,
        boxShadow: "none",
      },
      ".Input:focus": {
        border: `1px solid ${color.brand.bloom}`,
        boxShadow: tokens.shadow.ring,
      },
      ".Label": {
        color: color.neutral.ink2,
        fontWeight: "600",
      },
      ".Tab, .AccordionItem": {
        border: `1px solid ${color.neutral.ink4}`,
        boxShadow: "none",
      },
      ".Tab--selected, .AccordionItem--selected": {
        border: `1px solid ${color.brand.bloom}`,
      },
    },
  }
}
