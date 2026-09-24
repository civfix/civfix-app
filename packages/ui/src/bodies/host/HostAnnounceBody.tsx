import React, { useCallback, useMemo, useState } from "react"
import { Pressable, View } from "react-native"
import { MAX_ANNOUNCEMENT_BODY, MAX_ANNOUNCEMENT_TITLE, appErrorCode } from "@civfix/shared"
import { TextInput } from "../../primitives/TextInput"
import {
  focusRingProps,
  makeThemedStyles,
  MIN_TOUCH_TARGET,
  useTheme,
  webCursor,
  webHover,
  webInputReset,
} from "../../theme"
import { Icon, Text, iconMap } from "../../typography"
import { FilterChip, PrimaryButton, fieldFocusedStyle, useToast } from "../../primitives"
import { Markdown } from "../../primitives/Markdown"
import { useAuthState, useCleanup } from "../../data"
import { useDebouncedValue } from "../../data/hooks/useDebouncedValue"
import {
  AUDIENCE_PREVIEW_DEBOUNCE_MS,
  useAudiencePreview,
  useCreateAnnouncement,
} from "../../data/hooks/announcements"
import { cleanupHostStanding, hasHostCapability } from "../../data/hooks/host"
import { useT } from "../../i18n"
import { useNavStore } from "../../nav"
import { useScrollHost } from "../../shell/ScrollHost"
import { HostBodyState } from "./HostBodyState"
import {
  AUDIENCE_ICONS,
  AUDIENCE_OPTIONS,
  announcementErrorKey,
  announcementReady,
  audienceFor,
  audienceReady,
  bodyCounterVisible,
  type AnnouncementAudienceKindOption,
} from "./announcementModel"

const AUDIENCE_ICON_SIZE = 16

const TOGGLE_MIN_HEIGHT = 24

const COMPOSER_MIN_HEIGHT = 140

const TOGGLE_SLOP_Y = (MIN_TOUCH_TARGET - TOGGLE_MIN_HEIGHT) / 2

const TOGGLE_HIT_SLOP = { top: TOGGLE_SLOP_Y, bottom: TOGGLE_SLOP_Y }

