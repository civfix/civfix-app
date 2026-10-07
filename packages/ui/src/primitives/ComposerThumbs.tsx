import React from "react"
import { View, Pressable, ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from "react-native"
import { makeThemedStyles, useTheme, focusRingProps, MIN_TOUCH_TARGET } from "../theme"
import { Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { MediaPreview } from "./MediaPreview"
import type { PendingAttachment } from "./useComposerAttachments"

export interface ComposerThumbsProps {
  attachments: PendingAttachment[]
  onRemove: (id: string) => void
  singleRow?: boolean
  style?: StyleProp<ViewStyle>
}

export function ComposerThumbs({ attachments, onRemove, singleRow = false, style }: ComposerThumbsProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("common")
  if (attachments.length === 0) return null
  return (
    <View style={[styles.thumbs, singleRow ? styles.thumbsSingleRow : null, style]}>
      {attachments.map((a, index) => (
        <View key={a.id} style={styles.thumb}>
          <MediaPreview
            uri={a.uri}
            kind={a.kind}
            posterUri={a.posterUri ?? null}
            aspectRatio={1}
            style={styles.thumbMedia}
          />
          {!a.uploadId ? (
            <View style={styles.thumbUploading}>
              <ActivityIndicator size="small" color={th.colors.onScrim} accessibilityLabel={t("media.uploading")} />
            </View>
          ) : null}
          <Pressable
            onPress={() => onRemove(a.id)}
            accessibilityRole="button"
            accessibilityLabel={t("media.remove_attachment_n", { index: index + 1, count: attachments.length })}
            hitSlop={THUMB_REMOVE_HIT_SLOP}
            {...focusRingProps}
            style={({ pressed }) => [styles.thumbRemove, pressed ? styles.pressed : null]}
          >
            <Icon icon={iconMap.Close} size={13} color={th.colors.bg} />
          </Pressable>
        </View>
      ))}
    </View>
  )
}

const THUMB_SIZE = 64
const THUMB_REMOVE_SIZE = 22
const THUMB_REMOVE_HIT_SLOP = {
  top: 0,
  right: 0,
  bottom: MIN_TOUCH_TARGET - THUMB_REMOVE_SIZE,
  left: MIN_TOUCH_TARGET - THUMB_REMOVE_SIZE,
}

const useStyles = makeThemedStyles((t) => ({
  thumbs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.space["2"],
  },
  thumbsSingleRow: {
    flexWrap: "nowrap",
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  thumbMedia: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: t.radius.md,
  },
  thumbUploading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.md,
    backgroundColor: t.colors.scrimModal,
  },
  thumbRemove: {
    position: "absolute",
    top: 0,
    right: 0,
    width: THUMB_REMOVE_SIZE,
    height: THUMB_REMOVE_SIZE,
    borderRadius: THUMB_REMOVE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
}))
