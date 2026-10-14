import React, { useCallback, useMemo } from "react"
import {
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import type { UserSearchResultDTO } from "@civfix/shared"
import { makeThemedStyles, useTheme, webCursorPointer, webTransition, focusRingProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useMentionSearch } from "../data"
import { useT } from "../i18n"
import { Avatar } from "./Avatar"
import { matchesMentionPrefix, MENTION_RESULT_LIMIT } from "./mentionCandidates"

export interface JurisdictionMentionCandidate {
  kind: "jurisdiction"
  id: string
  handle: string
  displayName: string
}

type UserMentionCandidate = UserSearchResultDTO & { kind?: "user" }

export type MentionCandidate = UserMentionCandidate | JurisdictionMentionCandidate

function isJurisdiction(c: MentionCandidate): c is JurisdictionMentionCandidate {
  return (c as JurisdictionMentionCandidate).kind === "jurisdiction"
}

const MENTION_TRAY_MAX_HEIGHT = 192

const TRAILING_MENTION = /(^|\s)@([^\s@]*)$/

interface ActiveMention {
  prefix: string
  at: number
}

function findActiveMention(draft: string): ActiveMention | null {
  const m = TRAILING_MENTION.exec(draft)
  if (!m) return null
  const boundary = m[1] ?? ""
  const at = m.index + boundary.length
  return { prefix: m[2] ?? "", at }
}

export interface MentionAutocompleteProps {
  draft: string
  onSelect: (candidate: MentionCandidate, nextDraft: string) => void
  candidates?: readonly UserSearchResultDTO[] | null
  extraCandidates?: readonly MentionCandidate[] | null
  style?: StyleProp<ViewStyle>
  maxHeight?: number
}

function MentionRow({
  candidate,
  onPress,
}: {
  candidate: MentionCandidate
  onPress: (candidate: MentionCandidate) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("conversation-mentions")
  const jurisdiction = isJurisdiction(candidate)
  return (
    <Pressable
      onPress={() => onPress(candidate)}
      accessibilityRole="button"
      accessibilityLabel={t("row.a11y_mention", { handle: candidate.handle })}
      {...focusRingProps}
      style={(state) => [
        styles.row,
        webTransition,
        webCursorPointer,
        state.pressed ? styles.rowPressed : null,
      ]}
    >
      {jurisdiction ? (
        <View style={styles.govBadge}>
          <Icon icon={iconMap.Building2} size={16} color={th.colors.sky["700"]} />
        </View>
      ) : (
        <Avatar
          name={candidate.displayName}
          seed={candidate.id}
          photoUrl={candidate.avatarUrl ?? null}
          gradient={candidate.avatar ?? null}
          size={28}
        />
      )}
      <View style={styles.rowText}>
        <Text variant="caption" color={th.colors.text} style={styles.rowName} numberOfLines={1}>
          {candidate.displayName}
        </Text>
        <Text variant="caption" color={th.colors.textSubtle} numberOfLines={1}>
          @{candidate.handle}
        </Text>
      </View>
    </Pressable>
  )
}

export function MentionAutocomplete({
  draft,
  onSelect,
  candidates,
  extraCandidates,
  style,
  maxHeight = MENTION_TRAY_MAX_HEIGHT,
}: MentionAutocompleteProps) {
  const styles = useStyles()
  const active = useMemo(() => findActiveMention(draft), [draft])
  const scoped = candidates != null
  const search = useMentionSearch(scoped ? "" : (active?.prefix ?? ""))
  const results = useMemo<readonly MentionCandidate[]>(() => {
    if (!active) return []
    const matchLocal = (handle: string, name: string) =>
      matchesMentionPrefix(active.prefix, handle, name, "roster")
    const extra = (extraCandidates ?? []).filter((c) => matchLocal(c.handle, c.displayName))
    const users: readonly UserSearchResultDTO[] = (
      scoped
        ? (candidates ?? []).filter((u) => matchLocal(u.handle, u.displayName))
        : (search.data?.results ?? []).filter((u) =>
            matchesMentionPrefix(active.prefix, u.handle, u.displayName, "search"),
          )
    ).slice(0, MENTION_RESULT_LIMIT)
    return [...extra, ...users]
  }, [active, scoped, candidates, extraCandidates, search.data])

  const handlePick = useCallback(
    (candidate: MentionCandidate) => {
      if (!active) return
      const before = draft.slice(0, active.at)
      const nextDraft = `${before}@${candidate.handle} `
      onSelect(candidate, nextDraft)
    },
    [active, draft, onSelect],
  )

  if (!active || results.length === 0) return null

  return (
    <View style={[styles.tray, style]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={[styles.scroll, { maxHeight }]}
      >
        {results.map((candidate) => (
          <MentionRow key={candidate.id} candidate={candidate} onPress={handlePick} />
        ))}
      </ScrollView>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  tray: {
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    overflow: "hidden",
    ...t.shadows.s2,
  },
  scroll: {
    maxHeight: MENTION_TRAY_MAX_HEIGHT,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["2"],
  },
  rowPressed: {
    backgroundColor: t.colors.bgAlt,
  },
  govBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.sky["50"],
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontFamily: t.fontFamily.bodySemiBold,
  },
}))
