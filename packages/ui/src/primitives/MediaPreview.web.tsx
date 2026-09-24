import React from "react"
import { View, Image, StyleSheet } from "react-native"
import { type MediaPreviewProps, DEFAULT_ASPECT_RATIO } from "./MediaPreview.types"
import {
  MediaPreviewFallback,
  MediaPreviewVideoTag,
  useMediaPreviewFrameStyle,
  useMediaPreviewSource,
} from "./MediaPreview.shared"

const VIDEO_DOM_STYLE = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
} as const

export function MediaPreview({
  uri,
  kind,
  posterUri,
  thumbUri,
  aspectRatio = DEFAULT_ASPECT_RATIO,
  alt,
  framed = true,
  style,
}: MediaPreviewProps) {
  const frameStyle = useMediaPreviewFrameStyle({ aspectRatio, framed, style })
  const { label, source, failed, onError } = useMediaPreviewSource({ kind, uri, thumbUri, alt })

  if (failed) return <MediaPreviewFallback kind={kind} frameStyle={frameStyle} />

  if (kind === "video") {
    const videoEl = React.createElement("video", {
      src: uri,
      style: VIDEO_DOM_STYLE,
      controls: true,
      playsInline: true,
      onError,
      ...(posterUri ? { poster: posterUri } : {}),
      ...(label === "" ? { "aria-hidden": true } : { "aria-label": label }),
    })
    return (
      <View style={frameStyle}>
        {videoEl}
        <MediaPreviewVideoTag />
      </View>
    )
  }

  return (
    <View style={frameStyle}>
      <Image
        source={{ uri: source }}
        onError={onError}
        accessibilityLabel={label || undefined}
        aria-hidden={label === "" ? true : undefined}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
    </View>
  )
}
