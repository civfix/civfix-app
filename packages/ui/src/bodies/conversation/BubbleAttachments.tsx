import React from "react"
import { View, Pressable } from "react-native"
import type { MediaDTO } from "@civfix/shared"
import { useTheme, webCursorPointer, webTransition, webHover, focusRingProps } from "../../theme"
import { Icon, iconMap } from "../../typography"
import { MediaPreview } from "../../primitives"
import { useLightbox } from "../../lightbox"
import { useT } from "../../i18n"
import { BUBBLE_LONG_PRESS_MS } from "./conversationModel"
import { useBubbleStyles } from "./bubbleStyles"

export const BubbleAttachments = React.memo(function BubbleAttachments({
  attachments,
  mine,
  onReportPhoto,
  onLongPress,
}: {
  attachments: MediaDTO[] | null | undefined
  mine: boolean
  onReportPhoto?: (mediaId: string) => void
  onLongPress?: () => void
}) {
  const styles = useBubbleStyles()
  const th = useTheme()
  const { open } = useLightbox()
  const { t } = useT("conversation")
  if (!attachments || attachments.length === 0) return null
  const lightboxItems = attachments.map((m) => ({
    url: m.url,
    kind: m.kind === "video" ? ("video" as const) : ("image" as const),
    thumbUrl: m.thumbUrl ?? null,
    width: m.width ?? null,
    height: m.height ?? null,
  }))
  return (
    <View style={[styles.attachments, mine ? styles.attachmentsMine : styles.attachmentsTheirs]}>
      {attachments.map((m, i) => {
        const canReportPhoto = !mine && !!onReportPhoto && m.kind !== "video"
        return (
          <View key={m.id} style={styles.attachmentWrap}>
            <Pressable
              onPress={() => open(lightboxItems, i)}
              onLongPress={onLongPress}
              delayLongPress={BUBBLE_LONG_PRESS_MS}
              accessibilityRole="button"
              accessibilityLabel={t("attachment.view")}
              {...focusRingProps}
              style={styles.attachmentTap}
            >
              <MediaPreview
                uri={m.url}
                kind={m.kind === "video" ? "video" : "image"}
                posterUri={m.thumbUrl ?? null}
                thumbUri={m.thumbUrl ?? null}
                aspectRatio={4 / 3}
                style={styles.attachment}
              />
            </Pressable>
            {canReportPhoto ? (
              <Pressable
                onPress={() => onReportPhoto?.(m.id)}
                accessibilityRole="button"
                accessibilityLabel={t("attachment.report_photo")}
                hitSlop={6}
                {...focusRingProps}
                style={(state) => [
                  styles.photoReportBtn,
                  webTransition,
                  webCursorPointer,
                  webHover(state) ? styles.photoReportBtnHovered : null,
                  state.pressed ? styles.pressed : null,
                ]}
              >
                <Icon icon={iconMap.Flag} size={13} color={th.colors.onScrim} />
              </Pressable>
            ) : null}
          </View>
        )
      })}
    </View>
  )
})
