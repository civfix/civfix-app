import React, { useMemo, useState } from "react"
import { View, Pressable } from "react-native"
import { timeLabel } from "@civfix/shared/datetime"
import {
  makeThemedStyles,
  useTheme,
  focusRingProps,
  webCursorPointer,
  webTransition,
  webHover,
} from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useLocale, useT } from "../i18n"
import { MIN_SLOT_DURATION_MS } from "./eventSlotsForm"

const GRID_STEP_MS = 30 * 60_000
const MAX_GRID_CHIPS = 96

type OpenEdge = "start" | "end" | null

export interface SlotWindowPickerProps {
  index: number
  eventStart: Date
  eventEnd: Date
  startsAt: Date
  endsAt: Date
  onChange: (next: { startsAt: Date; endsAt: Date }) => void
}

export function slotWindowChoices(from: Date, to: Date): Date[] {
  const first = from.getTime()
  const last = to.getTime()
  if (last < first) return []
  const out: Date[] = [new Date(first)]
  const probe = new Date(first)
  probe.setSeconds(0, 0)
  probe.setMinutes(probe.getMinutes() < 30 ? 30 : 60)
  for (let at = probe.getTime(); at <= last && out.length < MAX_GRID_CHIPS; at += GRID_STEP_MS) {
    if (at > first) out.push(new Date(at))
  }
  const tail = out[out.length - 1]
  if (tail && tail.getTime() !== last) out.push(new Date(last))
  return out
}

function clampWindow(
  start: Date,
  previous: { startsAt: Date; endsAt: Date },
  eventEnd: Date,
): { startsAt: Date; endsAt: Date } {
  const duration = Math.max(
    MIN_SLOT_DURATION_MS,
    previous.endsAt.getTime() - previous.startsAt.getTime(),
  )
  const latest = eventEnd.getTime()
  const end = Math.min(latest, start.getTime() + duration)
  return {
    startsAt: start,
    endsAt: new Date(Math.max(end, Math.min(latest, start.getTime() + MIN_SLOT_DURATION_MS))),
  }
}

function EdgeRow({
  label,
  value,
  a11y,
  open,
  onPress,
}: {
  label: string
  value: string
  a11y: string
  open: boolean
  onPress: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ expanded: open }}
      {...focusRingProps}
      style={(state) => [
        styles.edgeRow,
        webCursorPointer,
        webTransition,
        webHover(state) ? styles.edgeRowHovered : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      <Icon icon={iconMap.Clock} size={14} color={th.colors.textSubtle} />
      <Text style={styles.edgeLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.edgeValue} numberOfLines={1}>
        {value}
      </Text>
      <View style={open ? styles.caretOpen : null}>
        <Icon icon={iconMap.ChevronDown} size={14} color={th.colors.textSubtle} />
      </View>
    </Pressable>
  )
}

export function SlotWindowPicker({
  index,
  eventStart,
  eventEnd,
  startsAt,
  endsAt,
  onChange,
}: SlotWindowPickerProps) {
  const styles = useStyles()
  const { t } = useT("event-slots")
  const { locale } = useLocale()
  const [openEdge, setOpenEdge] = useState<OpenEdge>(null)

  const startChoices = useMemo(
    () => slotWindowChoices(eventStart, new Date(eventEnd.getTime() - MIN_SLOT_DURATION_MS)),
    [eventStart, eventEnd],
  )
  const endChoices = useMemo(
    () => slotWindowChoices(new Date(startsAt.getTime() + MIN_SLOT_DURATION_MS), eventEnd),
    [startsAt, eventEnd],
  )

  const choices = openEdge === "start" ? startChoices : openEdge === "end" ? endChoices : []
  const selectedMs = openEdge === "start" ? startsAt.getTime() : endsAt.getTime()

  const pick = (at: Date) => {
    if (openEdge === "start") onChange(clampWindow(at, { startsAt, endsAt }, eventEnd))
    else onChange({ startsAt, endsAt: at })
    setOpenEdge(null)
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.edges}>
        <EdgeRow
          label={t("editor.starts_label")}
          value={timeLabel(startsAt.toISOString(), locale)}
          a11y={t("editor.starts_a11y", { index })}
          open={openEdge === "start"}
          onPress={() => setOpenEdge((prev) => (prev === "start" ? null : "start"))}
        />
        <EdgeRow
          label={t("editor.ends_label")}
          value={timeLabel(endsAt.toISOString(), locale)}
          a11y={t("editor.ends_a11y", { index })}
          open={openEdge === "end"}
          onPress={() => setOpenEdge((prev) => (prev === "end" ? null : "end"))}
        />
      </View>

      {choices.length > 0 ? (
        <View style={styles.grid}>
          {choices.map((at) => {
            const selected = at.getTime() === selectedMs
            return (
              <Pressable
                key={at.toISOString()}
                onPress={() => pick(at)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                {...focusRingProps}
                style={(state) => [
                  styles.gridChip,
                  webCursorPointer,
                  webTransition,
                  selected ? styles.gridChipOn : null,
                  !selected && webHover(state) ? styles.gridChipHovered : null,
                  state.pressed ? styles.pressed : null,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.gridChipText, selected ? styles.gridChipTextOn : null]}
                >
                  {timeLabel(at.toISOString(), locale)}
                </Text>
              </Pressable>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  wrap: {
    gap: t.space["2"],
  },
  edges: {
    flexDirection: "row",
    gap: t.space["2"],
  },
  edgeRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["1"],
    minHeight: 44,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  edgeRowHovered: {
    backgroundColor: t.colors.surfaceTint,
    borderColor: t.colors.borderStrong,
  },
  edgeLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  edgeValue: {
    flex: 1,
    minWidth: 0,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.text,
  },
  caretOpen: {
    transform: [{ rotate: "180deg" }],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.space["1"],
  },
  gridChip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
  },
  gridChipOn: {
    backgroundColor: t.colors.selectedFill,
  },
  gridChipHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  gridChipText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.text,
  },
  gridChipTextOn: {
    color: t.colors.selectedInk,
  },
  pressed: {
    opacity: 0.85,
  },
}))
