import React from "react"
import { View, Image, StyleSheet } from "react-native"
import { useTheme } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { type MediaPreviewProps, DEFAULT_ASPECT_RATIO } from "./MediaPreview.types"
import { useMediaPreviewStyles } from "./MediaPreview.styles"

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
  autoplay = false,
  alt,
  framed = true,
  style,
}: MediaPreviewProps) {
  const styles = useMediaPreviewStyles()
  const th = useTheme()
  const { t } = useT("common")
  const label = alt ?? (kind === "video" ? t("media.video") : t("media.photo"))
  const source = kind === "image" && thumbUri ? thumbUri : uri
  const [failedUri, setFailedUri] = React.useState<string | null>(null)
  const onError = React.useCallback(() => setFailedUri(source), [source])

  if (failedUri === source) {
    return (
      <View style={[styles.frame, framed ? styles.framed : null, { aspectRatio }, style]}>
        <View style={styles.fallback}>
          <Icon icon={iconMap.ImageOff} size={22} color={th.colors.textSubtle} />
          <Text variant="caption" color={th.colors.textSubtle} style={styles.fallbackText}>
            {kind === "video" ? t("media.video_unavailable") : t("media.image_unavailable")}
          </Text>
        </View>
      </View>
    )
  }

  if (kind === "video") {
    const videoEl = React.createElement("video", {
      src: uri,
      style: VIDEO_DOM_STYLE,
      controls: !autoplay,
      autoPlay: autoplay,
      loop: autoplay,
      muted: autoplay,
      playsInline: true,
      onError,
      ...(posterUri ? { poster: posterUri } : {}),
      ...(label === "" ? { "aria-hidden": true } : { "aria-label": label }),
    })
    return (
      <View style={[styles.frame, framed ? styles.framed : null, { aspectRatio }, style]}>
        {videoEl}
        <View style={styles.videoTag}>
          <Icon icon={iconMap.Video} size={13} color={th.colors.onScrim} />
          <Text variant="caption" color={th.colors.onScrim} style={styles.videoTagText}>
            {t("media.video")}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.frame, framed ? styles.framed : null, { aspectRatio }, style]}>
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
