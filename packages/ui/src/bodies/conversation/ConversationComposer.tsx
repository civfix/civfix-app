import React from "react"
import { View, Pressable, TextInput } from "react-native"
import type { StyleProp, ViewStyle } from "react-native"
import { MESSAGE_BODY_MAX } from "@civfix/shared"
import { focusRingProps, useTheme, webInputReset } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { ComposerModeBar, MentionAutocomplete, ComposerAttachSheet, PollCreateSheet, usePopoverAnchor } from "../../primitives"
import type { AnchorRect, PollCreateInput } from "../../primitives"
import { ComposerThumbs } from "../../primitives/ComposerThumbs"
import { useT } from "../../i18n"
import { resolveComposerSubmit } from "../composerSubmit"
import type { MentionSource } from "../mentionSource"
import { senderColor } from "./conversationModel"
import type { ComposerModeState } from "./useComposerMode"
import { useConversationStyles } from "./styles"

export function ConversationComposer({
  composer,
  disabled,
  placeholder,
  mentionSource,
  canCreatePoll,
  onCreatePoll,
  pollCreatePending,
  pollCreateError,
  style,
}: {
  composer: ComposerModeState
  disabled: boolean
  placeholder: string
  mentionSource: MentionSource
  canCreatePoll: boolean
  onCreatePoll: (input: PollCreateInput) => Promise<boolean>
  pollCreatePending: boolean
  pollCreateError: string | null
  style?: StyleProp<ViewStyle>
}) {
  const styles = useConversationStyles()
  const th = useTheme()
  const { t } = useT("conversation")
  const { draft, composerMode, editPending, submitMode, att, grow } = composer
  const [attachOpen, setAttachOpen] = React.useState(false)
  const [attachAnchor, setAttachAnchor] = React.useState<AnchorRect | null>(null)
  const { ref: plusRef, measure: measurePlus } = usePopoverAnchor((rect) => {
    setAttachAnchor(rect)
    setAttachOpen(true)
  })
  const [pollCreateOpen, setPollCreateOpen] = React.useState(false)
  const [inputFocused, setInputFocused] = React.useState(false)
  const submitPreview = resolveComposerSubmit(
    submitMode,
    draft,
    att.attachments.length > 0 && att.allUploaded,
  )
  const canSend =
    !disabled &&
    submitPreview.action !== "noop" &&
    (composerMode?.kind === "edit" ? !editPending : !att.uploading)
  const attachDisabled = disabled || composerMode?.kind === "edit"

  return (
    <View style={[styles.composer, style]}>
      {!disabled ? (
        <MentionAutocomplete
          draft={draft}
          onSelect={composer.onPickMention}
          candidates={mentionSource.candidates}
          extraCandidates={mentionSource.extraCandidates}
          style={styles.mentionTray}
        />
      ) : null}

      {!disabled && composerMode?.kind !== "edit" ? (
        <ComposerThumbs
          attachments={att.attachments}
          onRemove={att.removeAttachment}
          style={styles.composerThumbs}
        />
      ) : null}
      {att.attachError && !disabled ? (
        <View style={styles.composerAttachError}>
          <Icon icon={iconMap.AlertCircle} size={13} color={th.colors.bloom["600"]} />
          <Text variant="caption" color={th.colors.bloom["600"]} numberOfLines={2}>
            {att.attachError}
          </Text>
        </View>
      ) : null}

      {composerMode ? (() => {
        const target = composerMode.message
        const excerptBody = (target.body ?? "").replace(/\s+/g, " ").trim()
        if (composerMode.kind === "edit") {
          return (
            <ComposerModeBar
              mode="edit"
              title={t("composer.edit_title")}
              excerpt={excerptBody}
              onCancel={composer.cancelComposerMode}
            />
          )
        }
        return (
          <ComposerModeBar
            mode="reply"
            title={t("composer.reply_title", { name: target.from?.name ?? t("bubble.reply_unknown_author") })}
            excerpt={excerptBody || t("bubble.reply_media")}
            accentColor={target.from ? senderColor(target.from.id) : undefined}
            onCancel={composer.cancelComposerMode}
          />
        )
      })() : null}

      <View style={styles.composerField}>
        <Pressable
          ref={plusRef}
          onPress={measurePlus}
          disabled={attachDisabled}
          accessibilityRole="button"
          accessibilityLabel={t("composer.attach")}
          accessibilityState={{ disabled: attachDisabled }}
          hitSlop={6}
          {...focusRingProps}
          style={({ pressed }) => [
            styles.iconBtn,
            pressed ? styles.pressed : null,
            attachDisabled ? styles.iconBtnDisabled : null,
          ]}
        >
          <Icon icon={iconMap.Plus} size={22} color={th.colors.textSubtle} />
        </Pressable>
        <TextInput
          ref={grow.ref}
          value={draft}
          onChangeText={composer.onChangeDraft}
          placeholder={placeholder}
          placeholderTextColor={th.colors.textSubtle}
          style={[
            webInputReset,
            styles.input,
            inputFocused ? styles.inputFocused : null,
            { height: grow.height },
          ]}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          onContentSizeChange={grow.onContentSizeChange}
          multiline
          textAlignVertical="center"
          editable={!disabled && !editPending}
          maxLength={MESSAGE_BODY_MAX}
          onSubmitEditing={composer.onSend}
          blurOnSubmit={false}
          {...(composer.onComposerKeyPress ? { onKeyPress: composer.onComposerKeyPress } : {})}
          accessibilityLabel={t("composer.input")}
        />
        <Pressable
          onPress={composer.onSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={composerMode?.kind === "edit" ? t("composer.edit_title") : t("composer.send")}
          accessibilityState={{ disabled: !canSend }}
          {...focusRingProps}
          style={({ pressed }) => [
            styles.sendBtn,
            canSend ? styles.sendBtnActive : styles.sendBtnIdle,
            pressed && canSend ? styles.sendBtnPressed : null,
          ]}
        >
          <Icon icon={composerMode?.kind === "edit" ? iconMap.Check : iconMap.ArrowUp} size={19} color={th.colors.onAccent} />
        </Pressable>
      </View>

      <ComposerAttachSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        anchor={attachAnchor}
        canCreatePoll={canCreatePoll}
        onPhoto={att.onAttach}
        onCamera={att.onCapture}
        onPoll={() => setPollCreateOpen(true)}
      />
      <PollCreateSheet
        visible={pollCreateOpen}
        pending={pollCreatePending}
        error={pollCreateError}
        onCreate={(input) => {
          void onCreatePoll(input).then((ok) => {
            if (ok) setPollCreateOpen(false)
          })
        }}
        onClose={() => setPollCreateOpen(false)}
      />
    </View>
  )
}

export function ChannelPillBar({
  mode,
  muted,
  onToggleMute,
  mutePending,
  onJoin,
  joinPending,
  style,
}: {
  mode: "mute-pill" | "join-pill"
  muted: boolean
  onToggleMute: () => void
  mutePending: boolean
  onJoin: () => void
  joinPending: boolean
  style?: StyleProp<ViewStyle>
}) {
  const styles = useConversationStyles()
  const th = useTheme()
  const { t } = useT("conversation")
  return (
    <View style={[styles.channelPillBar, style]}>
      {mode === "join-pill" ? (
        <Pressable
          onPress={onJoin}
          disabled={joinPending}
          accessibilityRole="button"
          accessibilityLabel={t("channel.join")}
          accessibilityState={{ disabled: joinPending }}
          {...focusRingProps}
          style={({ pressed }) => [
            styles.channelPill,
            styles.channelPillJoin,
            pressed || joinPending ? styles.pressed : null,
          ]}
        >
          <Icon icon={iconMap.Megaphone} size={16} color={th.colors.onAccent} />
          <Text style={styles.channelPillJoinText}>{t("channel.join")}</Text>
        </Pressable>
      ) : (
        <>
          <Text style={styles.channelPillCaption} numberOfLines={1}>
            {t("channel.read_only")}
          </Text>
          <Pressable
            onPress={onToggleMute}
            disabled={mutePending}
            accessibilityRole="button"
            accessibilityLabel={muted ? t("channel.unmute") : t("channel.mute")}
            {...focusRingProps}
            style={({ pressed }) => [
              styles.channelPill,
              pressed || mutePending ? styles.pressed : null,
            ]}
          >
            <Icon icon={iconMap[muted ? "Bell" : "BellOff"]} size={16} color={th.colors.text} />
            <Text style={styles.channelPillText}>{muted ? t("channel.unmute") : t("channel.mute")}</Text>
          </Pressable>
        </>
      )}
    </View>
  )
}
