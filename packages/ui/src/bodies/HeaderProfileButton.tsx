import React, { useCallback } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { focusRingProps, makeThemedStyles, useLayoutMode, useTheme } from "../theme"
import { Avatar } from "../primitives"
import { Icon, iconMap } from "../typography"
import { useAuthState, useRequireAuth } from "../data"
import { useNavStore } from "../nav"
import { headerAuthAffordance } from "../shell/headerAuthAffordance"
import { useT } from "../i18n"
import {
  HEADER_AVATAR_SIZE,
  HEADER_BADGED_AVATAR_SIZE,
  HEADER_CONTROL_RADIUS,
  HEADER_CONTROL_SIZE,
  HEADER_GLYPH_SIZE,
} from "../primitives/headerControls"

export interface HeaderProfileButtonProps {
  surface?: "glass" | "solid"
}

export function HeaderProfileButton({ surface = "glass" }: HeaderProfileButtonProps = {}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("common-search")
  const { t: tNav } = useT("nav")
  const { user, isAuthenticated, isPending } = useAuthState()
  const requireAuth = useRequireAuth()
  const layout = useLayoutMode()

  const openProfile = useCallback(() => useNavStore.getState().push({ kind: "profile" }), [])
  const signIn = useCallback(
    () => requireAuth(() => useNavStore.getState().push({ kind: "profile" })),
    [requireAuth],
  )

  if (layout === "expanded") return null

  if (headerAuthAffordance({ isAuthenticated, isPending }) === "sign-in") {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("a11y.sign_in")}
        onPress={signIn}
        {...focusRingProps}
        style={({ pressed }) => [styles.target, pressed ? styles.pressed : null]}
      >
        <View style={[styles.signInBadge, surface === "solid" ? styles.solid : null]}>
          <Icon icon={iconMap.LogIn} size={HEADER_GLYPH_SIZE} color={th.colors.text} />
        </View>
      </Pressable>
    )
  }

  const avatar = (
    <Avatar
      name={user?.displayName ?? tNav("fallback_you")}
      seed={user?.id}
      photoUrl={user?.avatarUrl ?? null}
      gradient={null}
      size={surface === "solid" ? HEADER_BADGED_AVATAR_SIZE : HEADER_AVATAR_SIZE}
    />
  )

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("a11y.open_profile")}
      onPress={openProfile}
      {...focusRingProps}
      style={({ pressed }) => [styles.target, styles.avatarButton, pressed ? styles.pressed : null]}
    >
      {surface === "solid" ? (
        <View style={[styles.signInBadge, styles.solid]}>{avatar}</View>
      ) : (
        avatar
      )}
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  target: {
    width: HEADER_CONTROL_SIZE,
    height: HEADER_CONTROL_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: HEADER_CONTROL_RADIUS,
  },
  avatarButton: { ...t.shadows.s1 },
  solid: {
    backgroundColor: t.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  signInBadge: {
    width: HEADER_CONTROL_SIZE,
    height: HEADER_CONTROL_SIZE,
    borderRadius: HEADER_CONTROL_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.glass.sheet.input,
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.93 }] },
}))