export function HostAnnounceBody({ id }: { id: string }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("host-broadcasts")
  const { t: tEnums } = useT("enums")
  const { ScrollView } = useScrollHost()
  const toast = useToast()

  const cleanup = useCleanup(id)
  const create = useCreateAnnouncement(id)

  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [audienceKind, setAudienceKind] = useState<AnnouncementAudienceKindOption>("all_registered")
  const [slotIds, setSlotIds] = useState<readonly string[]>([])
  const [preview, setPreview] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [focusedField, setFocusedField] = useState<"title" | "body" | null>(null)

  const slots = cleanup.data?.slots ?? []
  const viewerId = useAuthState().user?.id ?? null
  const canBroadcast = hasHostCapability(cleanupHostStanding(cleanup.data, viewerId), "broadcast")
  const audience = useMemo(() => audienceFor(audienceKind, slotIds), [audienceKind, slotIds])
  const settled = useDebouncedValue(audience, AUDIENCE_PREVIEW_DEBOUNCE_MS)
  const recipients = useAudiencePreview(id, settled, {
    enabled: canBroadcast && audienceReady(settled.kind, settled.kind === "slots" ? settled.ids : []),
  })

  const ready =
    announcementReady(body) && audienceReady(audienceKind, slotIds) && !create.isPending

  const submit = useCallback(() => {
    if (!ready || !canBroadcast) return
    setErrorText(null)
    const trimmed = title.trim()
    create.mutate(
      {
        title: trimmed.length > 0 ? trimmed : null,
        bodyMd: body.trim(),
        audience,
      },
      {
        onSuccess: (announcement) => {
          toast.show(t("announce.sent_toast"), { variant: "success" })
          useNavStore.getState().back()
          useNavStore
            .getState()
            .push({ kind: "announcement", id, announcementId: announcement.id })
        },
        onError: (err) => setErrorText(t(announcementErrorKey(appErrorCode(err)))),
      },
    )
  }, [audience, body, canBroadcast, create, id, ready, t, title, toast])

  const toggleSlot = useCallback((slotId: string) => {
    setSlotIds((current) =>
      current.includes(slotId)
        ? current.filter((entry) => entry !== slotId)
        : [...current, slotId],
    )
  }, [])

  if (cleanup.isError) {
    return <HostBodyState state="error" t={t} />
  }

  if (cleanup.data && !canBroadcast) {
    return <HostBodyState state="denied" t={t} />
  }

  const count = recipients.data?.recipientCount ?? null
  const countLabel = recipients.isError
    ? t("announce.count_unknown")
    : count === null
      ? t("announce.count_loading")
      : t("announce.count", { total: count })
  const sendLabel =
    count === null ? t("announce.send") : t("announce.send_to", { total: count })

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.caption}>{t("announce.caption")}</Text>

      <View style={styles.field}>
        <Text style={styles.label}>{t("announce.title_label")}</Text>
        <TextInput
          value={title}
          onChangeText={(next) => setTitle(next.slice(0, MAX_ANNOUNCEMENT_TITLE))}
          editable={!create.isPending}
          maxLength={MAX_ANNOUNCEMENT_TITLE}
          placeholder={t("announce.title_placeholder")}
          placeholderTextColor={th.colors.textSubtle}
          accessibilityLabel={t("announce.title_label")}
          onFocus={() => setFocusedField("title")}
          onBlur={() => setFocusedField(null)}
          style={[
            webInputReset,
            styles.input,
            focusedField === "title" ? fieldFocusedStyle(th) : null,
          ]}
        />
      </View>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{t("announce.body_label")}</Text>
          <Pressable
            onPress={() => setPreview((value) => !value)}
            accessibilityRole="button"
            accessibilityState={{ expanded: preview }}
            accessibilityLabel={
              preview ? t("announce.preview_off_a11y") : t("announce.preview_on_a11y")
            }
            hitSlop={TOGGLE_HIT_SLOP}
            {...focusRingProps}
            style={(state) => [
              styles.toggle,
              webCursor(),
              webHover(state) ? styles.toggleHovered : null,
            ]}
          >
            <Text style={styles.toggleText}>
              {preview ? t("announce.edit") : t("announce.preview")}
            </Text>
          </Pressable>
        </View>
        {preview ? (
          <View style={styles.previewBox}>
            {body.trim().length > 0 ? (
              <Markdown source={body} />
            ) : (
              <Text style={styles.caption}>{t("announce.preview_empty")}</Text>
            )}
          </View>
        ) : (
          <TextInput
            value={body}
            onChangeText={(next) => setBody(next.slice(0, MAX_ANNOUNCEMENT_BODY))}
            editable={!create.isPending}
            maxLength={MAX_ANNOUNCEMENT_BODY}
            multiline
            placeholder={t("announce.body_placeholder")}
            placeholderTextColor={th.colors.textSubtle}
            accessibilityLabel={t("announce.body_label")}
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
        <View style={styles.labelRow}>
          <Text style={styles.caption}>{t("announce.markdown_hint")}</Text>
          {bodyCounterVisible(body.length) ? (
            <Text style={styles.caption}>
              {t("announce.body_counter", { used: body.length, max: MAX_ANNOUNCEMENT_BODY })}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t("announce.audience_label")}</Text>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t("announce.audience_label")}
          style={styles.options}
        >
          {AUDIENCE_OPTIONS.map((option) => {
            const selected = option === audienceKind
            return (
              <Pressable
                key={option}
                onPress={() => setAudienceKind(option)}
                disabled={create.isPending}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: create.isPending }}
                accessibilityLabel={tEnums(`broadcastSegment.${option}`)}
                {...focusRingProps}
                style={(state) => [
                  styles.option,
                  webCursor(),
                  webHover(state) ? styles.optionHovered : null,
                  selected ? styles.optionSelected : null,
                ]}
              >
                <Icon
                  icon={iconMap[AUDIENCE_ICONS[option]]}
                  size={AUDIENCE_ICON_SIZE}
                  color={selected ? th.colors.accentText : th.colors.textMuted}
                />
                <Text style={[styles.optionText, selected ? styles.optionTextSelected : null]}>
                  {tEnums(`broadcastSegment.${option}`)}
                </Text>
                {selected ? (
                  <Text variant="caption" numberOfLines={1}>
                    {countLabel}
                  </Text>
                ) : null}
              </Pressable>
            )
          })}
        </View>

        {audienceKind === "slots" ? (
          <View style={styles.slots}>
            {slots.length === 0 ? (
              <Text variant="caption">{t("announce.no_slots")}</Text>
            ) : (
              slots.map((slot) => (
                <FilterChip
                  key={slot.id}
                  label={slot.title}
                  selected={slotIds.includes(slot.id)}
                  selection="multiple"
                  onPress={() => toggleSlot(slot.id)}
                />
              ))
            )}
          </View>
        ) : null}
      </View>

      {errorText ? (
        <Text style={styles.error} accessibilityRole="alert">
          {errorText}
        </Text>
      ) : null}

      <PrimaryButton
        label={sendLabel}
        icon={iconMap.Megaphone}
        onPress={submit}
        loading={create.isPending}
        disabled={!ready || !canBroadcast}
      />
      <Text style={styles.caption}>
        {count === 0 ? t("announce.nobody_note") : t("announce.channels_note")}
      </Text>
    </ScrollView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  scroll: {
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
    gap: t.space["2"],
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
    minHeight: MIN_TOUCH_TARGET,
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
    minHeight: COMPOSER_MIN_HEIGHT,
    textAlignVertical: "top",
  },
  previewBox: {
    minHeight: COMPOSER_MIN_HEIGHT,
    padding: t.space["3"],
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.bgAlt,
  },
  toggle: {
    minHeight: TOGGLE_MIN_HEIGHT,
    justifyContent: "center",
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
  options: {
    gap: t.space["1"],
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  optionHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  optionSelected: {
    borderColor: t.colors.accent,
  },
  optionText: {
    flex: 1,
    minWidth: 0,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.text,
  },
  optionTextSelected: {
    color: t.colors.accentText,
  },
  slots: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.space["2"],
  },
  error: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.dangerInk,
  },
}))
