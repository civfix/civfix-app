import React from "react"
import Svg, { Path } from "react-native-svg"
import type { SocialPlatform } from "@civfix/shared"
import { SOCIAL_GLYPH_PATHS, SOCIAL_GLYPH_VIEWBOX } from "./socialLinksModel"

export interface SocialGlyphProps {
  platform: SocialPlatform
  size?: number
  color: string
}

export function SocialGlyph({ platform, size = 20, color }: SocialGlyphProps) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${SOCIAL_GLYPH_VIEWBOX} ${SOCIAL_GLYPH_VIEWBOX}`}>
      <Path d={SOCIAL_GLYPH_PATHS[platform]} fill={color} />
    </Svg>
  )
}
