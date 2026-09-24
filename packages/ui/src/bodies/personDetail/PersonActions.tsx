import React from "react"
import { View, Pressable } from "react-native"
import type { UserProfileDTO } from "@civfix/shared"
import { useTheme, focusRingProps } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { FollowButton } from "../../primitives"
import { useT } from "../../i18n"
import type { PersonModeration } from "./usePersonModeration"
import { usePersonDetailStyles } from "./personDetailStyles"

export function PersonActions({
  profile,
  profilePath,
  onMessage,
  moderation,
}: {
  profile: UserProfileDTO
  profilePath: string
  onMessage: () => void
  moderation: PersonModeration
}) {
  const styles = usePersonDetailStyles()
  const th = useTheme()
  const { t } = useT("profile-person")
  return (
    <View style={styles.actions}>
      {profile.blockedByMe ? (
        <Text style={styles.blockedLabel}>{t("blocked.label")}</Text>
      ) : (
        <>
          <FollowButton
            personId={profile.id}
            isFollowing={profile.isFollowing}
            nextPath={profilePath}
            size="md"
            style={styles.followAction}
          />
          <Pressable
            onPress={onMessage}
            accessibilityRole="button"
            accessibilityLabel={t("actions.message_a11y", { name: profile.name })}
            {...focusRingProps}
            style={({ pressed }) => [styles.secondary, pressed ? styles.secondaryPressed : null]}
          >
            <Icon icon={iconMap.MessageCircle} size={17} color={th.colors.text} />
            <Text style={styles.secondaryText}>{t("actions.message")}</Text>
          </Pressable>
        </>
      )}
      <Pressable
        ref={moderation.menuAnchorRef}
        onPress={moderation.openMenu}
        accessibilityRole="button"
        accessibilityLabel={t("actions.more_options")}
        accessibilityState={{ expanded: moderation.menuOpen }}
        {...focusRingProps}
        style={({ pressed }) => [styles.overflowBtn, pressed ? styles.secondaryPressed : null]}
      >
        <Icon icon={iconMap.Ellipsis} size={18} color={th.colors.text} />
      </Pressable>
    </View>
  )
}
