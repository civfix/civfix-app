import { useCallback } from "react"
import { View } from "react-native"
import { useTheme } from "../theme"
import { Icon, iconMap } from "../typography"
import { GlassButton, UnreadDot } from "../primitives"
import { HEADER_GLYPH_SIZE } from "../primitives/headerControls"
import { useHasUnreadNotifications } from "../data"
import { useNavStore } from "../nav"
import { useT } from "../i18n"
import { HeaderIconButton } from "./HeaderIconButton"

export interface NotificationsButtonProps {
  variant: "map-glass" | "solid" | "glass"
}

/** The header's way into the notification center; it carries the unread dot the avatar used to. */
export function NotificationsButton({ variant }: NotificationsButtonProps) {
  const th = useTheme()
  const { t } = useT("nav")
  const { t: tn } = useT("notifications")
  const unread = useHasUnreadNotifications()
  const label = unread
    ? tn("row.unreadSuffix", { title: t("a11y.notifications") })
    : t("a11y.notifications")
  const open = useCallback(() => useNavStore.getState().push({ kind: "activity" }), [])

  if (variant === "map-glass") {
    return (
      <GlassButton accessibilityLabel={label} onPress={open} dot={unread}>
        <Icon icon={iconMap.Bell} size={HEADER_GLYPH_SIZE} color={th.colors.neutral.ink2} />
      </GlassButton>
    )
  }
  return (
    <View>
      <HeaderIconButton icon="Bell" label={label} onPress={open} surface={variant} />
      {unread ? <UnreadDot /> : null}
    </View>
  )
}
