import React from "react"
import { makeThemedStyles } from "../theme"
import { Text } from "../typography"
import { DEFAULT_ATTRIBUTION } from "./mapStyle"

const CREDIT_RIGHT_INSET = 6
const CREDIT_FONT_SIZE = 9

export interface MapCreditProps {
  /** Lifts the credit above host chrome that floats over the map's bottom edge. */
  bottomInset?: number | null
}

/**
 * Stands in for the native maplibre attribution control, which the pickers suppress to keep their chrome
 * clean; the basemap licence still requires a visible CARTO/OSM credit.
 */
export function MapCredit({ bottomInset = null }: MapCreditProps) {
  const styles = useStyles()
  return (
    <Text style={[styles.credit, bottomInset != null ? { bottom: bottomInset } : null]} pointerEvents="none">
      {DEFAULT_ATTRIBUTION}
    </Text>
  )
}

const useStyles = makeThemedStyles((t) => ({
  credit: {
    position: "absolute",
    bottom: t.space["1"],
    right: CREDIT_RIGHT_INSET,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: CREDIT_FONT_SIZE,
    color: t.colors.textSubtle,
  },
}))
