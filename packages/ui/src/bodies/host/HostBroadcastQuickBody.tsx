import React, { useCallback, useEffect, useState } from "react"
import { View, TextInput, Pressable } from "react-native"
import { MAX_BROADCAST_BODY, MAX_BROADCAST_SUBJECT } from "@civfix/shared"
import {
  focusRingProps,
  makeThemedStyles,
  useTheme,
  webCursor,
  webHover,
  webInputReset,
} from "../../theme"
import { Text, iconMap } from "../../typography"
import {
  ModalCardSheet,
  PrimaryButton,
  SecondaryButton,
  SegmentedControl,
  fieldFocusedStyle,
  useToast,
} from "../../primitives"
import { Markdown } from "../../primitives/Markdown"
import { useCleanup } from "../../data"
import { hasHostCapability, useQuickBroadcast } from "../../data/hooks/host"
import { useDashboardStore } from "./dashboard/dashboardStore"
import { useT } from "../../i18n"
import { useNavStore } from "../../nav"
import { useScrollHost } from "../../shell/ScrollHost"
import { FeedNotice } from "../FeedNotice"
import { appErrorCode } from "../errorCode"
import {
  QUICK_SEGMENT_KINDS,
  broadcastErrorKey,
  quickBroadcastReady,
  quickSegment,
  type QuickSegmentKind,
} from "./broadcastQuickModel"

const EMAIL_CHANNELS = ["email"] as const

