import React from "react"
import { Pressable, StyleSheet, View } from "react-native"
import type { TFunction } from "i18next"
import type { PostDTO } from "@civfix/shared"
import { MediaPreview } from "../primitives/MediaPreview"
import { focusRingProps, stopPress, webCursor } from "../theme"
import { useT } from "../i18n"

export function mediaAspect(media: PostDTO["media"][number]): number {
  return media.width && media.height ? media.width / media.height : 4 / 3
}

export function postMediaGridThumbUri(
  media: PostDTO["media"][number],
  split: boolean,
): string | null {
  return split ? media.thumbUrl ?? null : null
}

export interface PostMediaGridProps {
  media: PostDTO["media"]
  t?: TFunction
  radius?: number
  maxHeight?: number
  onPressItem?: (index: number) => void
}

export function PostMediaGrid({ media, t, radius, maxHeight, onPressItem }: PostMediaGridProps) {
  const { t: ownT } = useT("home-feed")
  const label = (t ?? ownT)("post_card.media_a11y")
  const frame = React.useMemo(
    () =>
      radius == null && maxHeight == null
        ? null
        : {
            ...(radius == null ? null : { borderRadius: radius }),
            ...(maxHeight == null ? null : { maxHeight }),
          },
    [radius, maxHeight],
  )
  if (media.length === 0) return null
  const items = media.slice(0, 4)
  const split = items.length > 1
  return (
    <View style={styles.mediaGrid}>
      {items.map((item, index) => {
        const preview = (
          <MediaPreview
            uri={item.url}
            kind={item.kind}
            posterUri={item.thumbUrl}
            thumbUri={postMediaGridThumbUri(item, split)}
            aspectRatio={split ? 1 : mediaAspect(item)}
            alt={label}
            style={frame}
          />
        )
        const cellStyle = split ? styles.mediaCellSplit : styles.mediaCellFull
        if (!onPressItem) {
          return (
            <View key={item.id} style={cellStyle}>
              {preview}
            </View>
          )
        }
        return (
          <Pressable
            key={item.id}
            onPress={(event) => {
              stopPress(event)
              onPressItem(index)
            }}
            accessibilityRole="imagebutton"
            accessibilityLabel={label}
            {...focusRingProps}
            style={(state) => [cellStyle, webCursor(false), state.pressed ? styles.pressed : null]}
          >
            {preview}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  mediaCellFull: {
    width: "100%",
  },
  mediaCellSplit: {
    width: "49%",
  },
  pressed: {
    opacity: 0.86,
  },
})
