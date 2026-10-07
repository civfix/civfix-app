import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Animated, View, Pressable, StyleSheet } from "react-native"
import type { PollDTO } from "@civfix/shared"
import {
  makeThemedStyles,
  useReducedMotion,
  useTheme,
  webCursorPointer,
  webNoSelect,
  focusRingProps,
  PRESSED_OPACITY,
} from "../theme"
import { alpha } from "../theme/alpha"
import { Text, Icon, iconMap } from "../typography"
import { PrimaryButton } from "./PrimaryButton"
import { pollInteractivity, reconcilePollSelection } from "./pollBubbleModel"
import { useT } from "../i18n"

const RESULT_BAR_GROW_MS = 300

export interface PollBubbleProps {
  poll: PollDTO
  mine: boolean
  onVote: (optionIdxs: number[]) => void
  disabled?: boolean
}

function pct(count: number, totalVoters: number): number {
  if (totalVoters <= 0) return 0
  return Math.round((count / totalVoters) * 100)
}

export function PollBubble({ poll, mine, onVote, disabled = false }: PollBubbleProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("conversation-polls")
  const { showResults, votable, inert } = pollInteractivity({
    closed: poll.closed,
    disabled,
    myVote: poll.myVote,
  })

  const [selected, setSelected] = useState<Set<number>>(() => new Set(poll.myVote))
  useEffect(() => {
    setSelected((prev) => reconcilePollSelection(prev, poll.myVote))
  }, [poll.myVote])

  const toggleSelected = useCallback((idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }, [])

  const fractions = useMemo(
    () => poll.options.map((o) => (poll.totalVoters > 0 ? Math.min(1, o.count / poll.totalVoters) : 0)),
    [poll.options, poll.totalVoters],
  )
  const barsRef = useRef<Animated.Value[]>([])
  if (barsRef.current.length !== poll.options.length) {
    barsRef.current = poll.options.map((_, i) => new Animated.Value(fractions[i] ?? 0))
  }
  const reducedMotion = useReducedMotion()
  const barsStill = reducedMotion !== false
  useEffect(() => {
    if (!showResults) return
    if (barsStill) {
      barsRef.current.forEach((v, i) => v.setValue(fractions[i] ?? 0))
      return
    }
    const run = Animated.parallel(
      barsRef.current.map((v, i) =>
        Animated.timing(v, { toValue: fractions[i] ?? 0, duration: RESULT_BAR_GROW_MS, useNativeDriver: false }),
      ),
    )
    run.start()
    return () => run.stop()
  }, [showResults, fractions, barsStill])

  const subtitleColor = mine ? alpha(th.colors.onAccent, ON_BLOOM_SUBTLE_ALPHA) : th.colors.textSubtle
  const questionColor = mine ? th.colors.onAccent : th.colors.text
  const subtitle =
    (poll.anonymous ? t("anonymous_poll") : t("poll")) + (poll.closed ? " · " + t("final_results") : "")

  const renderVoteRow = (opt: PollDTO["options"][number]) => {
    const isSelected = poll.allowMultiple ? selected.has(opt.idx) : false
    const glyph = poll.allowMultiple
      ? isSelected
        ? iconMap.SquareCheck
        : iconMap.Square
      : iconMap.Circle
    const onPress = () => {
      if (!votable) return
      if (poll.allowMultiple) toggleSelected(opt.idx)
      else onVote([opt.idx])
    }
    return (
      <Pressable
        key={opt.idx}
        onPress={onPress}
        disabled={!votable}
        accessibilityRole={poll.allowMultiple ? "checkbox" : "radio"}
        accessibilityState={{ checked: isSelected, disabled: !votable }}
        accessibilityLabel={opt.text}
        {...focusRingProps}
        style={({ pressed }) => [
          styles.voteRow,
          mine ? styles.voteRowMine : styles.voteRowTheirs,
          votable ? webCursorPointer : null,
          pressed && votable ? styles.rowPressed : null,
        ]}
      >
        <Icon icon={glyph} size={20} color={mine ? th.colors.onAccent : th.colors.accent} />
        <Text
          variant="body"
          color={mine ? th.colors.onAccent : th.colors.text}
          style={[styles.optionText, webNoSelect]}
        >
          {opt.text}
        </Text>
      </Pressable>
    )
  }

  const renderResultRow = (opt: PollDTO["options"][number], i: number) => {
    const percentage = pct(opt.count, poll.totalVoters)
    const canSwitch = votable && !poll.allowMultiple
    const width = (barsRef.current[i] ?? new Animated.Value(0)).interpolate({
      inputRange: [0, 1],
      outputRange: ["0%", "100%"],
    })
    return (
      <Pressable
        key={opt.idx}
        onPress={canSwitch ? () => onVote([opt.idx]) : undefined}
        disabled={!canSwitch}
        accessibilityRole={canSwitch ? "button" : undefined}
        accessibilityLabel={t("result_a11y", { option: opt.text, percent: percentage })}
        {...focusRingProps}
        style={({ pressed }) => [
          styles.resultRow,
          mine ? styles.resultRowMine : styles.resultRowTheirs,
          pressed && canSwitch ? styles.rowPressed : null,
        ]}
      >
        <Animated.View
          style={[
            styles.bar,
            { width },
            mine ? styles.barMine : opt.mine ? styles.barTheirsSelected : styles.barTheirs,
          ]}
        />
        <View style={styles.resultContent}>
          <View style={styles.resultLabelRow}>
            {opt.mine ? (
              <Icon icon={iconMap.Check} size={14} color={mine ? th.colors.onAccent : th.colors.accent} />
            ) : null}
            <Text
              variant={opt.mine ? "bodyStrong" : "body"}
              color={mine ? th.colors.onAccent : th.colors.text}
              style={[styles.optionText, webNoSelect]}
            >
              {opt.text}
            </Text>
          </View>
          <Text
            variant="bodyStrong"
            color={mine ? th.colors.onAccent : th.colors.text}
            style={webNoSelect}
          >
            {percentage}%
          </Text>
        </View>
      </Pressable>
    )
  }

  const canCommitMulti = votable && poll.allowMultiple && !showResults && selected.size > 0

  return (
    <View style={styles.root}>
      <Text variant="bodyStrong" color={questionColor} style={styles.question}>
        {poll.question}
      </Text>
      <Text variant="caption" color={subtitleColor} style={styles.subtitle}>
        {subtitle}
      </Text>

      <View style={[styles.options, inert ? styles.optionsInert : null]}>
        {showResults
          ? poll.options.map((opt, i) => renderResultRow(opt, i))
          : poll.options.map((opt) => renderVoteRow(opt))}
      </View>

      {votable && !showResults && poll.allowMultiple ? (
        <View style={styles.voteAction}>
          <PrimaryButton label={t("vote")} onPress={() => onVote([...selected])} disabled={!canCommitMulti} />
        </View>
      ) : null}

      <Text variant="caption" color={subtitleColor} style={styles.footer}>
        {t("votes", { count: poll.totalVoters })}
      </Text>
    </View>
  )
}