export function HostBroadcastQuickBody({ id }: { id: string }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-broadcasts")
  const { ScrollView } = useScrollHost()
  const toast = useToast()

  const preset = useDashboardStore((s) => (s.broadcastPreset?.eventId === id ? s.broadcastPreset : null))

  const cleanup = useCleanup(id)
  const send = useQuickBroadcast(id, preset?.email ? { channels: EMAIL_CHANNELS } : {})

  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [segment, setSegment] = useState<QuickSegmentKind>(preset?.segment ?? "all_registered")
  const [preview, setPreview] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [focusedField, setFocusedField] = useState<"subject" | "body" | null>(null)

  const clearPreset = useDashboardStore((s) => s.setBroadcastPreset)
  useEffect(() => () => clearPreset(null), [clearPreset])

  const canBroadcast = hasHostCapability(cleanup.data, "broadcast")
  const ready = quickBroadcastReady(subject, body)

  const busy = send.isPending || send.discard.isPending

  const confirmAndSend = useCallback(() => {
    if (!ready || busy || !canBroadcast) return
    setConfirming(true)
  }, [busy, canBroadcast, ready])

  const submit = useCallback(() => {
    if (!ready || busy || !canBroadcast) return
    setConfirming(false)
    setErrorText(null)
    send.mutate(
      { subject: subject.trim(), bodyMd: body.trim(), segment: quickSegment(segment) },
      {
        onSuccess: (result) => {
          if (result.kind === "edits_lost") {
            setErrorText(t("quick.edits_lost"))
            return
          }
          toast.show(t("toast.sent"), { variant: "success" })
          useNavStore.getState().back()
        },
        onError: (err) => setErrorText(t(broadcastErrorKey(appErrorCode(err)))),
      },
    )
  }, [body, busy, canBroadcast, ready, segment, send, subject, t, toast])

  const discardDraft = useCallback(() => {
    if (busy || send.retainedDraft === null) return
    setErrorText(null)
    send.discard.mutate(undefined, {
      onSuccess: (result) => {
        if (result.kind === "already_sending") {
          setErrorText(t("quick.discard_already_sending"))
          return
        }
        toast.show(t("toast.discarded"), { variant: "info" })
      },
      onError: (err) => setErrorText(t(broadcastErrorKey(appErrorCode(err)))),
    })
  }, [busy, send, t, toast])

  if (cleanup.isError) {
    return (
      <View style={styles.fill}>
        <FeedNotice plain icon="CloudOff" title={t("state.error_title")} body={t("state.error_body")} />
      </View>
    )
  }

  if (cleanup.data && !canBroadcast) {
    return (
      <View style={styles.fill}>
        <FeedNotice plain icon="Lock" title={t("state.denied_title")} body={t("state.denied_body")} />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.caption}>{t("quick.caption")}</Text>

      <View style={styles.field}>
        <Text style={styles.label}>{t("quick.subject_label")}</Text>
        <TextInput
          value={subject}
          onChangeText={(next) => setSubject(next.slice(0, MAX_BROADCAST_SUBJECT))}
          editable={!busy}
          maxLength={MAX_BROADCAST_SUBJECT}
          placeholder={t("quick.subject_placeholder")}
          placeholderTextColor={th.colors.textSubtle}
          accessibilityLabel={t("quick.subject_label")}
          onFocus={() => setFocusedField("subject")}
          onBlur={() => setFocusedField(null)}
          style={[
            webInputReset,
            styles.input,
            focusedField === "subject" ? fieldFocusedStyle(th) : null,
          ]}
        />
      </View>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{t("quick.body_label")}</Text>
          <Pressable
            onPress={() => setPreview((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: preview }}
            accessibilityLabel={preview ? t("quick.preview_off_a11y") : t("quick.preview_on_a11y")}
            {...focusRingProps}
            style={(state) => [styles.toggle, webCursor(), webHover(state) ? styles.toggleHovered : null]}
          >
            <Text style={styles.toggleText}>{preview ? t("quick.edit") : t("quick.preview")}</Text>
          </Pressable>
        </View>
        {preview ? (
          <View style={styles.previewBox}>
            {body.trim().length > 0 ? (
              <Markdown source={body} />
            ) : (
              <Text style={styles.caption}>{t("quick.preview_empty")}</Text>
            )}
          </View>
        ) : (
          <TextInput
            value={body}
            onChangeText={(next) => setBody(next.slice(0, MAX_BROADCAST_BODY))}
            editable={!busy}
            maxLength={MAX_BROADCAST_BODY}
            multiline
            placeholder={t("quick.body_placeholder")}
            placeholderTextColor={th.colors.textSubtle}
            accessibilityLabel={t("quick.body_label")}
            onFocus={() => setFocusedField("body")}
            onBlur={() => setFocusedField(null)}
            style={[
              webInputReset,
              styles.input,
              styles.inputMultiline,
              focusedField === "body" ? fieldFocusedStyle(th) : null,
            ]}
          />
        )}
        <Text style={styles.caption}>{t("quick.markdown_hint")}</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t("quick.audience_label")}</Text>
        <SegmentedControl
          label={t("quick.audience_label")}
          options={QUICK_SEGMENT_KINDS.map((kind) => ({
            key: kind,
            label: t(`enums:broadcastSegment.${kind}`),
          }))}
          selected={segment}
          onSelect={(next) => setSegment(next as QuickSegmentKind)}
        />
      </View>

      {errorText ? (
        <Text style={styles.error} accessibilityRole="alert">
          {errorText}
        </Text>
      ) : null}
      {send.retainedDraft !== null && !send.isPending ? (
        <View style={styles.field}>
          <Text style={styles.caption}>{t("quick.retry_note")}</Text>
          <SecondaryButton
            label={t("quick.discard")}
            onPress={discardDraft}
            size="sm"
            disabled={busy}
          />
        </View>
      ) : null}

      <PrimaryButton
        label={t("quick.send")}
        icon={iconMap.Send}
        onPress={confirmAndSend}
        loading={send.isPending}
        disabled={!ready || !canBroadcast || busy}
      />
      <Text style={styles.caption}>
        {preset?.email ? t("quick.channels_email_note") : t("quick.channels_note")}
      </Text>

      <ModalCardSheet
        visible={confirming}
        onClose={() => setConfirming(false)}
        onCommit={submit}
        headerIcon="Megaphone"
        headerIconColor={th.colors.brand.bloom}
        title={t("confirm.title")}
        dismissLabel={t("confirm.dismiss_a11y")}
        backdropDismissDisabled={busy}
        actions={
          <>
            <SecondaryButton
              label={t("confirm.cancel")}
              onPress={() => setConfirming(false)}
              size="sm"
              disabled={busy}
            />
            <PrimaryButton label={t("confirm.send")} onPress={submit} loading={send.isPending} />
          </>
        }
      >
        <Text variant="caption" color={th.colors.textSubtle}>
          {t("confirm.subject", { subject: subject.trim() })}
        </Text>
        <Text variant="caption" color={th.colors.textSubtle}>
          {t("confirm.body", { audience: t(`enums:broadcastSegment.${segment}`) })}
        </Text>
      </ModalCardSheet>
    </ScrollView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  scroll: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
    gap: t.space["4"],
  },
  field: {
    gap: t.space["2"],
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.text,
  },
  caption: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  input: {
    minHeight: 44,
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["2"],
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  inputMultiline: {
    minHeight: 140,
    textAlignVertical: "top",
  },
  previewBox: {
    minHeight: 140,
    padding: t.space["3"],
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.bgAlt,
  },
  toggle: {
    paddingVertical: 4,
    paddingHorizontal: t.space["2"],
    borderRadius: t.radius.sm,
  },
  toggleHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  toggleText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["12"],
    color: t.colors.accentText,
  },
  error: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.dangerInk,
  },
}))
