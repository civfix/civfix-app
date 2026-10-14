import React from "react"
import { View } from "react-native"
import { makeThemedStyles } from "../theme"
import { Text } from "../typography"
import { ToggleRowContent } from "./ToggleRowContent"

export interface ToggleProps {
  label: string
  value: boolean
  onValueChange: (next: boolean) => void
  helper?: string
}

export function Toggle({ label, value, onValueChange, helper }: ToggleProps) {
  const styles = useStyles()
  return (
    <View style={styles.row}>
      <ToggleRowContent
        label={label}
        hint={helper}
        value={value}
        onValueChange={onValueChange}
        columnStyle={styles.textCol}
      >
        <Text variant="bodyStrong">{label}</Text>
        {helper ? (
          <Text variant="caption" style={styles.helper}>
            {helper}
          </Text>
        ) : null}
      </ToggleRowContent>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["3"],
    minHeight: 56,
  },
  textCol: {
    flex: 1,
    marginRight: t.space["3"],
  },
  helper: {
    marginTop: 2,
    lineHeight: 16,
  },
}))
