import React from "react"
import { View, type StyleProp, type ViewStyle } from "react-native"
import { useTheme } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import type { MediaPreviewProps } from "./MediaPreview.types"
import { useMediaPreviewStyles } from "./MediaPreview.styles"

export interface MediaPreviewSource {
  label: string
  source: string
  failed: boolean
  onError: () => void
}

export function useMediaPreviewSource({
  kind,
  uri,
  thumbUri,
  alt,
}: Pick<MediaPreviewProps, "kind" | "uri" | "thumbUri" | "alt">): MediaPreviewSource {
  const { t } = useT("common")
  const label = alt ?? (kind === "video" ? t("media.video") : t("media.photo"))
  const source = kind === "image" && thumbUri ? thumbUri : uri
  const [failedUri, setFailedUri] = React.useState<string | null>(null)
  const onError = React.useCallback(() => setFailedUri(source), [source])
  return { label, source, failed: failedUri === source, onError }
}

export function useMediaPreviewFrameStyle({
  aspectRatio,
  framed,
  style,
}: {
  aspectRatio: number
  framed: boolean
  style: StyleProp<ViewStyle>
}): StyleProp<ViewStyle> {
  const styles = useMediaPreviewStyles()
  return [styles.frame, framed ? styles.framed : null, { aspectRatio }, style]
}

export function MediaPreviewFallback({
  kind,
  frameStyle,
}: {
  kind: MediaPreviewProps["kind"]
  frameStyle: StyleProp<ViewStyle>
}) {
  const styles = useMediaPreviewStyles()
  const th = useTheme()
  const { t } = useT("common")
  return (
    <View style={frameStyle}>
      <View style={styles.fallback}>
        <Icon icon={iconMap.ImageOff} size={22} color={th.colors.textSubtle} />
        <Text variant="caption" color={th.colors.textSubtle} style={styles.fallbackText}>
          {kind === "video" ? t("media.video_unavailable") : t("media.image_unavailable")}
        </Text>
      </View>
    </View>
  )
}

export function MediaPreviewVideoTag() {
  const styles = useMediaPreviewStyles()
  const th = useTheme()
  const { t } = useT("common")
  return (
    <View style={styles.videoTag}>
      <Icon icon={iconMap.Video} size={13} color={th.colors.onScrim} />
      <Text variant="caption" color={th.colors.onScrim} style={styles.videoTagText}>
        {t("media.video")}
      </Text>
    </View>
  )
}
