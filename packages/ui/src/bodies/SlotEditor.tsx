import React, { useCallback, useState } from "react"
import { View, TextInput, Pressable, Platform, type TextStyle } from "react-native"
import {
  MAX_EVENT_SLOTS,
  MAX_SLOT_CAPACITY,
  MAX_SLOT_DESCRIPTION,
  MAX_SLOT_TITLE,
  type EventSlotDTO,
} from "@civfix/shared"
import {
  makeThemedStyles,
  radius,
  useTheme,
  webCursorPointer,
  webInputReset,
  webTransition,
  webHover,
  focusRingProps,
  FOCUS_RING_COLOR,
  FOCUS_RING_OFFSET,
  FOCUS_RING_WIDTH,
} from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import {
  addSlotDraft,
  makeSlotKey,
  moveSlotDraft,
  removeSlotDraft,
  removedClaimedCount,
  slotDraftError,
  updateSlotDraft,
  type SlotDraft,
  type SlotDraftError,
} from "./eventSlotsForm"

const ERROR_KEY: Record<Exclude<SlotDraftError, null>, string> = {
  "empty-title": "error.empty_title",
  "title-too-long": "error.title_too_long",
  "capacity-invalid": "error.capacity_invalid",
  "capacity-below-claimed": "error.capacity_below_claimed",
}

function bumpCapacity(raw: string, delta: 1 | -1): string {
  const parsed = Number.parseInt(raw.trim(), 10)
  const current = Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  const next = current + delta
  if (next < 1) return ""
  return String(Math.min(next, MAX_SLOT_CAPACITY))
}

const WEB_FIELD_RING: TextStyle =
  Platform.OS === "web"
    ? ({
        outlineStyle: "solid",
        outlineWidth: FOCUS_RING_WIDTH,
        outlineColor: FOCUS_RING_COLOR,
        outlineOffset: FOCUS_RING_OFFSET,
        borderRadius: radius.xs,
      } as unknown as TextStyle)
    : {}

export interface SlotEditorProps {
  value: SlotDraft[]
  onChange: (next: SlotDraft[]) => void
  existing?: readonly EventSlotDTO[]
}

