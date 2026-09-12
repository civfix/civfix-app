import React from "react"
import { View } from "react-native"
import { makeThemedStyles } from "../../theme"
import { SectionCard } from "../../primitives/SectionCard"
import { SkeletonBlock, SkeletonGroup, SkeletonList, SkeletonText } from "../../primitives/skeleton"
import type { StatTileColumns } from "../../primitives/statTileModel"

const HERO_VALUE_HEIGHT = 48
const METER_HEIGHT = 6
const TILE_HEIGHT = 28

export interface TilesSkeletonProps {
  columns?: StatTileColumns
}

export interface RowsSkeletonProps {
  rows?: number
}

export function HeroSkeleton() {
  const styles = useStyles()
  return (
    <SectionCard>
      <SkeletonGroup style={styles.hero}>
        <SkeletonText width="34%" height={11} />
        <SkeletonBlock width="52%" height={HERO_VALUE_HEIGHT} />
        <SkeletonBlock width="100%" height={METER_HEIGHT} radius={METER_HEIGHT / 2} />
      </SkeletonGroup>
    </SectionCard>
  )
}

export function TilesSkeleton({ columns = 2 }: TilesSkeletonProps) {
  const styles = useStyles()
  const count = columns
  return (
    <SkeletonGroup style={styles.tiles}>
      {Array.from({ length: count }, (_unused, index) => (
        <View key={index} style={[styles.tile, { flexBasis: columns === 4 ? "21%" : "46%" }]}>
          <SkeletonText width="70%" height={10} />
          <SkeletonBlock width="46%" height={TILE_HEIGHT} />
        </View>
      ))}
    </SkeletonGroup>
  )
}

export function RowsSkeleton({ rows = 3 }: RowsSkeletonProps) {
  const styles = useStyles()
  return (
    <SectionCard>
      <SkeletonList kind="settings" rows={rows} style={styles.rows} />
    </SectionCard>
  )
}

const useStyles = makeThemedStyles((t) => ({
  hero: {
    gap: t.space["3"],
  },
  tiles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.space["2"],
  },
  tile: {
    flexGrow: 1,
    minWidth: 0,
    gap: t.space["2"],
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
  },
  rows: {
    gap: t.space["2"],
  },
}))
