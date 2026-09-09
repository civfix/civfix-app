import React from "react"
import { Text as RNText, type TextProps, type TextStyle } from "react-native"
import {
  themes,
  useColorSchemeName,
  webSelectableText,
  type ColorSchemeName,
  type Theme,
} from "../theme"

type Variant =
  | "display"
  | "title"
  | "heading"
  | "body"
  | "bodyStrong"
  | "label"
  | "caption"
  | "mono"

type VariantStyles = Record<Variant, TextStyle>

function makeVariantStyles(t: Theme): VariantStyles {
  return {
    display: {
      fontFamily: t.fontFamily.displayBold,
      fontSize: t.fontSize["30"],
      color: t.colors.text,
      letterSpacing: -0.6,
    },
    title: {
      fontFamily: t.fontFamily.displaySemiBold,
      fontSize: t.fontSize["20"],
      color: t.colors.text,
      letterSpacing: -0.3,
    },
    heading: {
      fontFamily: t.fontFamily.displaySemiBold,
      fontSize: t.fontSize["16"],
      color: t.colors.text,
    },
    body: {
      fontFamily: t.fontFamily.bodyRegular,
      fontSize: t.fontSize["15"],
      color: t.colors.text,
    },
    bodyStrong: {
      fontFamily: t.fontFamily.bodySemiBold,
      fontSize: t.fontSize["15"],
      color: t.colors.text,
    },
    label: {
      fontFamily: t.fontFamily.bodyMedium,
      fontSize: t.fontSize["13"],
      color: t.colors.textMuted,
    },
    caption: {
      fontFamily: t.fontFamily.bodyRegular,
      fontSize: t.fontSize["12"],
      color: t.colors.textSubtle,
    },
    mono: {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize["13"],
      color: t.colors.text,
    },
  }
}

const VARIANT_STYLES: Record<ColorSchemeName, VariantStyles> = {
  light: makeVariantStyles(themes.light),
  dark: makeVariantStyles(themes.dark),
}

function withSelect(styles: VariantStyles): Record<Variant, [TextStyle, TextStyle]> {
  return {
    display: [styles.display, webSelectableText],
    title: [styles.title, webSelectableText],
    heading: [styles.heading, webSelectableText],
    body: [styles.body, webSelectableText],
    bodyStrong: [styles.bodyStrong, webSelectableText],
    label: [styles.label, webSelectableText],
    caption: [styles.caption, webSelectableText],
    mono: [styles.mono, webSelectableText],
  }
}

const VARIANT_STYLES_WITH_SELECT: Record<
  ColorSchemeName,
  Record<Variant, [TextStyle, TextStyle]>
> = {
  light: withSelect(VARIANT_STYLES.light),
  dark: withSelect(VARIANT_STYLES.dark),
}

export interface AppTextProps extends TextProps {
  variant?: Variant
  color?: string
}

function TextImpl({ variant = "body", color, style, ...rest }: AppTextProps) {
  const scheme = useColorSchemeName()
  const flat =
    color || style
      ? [VARIANT_STYLES[scheme][variant], webSelectableText, color ? { color } : null, style]
      : VARIANT_STYLES_WITH_SELECT[scheme][variant]
  return <RNText {...rest} style={flat} />
}

export const Text = React.memo(TextImpl)