function SlotCard({
  draft,
  index,
  total,
  claimed,
  onPatch,
  onRemove,
  onMove,
}: {
  draft: SlotDraft
  index: number
  total: number
  claimed: number | undefined
  onPatch: (key: string, patch: Partial<SlotDraft>) => void
  onRemove: (key: string) => void
  onMove: (key: string, direction: -1 | 1) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-slots")
  const [focusedField, setFocusedField] = useState<"title" | "description" | "capacity" | null>(null)
  const position = index + 1
  const error = slotDraftError(draft, claimed)
  const canMoveUp = index > 0
  const canMoveDown = index < total - 1

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.indexBadge}>
          <Text style={styles.indexBadgeText}>{String(position)}</Text>
        </View>
        <TextInput
          value={draft.title}
          onChangeText={(title) => onPatch(draft.key, { title })}
          accessibilityLabel={t("editor.title_a11y", { index: position })}
          placeholder={t("editor.title_placeholder")}
          placeholderTextColor={th.colors.textSubtle}
          selectionColor={th.colors.brand.bloom}
          maxLength={MAX_SLOT_TITLE}
          onFocus={() => setFocusedField("title")}
          onBlur={() => setFocusedField(null)}
          style={[styles.titleInput, webInputReset, focusedField === "title" ? WEB_FIELD_RING : null]}
        />
        <View style={styles.reorder}>
          <Pressable
            onPress={() => onMove(draft.key, -1)}
            disabled={!canMoveUp}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canMoveUp }}
            accessibilityLabel={t("editor.move_up_a11y", { index: position })}
            hitSlop={4}
            {...focusRingProps}
            style={(state) => [
              styles.reorderBtn,
              webCursorPointer,
              webTransition,
              !canMoveUp ? styles.disabled : null,
              webHover(state) && canMoveUp ? styles.iconBtnHovered : null,
              state.pressed && canMoveUp ? styles.pressed : null,
            ]}
          >
            <Icon icon={iconMap.ChevronUp} size={14} color={th.colors.textSubtle} />
          </Pressable>
          <Pressable
            onPress={() => onMove(draft.key, 1)}
            disabled={!canMoveDown}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canMoveDown }}
            accessibilityLabel={t("editor.move_down_a11y", { index: position })}
            hitSlop={4}
            {...focusRingProps}
            style={(state) => [
              styles.reorderBtn,
              webCursorPointer,
              webTransition,
              !canMoveDown ? styles.disabled : null,
              webHover(state) && canMoveDown ? styles.iconBtnHovered : null,
              state.pressed && canMoveDown ? styles.pressed : null,
            ]}
          >
            <Icon icon={iconMap.ChevronDown} size={14} color={th.colors.textSubtle} />
          </Pressable>
        </View>
        <Pressable
          onPress={() => onRemove(draft.key)}
          accessibilityRole="button"
          accessibilityLabel={t("editor.remove_a11y", { index: position })}
          hitSlop={6}
          {...focusRingProps}
          style={(state) => [
            styles.removeBtn,
            webCursorPointer,
            webTransition,
            webHover(state) ? styles.discHovered : null,
            state.pressed ? styles.pressed : null,
          ]}
        >
          <Icon icon={iconMap.Close} size={14} color={th.colors.textMuted} />
        </Pressable>
      </View>

      <TextInput
        value={draft.description}
        onChangeText={(description) => onPatch(draft.key, { description })}
        accessibilityLabel={t("editor.description_a11y", { index: position })}
        placeholder={t("editor.description_placeholder")}
        placeholderTextColor={th.colors.textSubtle}
        selectionColor={th.colors.brand.bloom}
        multiline
        numberOfLines={2}
        maxLength={MAX_SLOT_DESCRIPTION}
        onFocus={() => setFocusedField("description")}
        onBlur={() => setFocusedField(null)}
        style={[
          styles.descriptionInput,
          webInputReset,
          focusedField === "description" ? WEB_FIELD_RING : null,
        ]}
      />

      <View style={styles.capacityRow}>
        <Text style={styles.capacityLabel}>{t("editor.capacity_label")}</Text>
        <Pressable
          onPress={() => onPatch(draft.key, { capacity: bumpCapacity(draft.capacity, -1) })}
          accessibilityRole="button"
          accessibilityLabel={t("editor.capacity_less_a11y")}
          hitSlop={4}
          {...focusRingProps}
          style={(state) => [
            styles.stepBtn,
            webCursorPointer,
            webTransition,
            webHover(state) ? styles.discHovered : null,
            state.pressed ? styles.pressed : null,
          ]}
        >
          <Icon icon={iconMap.Minus} size={14} color={th.colors.textMuted} />
        </Pressable>
        <TextInput
          value={draft.capacity}
          onChangeText={(capacity) => onPatch(draft.key, { capacity })}
          accessibilityLabel={t("editor.capacity_a11y", { index: position })}
          placeholder={t("editor.capacity_any")}
          placeholderTextColor={th.colors.textSubtle}
          selectionColor={th.colors.brand.bloom}
          keyboardType="decimal-pad"
          maxLength={3}
          onFocus={() => setFocusedField("capacity")}
          onBlur={() => setFocusedField(null)}
          style={[styles.capacityInput, webInputReset, focusedField === "capacity" ? WEB_FIELD_RING : null]}
        />
        <Pressable
          onPress={() => onPatch(draft.key, { capacity: bumpCapacity(draft.capacity, 1) })}
          accessibilityRole="button"
          accessibilityLabel={t("editor.capacity_more_a11y")}
          hitSlop={4}
          {...focusRingProps}
          style={(state) => [
            styles.stepBtn,
            webCursorPointer,
            webTransition,
            webHover(state) ? styles.discHovered : null,
            state.pressed ? styles.pressed : null,
          ]}
        >
          <Icon icon={iconMap.Plus} size={14} color={th.colors.textMuted} />
        </Pressable>
        {claimed !== undefined && claimed > 0 ? (
          <Text style={styles.claimedCount} numberOfLines={1}>
            {t("editor.claimed_count", { count: claimed })}
          </Text>
        ) : null}
      </View>

      {error ? (
        <Text style={styles.errorLine}>
          {t(ERROR_KEY[error], { max: MAX_SLOT_TITLE, count: claimed ?? 0 })}
        </Text>
      ) : null}
    </View>
  )
}

