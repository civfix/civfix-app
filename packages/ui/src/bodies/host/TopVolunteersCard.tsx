import React from "react"
import type { LeaderboardEntryDTO } from "@civfix/shared"
import { makeThemedStyles } from "../../theme"
import { Text } from "../../typography"
import { SectionCard } from "../../primitives/SectionCard"
import { LeaderboardRow } from "../LeaderboardRow"

export interface TopVolunteersCardProps {
  entries: readonly LeaderboardEntryDTO[]
  label: string
  caption: string
}

export function TopVolunteersCard({ entries, label, caption }: TopVolunteersCardProps) {
  const styles = useStyles()
  if (entries.length === 0) return null
  return (
    <SectionCard label={label} variant="list">
      {entries.map((entry) => (
        <LeaderboardRow key={entry.userId} entry={entry} emphasis="ink" />
      ))}
      <Text variant="caption" style={styles.caption} numberOfLines={2}>
        {caption}
      </Text>
    </SectionCard>
  )
}

const useStyles = makeThemedStyles((t) => ({
  caption: {
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["2"],
    lineHeight: 16,
  },
}))
