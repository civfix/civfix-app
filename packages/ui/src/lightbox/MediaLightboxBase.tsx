import React, { useCallback, useContext } from "react"
import { Modal, View, Pressable, StyleSheet, useWindowDimensions } from "react-native"
import type { ModalProps, ViewProps } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import { makeThemedStyles, useTheme, webCursor, webTransition, focusRingProps, webScrimProps } from "../theme"
import { Icon, iconMap } from "../typography"
import { MediaPreview } from "../primitives/MediaPreview"
import { useT } from "../i18n"
import type { LightboxItem } from "./MediaLightbox.types"
import {
  LIGHTBOX_STAGE_MAX_WIDTH,
  LIGHTBOX_STAGE_PADDING_X,
  lightboxAspectRatio,
  lightboxControlOffsets,
  lightboxMediaHeight,
  lightboxMediaWidth,
} from "./lightboxStage"
import { ZoomableMedia } from "./ZoomableMedia"

export interface MediaLightboxViewProps {
  visible: boolean
  items: LightboxItem[]
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
}

export interface MediaLightboxBaseProps extends MediaLightboxViewProps {
  modalProps?: Partial<ModalProps>
  rootProps?: Partial<ViewProps>
}

export function MediaLightboxBase({
  visible,
  items,
  index,
  onIndexChange,
  onClose,
  modalProps,
  rootProps,
}: MediaLightboxBaseProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("lightbox")
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const insets = useContext(SafeAreaInsetsContext)
  const offsets = lightboxControlOffsets(insets)
  const count = items.length
  const current = count > 0 ? items[Math.min(Math.max(index, 0), count - 1)] : null
  const multi = count > 1
  const aspectRatio = lightboxAspectRatio(current)
  const mediaWidth = lightboxMediaWidth({ ratio: aspectRatio, windowWidth, windowHeight })
  const mediaHeight = lightboxMediaHeight(mediaWidth, aspectRatio)

  const goPrev = useCallback(() => {
    if (count < 2) return
    onIndexChange((index - 1 + count) % count)
  }, [count, index, onIndexChange])

  const goNext = useCallback(() => {
    if (count < 2) return
    onIndexChange((index + 1) % count)
  }, [count, index, onIndexChange])

  const media = current ? (
    <MediaPreview
      uri={current.url}
      kind={current.kind}
      posterUri={current.thumbUrl}
      aspectRatio={aspectRatio}
      framed={false}
      style={[styles.media, { width: mediaWidth }]}
    />
  ) : null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} {...modalProps}>
      <View style={styles.root} accessibilityViewIsModal {...rootProps}>
        <Pressable
          style={styles.scrim}
          accessibilityRole="button"
          accessibilityLabel={t("control.dismiss")}
          onPress={onClose}
          {...webScrimProps}
        />

        {current && current.kind === "image" ? (
          <ZoomableMedia
            contentWidth={mediaWidth}
            contentHeight={mediaHeight}
            viewportWidth={windowWidth}
            viewportHeight={windowHeight}
            resetToken={visible ? `${index}:${current.url}` : "closed"}
          >
            {media}
          </ZoomableMedia>
        ) : null}

        {current && current.kind !== "image" ? (
          <View style={styles.stage} pointerEvents="box-none">
            {media}
          </View>
        ) : null}

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("control.close")}
          {...focusRingProps}
          style={(state) => [styles.controlBase, offsets.close, webCursor(false), webTransition, state.pressed ? styles.controlPressed : null]}
        >
          <Icon icon={iconMap.Close} size={24} color={th.colors.onScrim} />
        </Pressable>

        {multi ? (
          <>
            <Pressable
              onPress={goPrev}
              accessibilityRole="button"
              accessibilityLabel={t("control.previous")}
              {...focusRingProps}
              style={(state) => [styles.controlBase, offsets.prev, webCursor(false), webTransition, state.pressed ? styles.controlPressed : null]}
            >
              <Icon icon={iconMap.ChevronLeft} size={28} color={th.colors.onScrim} />
            </Pressable>
            <Pressable
              onPress={goNext}
              accessibilityRole="button"
              accessibilityLabel={t("control.next")}
              {...focusRingProps}
              style={(state) => [styles.controlBase, offsets.next, webCursor(false), webTransition, state.pressed ? styles.controlPressed : null]}
            >
              <Icon icon={iconMap.ChevronRight} size={28} color={th.colors.onScrim} />
            </Pressable>
          </>
        ) : null}
      </View>
    </Modal>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.scrimLightbox,
  },
  stage: {
    width: "100%",
    maxWidth: LIGHTBOX_STAGE_MAX_WIDTH,
    paddingHorizontal: LIGHTBOX_STAGE_PADDING_X,
    alignItems: "center",
    justifyContent: "center",
  },
  media: {
    backgroundColor: "transparent",
  },
  controlBase: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: t.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.scrimStrong,
  },
  controlPressed: {
    opacity: 0.7,
  },
}))
