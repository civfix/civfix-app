import React from "react"
import { View } from "react-native"
import { makeThemedStyles, useTheme } from "../theme"
import { Icon, iconMap } from "../typography"

export function CheckboxBox({ checked }: { checked: boolean }) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <View style={[styles.box, checked ? styles.boxChecked : null]}>
      {checked ? <Icon icon={iconMap.Check} size={14} color={th.colors.onAccent} /> : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  box: {
    width: 22,
    height: 22,
    borderRadius: t.radius.xs,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: {
    backgroundColor: t.colors.brand.bloom,
    borderColor: t.colors.brand.bloom,
  },
}))
