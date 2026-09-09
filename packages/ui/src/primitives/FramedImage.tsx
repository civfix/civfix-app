import React from "react"
import { Image, type ImageProps } from "react-native"
import { useTheme } from "../theme"

export interface FramedImageProps extends ImageProps {
  framed?: boolean
}

export function FramedImage({ framed = true, style, ...rest }: FramedImageProps) {
  const t = useTheme()
  return <Image {...rest} style={[framed ? t.imageFrame : null, style]} />
}
