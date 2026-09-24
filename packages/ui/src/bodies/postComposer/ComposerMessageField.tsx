import React, { useState } from "react"
import { Pressable, useWindowDimensions, View } from "react-native"
import type { TFunction } from "i18next"
import { TextInput } from "../../primitives/TextInput"
import { focusRingProps, useLayoutMode, useTheme, webInputReset } from "../../theme"
import { MentionAutocomplete } from "../../primitives"
import type { MentionCandidate } from "../../primitives"
import { ComposerThumbs } from "../../primitives/ComposerThumbs"
import { Icon, iconMap } from "../../typography"
import { POST_BODY_MAX_LENGTH } from "../postComposerModel"
import { usePostComposerStyles } from "./postComposerStyles"

/** The body grows with its text up to this share of the window, then scrolls inside itself. */
const INPUT_MAX_WINDOW_SHARE = 0.4

export function ComposerMessageField({
  t,
  body,
  placeholder,
  draftHidden,
  onChangeBody,
  onMention,
  thumbs,
  onRemoveMedia,
  canAttachMedia,
  onAttachMedia,
}: {
  t: TFunction
  body: string
  placeholder: string
  draftHidden: boolean
  onChangeBody: (body: string) => void
  onMention: (candidate: MentionCandidate, nextDraft: string) => void
  thumbs: React.ComponentProps<typeof ComposerThumbs>["attachments"]
  onRemoveMedia: (id: string) => void
  canAttachMedia: boolean
  onAttachMedia: () => void
}) {
  const styles = usePostComposerStyles()
  const th = useTheme()
  const expanded = useLayoutMode() === "expanded"
  const [bodyFocused, setBodyFocused] = useState(false)
  const { height: windowHeight } = useWindowDimensions()
  const inputMaxHeight = Math.round(windowHeight * INPUT_MAX_WINDOW_SHARE)
  return (
    <View style={styles.messageSection}>
      <View style={styles.composeRow}>
        <View
          style={[
            styles.inputWrap,
            styles.inputSurface,
            expanded && bodyFocused ? styles.inputSurfaceFocused : null,
          ]}
        >
          <TextInput
            accessibilityLabel={t("input_a11y")}
            value={body}
            onChangeText={onChangeBody}
            editable={!draftHidden}
            onFocus={() => setBodyFocused(true)}
            onBlur={() => setBodyFocused(false)}
            placeholder={placeholder}
            placeholderTextColor={th.colors.textSubtle}
            multiline
            maxLength={POST_BODY_MAX_LENGTH}
            autoFocus
            style={[expanded ? webInputReset : null, styles.input, { maxHeight: inputMaxHeight }]}
          />
          <MentionAutocomplete draft={body} onSelect={onMention} />
          <ComposerThumbs
            attachments={thumbs}
            onRemove={onRemoveMedia}
            style={styles.thumbsInCard}
          />
          <View style={styles.mediaRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("add_media_a11y")}
              accessibilityState={{ disabled: !canAttachMedia }}
              disabled={!canAttachMedia}
              onPress={onAttachMedia}
              hitSlop={6}
              {...focusRingProps}
              style={({ pressed }) => [
                styles.addMedia,
                !canAttachMedia ? styles.addMediaDisabled : null,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <View style={styles.addMediaDisc}>
                <Icon
                  icon={iconMap.Plus}
                  size={18}
                  color={canAttachMedia ? th.colors.accent : th.colors.textSubtle}
                  strokeWidth={2.2}
                />
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  )
}
