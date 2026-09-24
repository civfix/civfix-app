import { StyleSheet, type TextStyle, type ViewStyle } from "react-native"
import type { Theme } from "../theme"

export function menuSurfaceStyle(t: Theme): ViewStyle {
  return {
    paddingVertical: t.space["1"],
    paddingHorizontal: t.space["1"],
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s3,
  }
}

export interface MenuRowStyles {
  row: ViewStyle
  rowHovered: ViewStyle
  rowPressed: ViewStyle
  rowLabel: TextStyle
}

export function menuRowStyles(t: Theme, inset: number): MenuRowStyles {
  return {
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: inset,
      paddingHorizontal: inset,
      paddingVertical: inset,
      borderRadius: t.radius.md,
    },
    rowHovered: {
      backgroundColor: t.colors.surfaceTint,
    },
    rowPressed: {
      backgroundColor: t.colors.surfaceTint,
      opacity: 0.85,
    },
    rowLabel: {
      flex: 1,
    },
  }
}
