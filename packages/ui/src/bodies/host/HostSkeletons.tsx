import React from "react"
import { View } from "react-native"
import { makeThemedStyles, radius as radiusScale } from "../../theme"
import { METER_HEIGHT } from "../../primitives/Meter"
import { SectionCard } from "../../primitives/SectionCard"
import { STAT_TILE_MIN_HEIGHT } from "../../primitives/StatTile"
import { SkeletonBlock, SkeletonGroup, SkeletonText } from "../../primitives/skeleton"
import type { StatTileColumns } from "../../primitives/statTileModel"

const HERO_VALUE_HEIGHT = 42
const TILE_VALUE_HEIGHT = 28
const TILE_LABEL_HEIGHT = 32
const LIST_TILE_HEIGHT = 40
const ROW_MIN_HEIGHT = 56
const TRAILING_PILL = 32
const CTA_HEIGHT = 52

export interface TilesSkeletonProps {
  columns?: StatTileColumns
  count?: number
}

export interface RowsSkeletonProps {
  rows?: number
  leading?: boolean
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

export function TilesSkeleton({ columns = 2, count = 4 }: TilesSkeletonProps) {
  const styles = useStyles()
  return (
    <SkeletonGroup style={styles.tiles}>
      {Array.from({ length: count }, (_unused, index) => (
        <View key={index} style={[styles.tile, { flexBasis: columns === 4 ? "21%" : "46%" }]}>
          <View style={styles.tileLabel}>
            <SkeletonText width="70%" height={10} />
          </View>
          <SkeletonBlock width="46%" height={TILE_VALUE_HEIGHT} />
        </View>
      ))}
    </SkeletonGroup>
  )
}

export function RowsSkeleton({ rows = 3, leading = true }: RowsSkeletonProps) {
  const styles = useStyles()
  return (
    <SectionCard variant="list">
      {Array.from({ length: rows }, (_unused, index) => (
        <SkeletonGroup key={index} style={styles.row}>
          {leading ? (
            <SkeletonBlock
              width={LIST_TILE_HEIGHT}
              height={LIST_TILE_HEIGHT}
              radius={radiusScale.sm}
            />
          ) : null}
          <View style={styles.rowCopy}>
            <SkeletonText width="56%" height={12} />
            <SkeletonText width="40%" height={10} />
          </View>
          <SkeletonBlock
            width={TRAILING_PILL}
            height={TRAILING_PILL}
            radius={radiusScale.pill}
          />
        </SkeletonGroup>
      ))}
    </SectionCard>
  )
}

export function NextUpSkeleton() {
  const styles = useStyles()
  return (
    <SectionCard>
      <SkeletonGroup style={styles.nextUp}>
        <View style={styles.headRow}>
          <SkeletonBlock
            width={LIST_TILE_HEIGHT}
            height={LIST_TILE_HEIGHT}
            radius={radiusScale.sm}
          />
          <View style={styles.rowCopy}>
            <SkeletonText width="62%" height={12} />
            <SkeletonText width="44%" height={10} />
          </View>
        </View>
        <SkeletonBlock width="100%" height={METER_HEIGHT} radius={METER_HEIGHT / 2} />
        <SkeletonText width="40%" height={10} />
        <SkeletonBlock width="100%" height={CTA_HEIGHT} radius={radiusScale.pill} />
      </SkeletonGroup>
    </SectionCard>
  )
}

export function ImpactSkeleton() {
  const styles = useStyles()
  return (
    <SectionCard>
      <SkeletonGroup style={styles.impact}>
        <SkeletonBlock width="40%" height={HERO_VALUE_HEIGHT} radius={radiusScale.sm} />
        <SkeletonText width="70%" height={12} />
      </SkeletonGroup>
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
    minHeight: STAT_TILE_MIN_HEIGHT,
    gap: t.space["1"],
    padding: t.space["3"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
  },
  tileLabel: {
    minHeight: TILE_LABEL_HEIGHT,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    minHeight: ROW_MIN_HEIGHT,
    paddingVertical: t.space["2"],
    paddingHorizontal: t.space["4"],
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: t.space["1"],
  },
  nextUp: {
    gap: t.space["3"],
  },
  impact: {
    gap: t.space["1"],
  },
}))
