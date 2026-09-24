import React from "react"
import { View, Image, StyleSheet } from "react-native"
import Video from "react-native-video"
import { type MediaPreviewProps, DEFAULT_ASPECT_RATIO } from "./MediaPreview.types"
import {
  MediaPreviewFallback,
  MediaPreviewVideoTag,
  useMediaPreviewFrameStyle,
  useMediaPreviewSource,
} from "./MediaPreview.shared"

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
    return (
      <View style={frameStyle}>
        <Video
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          controls
          paused
          repeat={false}
          muted={false}
          onError={onError}
          accessibilityLabel={label || undefined}
          importantForAccessibility={label === "" ? "no" : undefined}
          {...(posterUri ? { poster: { source: { uri: posterUri } } } : {})}
        />
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
        importantForAccessibility={label === "" ? "no" : undefined}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
    </View>
  )
}
