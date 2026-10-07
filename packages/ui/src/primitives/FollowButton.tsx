import React, { useCallback } from "react"
import { Pressable, ActivityIndicator, type StyleProp, type ViewStyle } from "react-native"
import {
  makeThemedStyles,
  useTheme,
  webCursor,
  webTransition,
  webHover,
  webNoSelect,
  focusRingProps,
  hitSlopToTarget,
} from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useFollowPerson, useRequireAuth } from "../data"
import { useT } from "../i18n"

const FOLLOW_HEIGHT_SM = 30
const FOLLOW_HEIGHT_MD = 42
const FOLLOW_SM_HIT_SLOP = hitSlopToTarget(FOLLOW_HEIGHT_SM)
const FOLLOW_MD_HIT_SLOP = hitSlopToTarget(FOLLOW_HEIGHT_MD)

export interface FollowButtonProps {
  personId: string
  isFollowing: boolean
  nextPath: string
  size?: "sm" | "md"
  style?: StyleProp<ViewStyle>
}

export function FollowButton({ personId, isFollowing, nextPath, size = "md", style }: FollowButtonProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("profile-follow")
  const requireAuth = useRequireAuth()
  const follow = useFollowPerson(personId)
  const { mutate: mutateFollow } = follow

  const onPress = useCallback(() => {
    requireAuth(() => mutateFollow(isFollowing), { next: nextPath })
  }, [requireAuth, mutateFollow, isFollowing, nextPath])

  const compact = size === "sm"
  const fg = isFollowing ? th.colors.moss["700"] : th.colors.onAccent

  return (
    <Pressable
      onPress={onPress}
      disabled={follow.isPending}
      accessibilityRole="button"
      accessibilityState={{ selected: isFollowing, busy: follow.isPending }}
      accessibilityLabel={isFollowing ? t("button.following") : t("button.follow")}
      hitSlop={compact ? FOLLOW_SM_HIT_SLOP : FOLLOW_MD_HIT_SLOP}
      {...focusRingProps}
      style={(state) => [
        styles.base,
        webTransition,
        webCursor(follow.isPending),
        compact ? styles.sm : styles.md,
        isFollowing ? styles.following : styles.idle,
        webHover(state) && !follow.isPending ? styles.hovered : null,
        state.pressed ? styles.pressed : null,
        style,
      ]}
    >
      {follow.isPending ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          <Icon icon={isFollowing ? iconMap.Check : iconMap.UserPlus} size={14} color={fg} />
          <Text color={fg} style={[styles.label, compact ? styles.labelSm : null, webNoSelect]}>
            {isFollowing ? t("button.following") : t("button.follow")}
          </Text>
        </>
      )}
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: t.radius.pill,
  },
  sm: {
    paddingHorizontal: t.space["3"],
    height: FOLLOW_HEIGHT_SM,
    minWidth: 92,
  },
  md: {
    paddingHorizontal: t.space["5"],
    height: FOLLOW_HEIGHT_MD,
  },
  idle: {
    backgroundColor: t.colors.brand.bloom,
  },
  following: {
    backgroundColor: t.colors.moss["50"],
  },
  label: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["14"],
  },
  labelSm: {
    fontSize: 12.5,
  },
  hovered: {
    opacity: 0.92,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
}))
