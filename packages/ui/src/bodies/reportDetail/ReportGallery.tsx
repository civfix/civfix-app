import React, { useState } from "react"
import { View, Pressable, ScrollView, Image } from "react-native"
import type { ReportDTO } from "@civfix/shared"
import { useTheme, focusRingProps } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { MediaPreview } from "../../primitives"
import { useLightbox } from "../../lightbox"
import { useT } from "../../i18n"
import { clampGallerySelection, partitionGalleryMedia } from "./galleryModel"
import { GALLERY_ASPECT_RATIO, useGalleryStyles } from "./galleryStyles"
import { StatusTile } from "./StatusTile"
import { useReportDetailSharedStyles } from "./sharedStyles"

export function ReportGallery({
  report,
  onReportPhoto,
}: {
  report: ReportDTO
  onReportPhoto: (mediaId: string) => void
}) {
  const styles = useGalleryStyles()
  const shared = useReportDetailSharedStyles()
  const th = useTheme()
  const { t } = useT("report-detail")
  const pending = report.mediaPending ?? 0
  const { ready, ownerPending, ownerFailed, tileCount } = partitionGalleryMedia(report.media, pending)

  const { open } = useLightbox()
  const [selected, setSelected] = useState(0)
  const index = clampGallerySelection(selected, ready.length)
  const active = ready[index]
  const lightboxItems = ready.map((m) => ({
    url: m.url,
    kind: m.kind === "video" ? ("video" as const) : ("image" as const),
    thumbUrl: m.thumbUrl ?? null,
    width: m.width ?? null,
    height: m.height ?? null,
  }))

  if (!active) {
    if (ownerPending.length > 0 || pending > 0) {
      const total = ownerPending.length + pending
      return (
        <View style={styles.gallery}>
          <View style={styles.processingBlock}>
            <Icon icon={iconMap.Clock} size={26} color={th.colors.textSubtle} />
            <Text style={styles.processingTitle}>{t("gallery.processing_title")}</Text>
            <Text style={styles.processingBody}>{t("gallery.processing_body", { count: total })}</Text>
          </View>
        </View>
      )
    }
    if (ownerFailed.length > 0) {
      const first = ownerFailed[0]!
      return (
        <View style={styles.gallery}>
          <StatusTile kind={first.status === "rejected" ? "rejected" : "held"} variant="hero" />
        </View>
      )
    }
    return null
  }

  return (
    <View style={styles.gallery}>
      <View style={styles.heroWrap}>
        <Pressable
          onPress={() => open(lightboxItems, index)}
          accessibilityRole="button"
          accessibilityLabel={t("gallery.view_fullscreen_a11y")}
          {...focusRingProps}
          style={({ pressed }) => [styles.heroPress, pressed ? shared.pressed : null]}
        >
          <MediaPreview
            key={active.url}
            uri={active.url}
            kind={active.kind}
            posterUri={active.thumbUrl ?? undefined}
            aspectRatio={GALLERY_ASPECT_RATIO}
            style={styles.heroMedia}
          />
        </Pressable>
        {active.kind === "image" ? (
          <Pressable
            onPress={() => onReportPhoto(active.id)}
            accessibilityRole="button"
            accessibilityLabel={t("gallery.report_photo_a11y")}
            hitSlop={6}
            {...focusRingProps}
            style={({ pressed }) => [styles.photoReportBtn, pressed ? shared.pressed : null]}
          >
            <Icon icon={iconMap.Flag} size={14} color={th.colors.onScrim} />
          </Pressable>
        ) : null}
      </View>

      {tileCount > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
          style={styles.stripScroll}
        >
          {ready.map((m, i) => {
            const isActive = i === index
            const thumbUri = m.thumbUrl ?? m.url
            return (
              <Pressable
                key={m.id}
                onPress={() => setSelected(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={t("gallery.thumb_a11y", {
                  kind: m.kind,
                  index: i + 1,
                  total: ready.length,
                })}
                {...focusRingProps}
                style={({ pressed }) => [
                  styles.thumb,
                  isActive ? styles.thumbActive : null,
                  pressed ? shared.pressed : null,
                ]}
              >
                <Image source={{ uri: thumbUri }} style={styles.thumbImg} resizeMode="cover" />
                {m.kind === "video" ? (
                  <View style={styles.thumbVideoBadge} pointerEvents="none">
                    <Icon icon={iconMap.Video} size={12} color={th.colors.onScrim} />
                  </View>
                ) : null}
              </Pressable>
            )
          })}
          {ownerPending.map((m) => (
            <StatusTile key={m.id} kind="processing" variant="thumb" />
          ))}
          {ownerFailed.map((m) => (
            <StatusTile
              key={m.id}
              kind={m.status === "rejected" ? "rejected" : "held"}
              variant="thumb"
            />
          ))}
          {Array.from({ length: pending }, (_, i) => (
            <StatusTile key={`pending-${i}`} kind="processing" variant="thumb" />
          ))}
        </ScrollView>
      ) : null}
    </View>
  )
}
