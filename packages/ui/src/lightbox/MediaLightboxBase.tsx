import React, { useCallback, useContext } from "react"
import { Modal, View, Pressable, StyleSheet, useWindowDimensions } from "react-native"
import type { ModalProps, ViewProps } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import {
  makeThemedStyles,
  useTheme,
  webCursor,
  webTransition,
  focusRingProps,
  webScrimProps,
  PRESSED_OPACITY,
} from "../theme"
import { Icon, iconMap, type LucideIcon } from "../typography"
import { MIN_TOUCH_TARGET } from "../typography/TextLink"
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
  stepIndex,
  type LightboxControlOffsets,
} from "./lightboxStage"
import { ZoomableMedia } from "./ZoomableMedia"

const CLOSE_ICON_SIZE = 24
const CHEVRON_ICON_SIZE = 28

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
    onIndexChange(stepIndex(index, -1, count))
  }, [count, index, onIndexChange])

  const goNext = useCallback(() => {
    if (count < 2) return
    onIndexChange(stepIndex(index, 1, count))
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

        <LightboxControl
          onPress={onClose}
          label={t("control.close")}
          offset={offsets.close}
          icon={iconMap.Close}
          iconSize={CLOSE_ICON_SIZE}
          iconColor={th.colors.onScrim}
        />

        {multi ? (
          <>
            <LightboxControl
              onPress={goPrev}
              label={t("control.previous")}
              offset={offsets.prev}
              icon={iconMap.ChevronLeft}
              iconSize={CHEVRON_ICON_SIZE}
              iconColor={th.colors.onScrim}
            />
            <LightboxControl
              onPress={goNext}
              label={t("control.next")}
              offset={offsets.next}
              icon={iconMap.ChevronRight}
              iconSize={CHEVRON_ICON_SIZE}
              iconColor={th.colors.onScrim}
            />
          </>
        ) : null}
      </View>
    </Modal>
  )
}

interface LightboxControlProps {
  onPress: () => void
  label: string
  offset: LightboxControlOffsets[keyof LightboxControlOffsets]
  icon: LucideIcon
  iconSize: number
  iconColor: string
}

function LightboxControl({ onPress, label, offset, icon, iconSize, iconColor }: LightboxControlProps) {
  const styles = useStyles()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...focusRingProps}
      style={(state) => [styles.controlBase, offset, webCursor(false), webTransition, state.pressed ? styles.controlPressed : null]}
    >
      <Icon icon={icon} size={iconSize} color={iconColor} />
    </Pressable>
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
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: t.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.lightboxControl,
  },
  controlPressed: {
    opacity: PRESSED_OPACITY,
  },
}))