const ON_BLOOM_SUBTLE_ALPHA = 0.78
const ON_BLOOM_BAR_ALPHA = 0.24

const useStyles = makeThemedStyles((t) => ({
  root: {
    minWidth: 200,
    gap: t.space["1"],
  },
  question: {
    fontFamily: t.fontFamily.bodySemiBold,
  },
  subtitle: {
    marginBottom: t.space["1"],
  },
  options: {
    gap: t.space["2"],
    marginTop: t.space["1"],
  },
  optionsInert: {
    opacity: 0.5,
  },
  voteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["2"],
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  voteRowTheirs: {
    backgroundColor: t.colors.surface,
    borderColor: t.colors.border,
  },
  voteRowMine: {
    backgroundColor: alpha(t.colors.onAccent, 0.14),
    borderColor: alpha(t.colors.onAccent, 0.3),
  },
  optionText: {
    flex: 1,
  },
  rowPressed: {
    opacity: PRESSED_OPACITY,
  },
  resultRow: {
    position: "relative",
    justifyContent: "center",
    minHeight: 40,
    borderRadius: t.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  resultRowTheirs: {
    backgroundColor: t.colors.surface,
    borderColor: t.colors.border,
  },
  resultRowMine: {
    backgroundColor: alpha(t.colors.onAccent, 0.1),
    borderColor: alpha(t.colors.onAccent, 0.24),
  },
  bar: {
    ...StyleSheet.absoluteFillObject,
    right: undefined,
    borderRadius: t.radius.lg,
  },
  barTheirs: {
    backgroundColor: t.colors.surfaceTint,
  },
  barTheirsSelected: {
    backgroundColor: t.colors.bloom["50"],
  },
  barMine: {
    backgroundColor: alpha(t.colors.onAccent, ON_BLOOM_BAR_ALPHA),
  },
  resultContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: t.space["2"],
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["2"],
  },
  resultLabelRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["1"],
  },
  voteAction: {
    marginTop: t.space["2"],
    alignItems: "flex-start",
  },
  footer: {
    marginTop: t.space["2"],
  },
}))
