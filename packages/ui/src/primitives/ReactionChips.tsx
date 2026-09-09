import React from "react"
import { View, Pressable, StyleSheet } from "react-native"
import type { ReactionEmoji, ReactionSummaryDTO } from "@civfix/shared"
import {
  makeThemedStyles,
  webCursorPointer,
  webTransition,
  webHover,
  webNoSelect,
  focusRingProps,
} from "../theme"
import { alpha } from "../theme/alpha"
import { Text } from "../typography"
import { useT } from "../i18n"
import { buildReactionChipModel } from "./reactionChipModel"

export interface ReactionChipsProps {
  reactions: ReactionSummaryDTO[]
  onToggle: (emoji: ReactionEmoji) => void
  mine: boolean
  disabled?: boolean
}

export function ReactionChips({ reactions, onToggle, mine, disabled = false }: ReactionChipsProps) {
  const styles = useStyles()
  const { t } = useT("conversation-reactions")
  const chips = buildReactionChipModel(reactions)
  if (chips.length === 0) return null
  return (
    <View style={styles.row}>
      {chips.map((chip) => {
        const countStyle = mine
          ? chip.mine
            ? styles.countMineSelected
            : styles.countMine
          : chip.mine
            ? styles.countTheirsSelected
            : styles.countTheirs
        return (
          <Pressable
            key={chip.emoji}
            disabled={disabled}
            onPress={() => onToggle(chip.emoji)}
            accessibilityRole="button"
            accessibilityLabel={t("chip.a11y", { label: t(`label.${chip.emoji}`), count: chip.count })}
            accessibilityState={{ selected: chip.mine, disabled }}
            hitSlop={{ top: 5, bottom: 5, left: 2, right: 2 }}
            {...focusRingProps}
            style={(state) => [
              styles.chip,
              mine ? styles.chipMine : styles.chipTheirs,
              chip.mine ? (mine ? styles.chipMineSelected : styles.chipTheirsSelected) : null,
              webTransition,
              disabled ? null : webCursorPointer,
              !disabled && webHover(state) ? styles.hovered : null,
              state.pressed ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.glyph, webNoSelect]}>{chip.glyph}</Text>
            <Text style={[styles.count, countStyle, webNoSelect]}>{chip.count}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const ON_BLOOM_CHIP_BG_ALPHA = 0.22

const useStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    height: 22,
    borderRadius: t.radius.pill,
  },
  chipTheirs: {
    backgroundColor: t.colors.surfaceTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  chipTheirsSelected: {
    backgroundColor: t.colors.bloom["50"],
    borderColor: t.colors.bloom["700"],
  },
  chipMine: {
    backgroundColor: alpha(t.colors.onAccent, ON_BLOOM_CHIP_BG_ALPHA),
  },
  chipMineSelected: {
    backgroundColor: t.colors.onAccent,
  },
  glyph: {
    fontSize: 12,
    lineHeight: 15,
  },
  count: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 11,
    lineHeight: 14,
  },
  countTheirs: {
    color: t.colors.textMuted,
  },
  countTheirsSelected: {
    color: t.colors.bloom["700"],
  },
  countMine: {
    color: t.colors.onAccent,
  },
  countMineSelected: {
    color: t.colors.bloom["700"],
  },
  hovered: {
    opacity: 0.85,
  },
  pressed: {
    opacity: 0.6,
  },
}))