export function SlotEditor({ value, onChange, existing = [] }: SlotEditorProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-slots")

  const onAdd = useCallback(() => {
    if (value.length >= MAX_EVENT_SLOTS) return
    onChange(addSlotDraft(value, makeSlotKey()))
  }, [onChange, value])

  const onPatch = useCallback(
    (key: string, patch: Partial<SlotDraft>) => onChange(updateSlotDraft(value, key, patch)),
    [onChange, value],
  )

  const onRemove = useCallback(
    (key: string) => onChange(removeSlotDraft(value, key)),
    [onChange, value],
  )

  const onMove = useCallback(
    (key: string, direction: -1 | 1) => {
      const next = moveSlotDraft(value, key, direction)
      if (next !== value) onChange(next)
    },
    [onChange, value],
  )

  const claimedById = new Map(existing.map((s) => [s.id, s.claimed]))
  const removedClaimed = removedClaimedCount(existing, value)

  if (value.length === 0) {
    return (
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel={t("editor.add_first_a11y")}
        {...focusRingProps}
        style={(state) => [
          styles.addRow,
          webCursorPointer,
          webTransition,
          webHover(state) ? styles.addRowHovered : null,
          state.pressed ? styles.pressed : null,
        ]}
      >
        <Icon icon={iconMap.ClipboardList} size={18} color={th.colors.textSubtle} />
        <Text style={styles.addRowText} numberOfLines={1}>
          {t("editor.add_first")}
        </Text>
        <View style={styles.addBtn}>
          <Icon icon={iconMap.Plus} size={18} color={th.colors.onAccent} />
        </View>
      </Pressable>
    )
  }

  return (
    <View style={styles.list}>
      {value.map((draft, index) => (
        <SlotCard
          key={draft.key}
          draft={draft}
          index={index}
          total={value.length}
          claimed={draft.id ? claimedById.get(draft.id) : undefined}
          onPatch={onPatch}
          onRemove={onRemove}
          onMove={onMove}
        />
      ))}

      {value.length < MAX_EVENT_SLOTS ? (
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          {...focusRingProps}
          style={(state) => [
            styles.addMore,
            webCursorPointer,
            webTransition,
            webHover(state) ? styles.addMoreHovered : null,
            state.pressed ? styles.pressed : null,
          ]}
        >
          <Icon icon={iconMap.Plus} size={14} color={th.colors.accentText} />
          <Text style={styles.addMoreText}>{t("editor.add_more")}</Text>
        </Pressable>
      ) : (
        <Text style={styles.capReached}>{t("editor.cap_reached", { max: MAX_EVENT_SLOTS })}</Text>
      )}

      {removedClaimed > 0 ? (
        <View style={styles.caution}>
          <Icon icon={iconMap.TriangleAlert} size={14} color={th.colors.bloom["700"]} />
          <Text style={styles.cautionText}>
            {t("editor.remove_warning", { count: removedClaimed })}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  list: {
    gap: t.space["2"],
  },

  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    minHeight: 52,
    paddingHorizontal: t.space["4"],
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  addRowText: {
    flex: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 15,
    color: t.colors.textSubtle,
  },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.brand.bloom,
  },

  card: {
    gap: t.space["2"],
    padding: t.space["3"],
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  indexBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
  },
  indexBadgeText: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    color: t.colors.textSubtle,
  },
  titleInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 15,
    color: t.colors.text,
    paddingVertical: 4,
  },
  reorder: {
    alignItems: "center",
  },
  iconBtnHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  discHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  addRowHovered: {
    backgroundColor: t.colors.surfaceTint,
    borderColor: t.colors.borderStrong,
  },
  addMoreHovered: {
    backgroundColor: t.colors.bloom["50"],
  },
  reorderBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
  },
  descriptionInput: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 13,
    color: t.colors.textMuted,
    minHeight: 34,
    textAlignVertical: "top",
  },
  capacityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  capacityLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: t.colors.textMuted,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
  },
  capacityInput: {
    width: 56,
    textAlign: "center",
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 14,
    color: t.colors.text,
    paddingVertical: 4,
  },
  claimedCount: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 11.5,
    color: t.colors.textSubtle,
  },
  errorLine: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12,
    color: t.colors.bloom["700"],
  },

  addMore: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: t.radius.pill,
  },
  addMoreText: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13,
    color: t.colors.accentText,
  },
  capReached: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    color: t.colors.textSubtle,
  },

  caution: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    padding: t.space["3"],
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.bloom["100"],
    backgroundColor: t.colors.bloom["50"],
  },
  cautionText: {
    flex: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: t.colors.bloom["700"],
  },

  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.85,
  },
}))
