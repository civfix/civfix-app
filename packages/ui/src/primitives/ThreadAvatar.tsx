import React from "react"
import { View } from "react-native"
import { makeThemedStyles, useTheme } from "../theme"
import { Icon, iconMap } from "../typography"
import { Avatar } from "./Avatar"
import { resolveThreadAvatar, type ThreadAvatarInput } from "./threadAvatarResolve"

export function ThreadAvatar({
  thread,
  size = 48,
}: {
  thread: ThreadAvatarInput
  size?: number
}) {
  const styles = useStyles()
  const t = useTheme()
  const a = resolveThreadAvatar(thread)
  if (!a.isGroup) {
    return (
      <Avatar
        name={a.name}
        seed={a.seed}
        photoUrl={a.photoUrl}
        gradient={a.gradient}
        size={size}
        style={t.shadows.s1}
        decorative
      />
    )
  }
  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: a.color },
        t.shadows.s1,
      ]}
    >
      <Icon icon={iconMap.Users} size={size * 0.42} color={t.colors.onAccent} />
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: t.colors.neutral.card,
  },
}))
