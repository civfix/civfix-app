import React from "react"
import { View, Pressable, StyleSheet, ActivityIndicator } from "react-native"
import type { UserProfileDTO } from "@civfix/shared"
import { makeThemedStyles, space, useTheme, focusRingProps, webCursor } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { Avatar, LIST_TILE, SETTINGS_ROW_MIN_HEIGHT } from "../../primitives"
import { useT } from "../../i18n"

const ROW_PAD_H = space["4"]
const ROW_GAP = space["3"]

export interface AvatarSettingRowProps {
  profile: UserProfileDTO
  uploading?: boolean
  onPress: () => void
}

export function AvatarSettingRow({ profile, uploading, onPress }: AvatarSettingRowProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("settings-account")
  return (
    <Pressable
      onPress={onPress}
      disabled={uploading}
      accessibilityRole="button"
      accessibilityLabel={t("avatar.change_a11y")}
      {...focusRingProps}
      style={({ pressed }) => [
        styles.row,
        webCursor(uploading),
        pressed && !uploading ? styles.rowPressed : null,
      ]}
    >
      <View style={styles.avatarWrap}>
        <Avatar
          name={profile.name}
          seed={profile.id}
          photoUrl={profile.avatarUrl}
          gradient={profile.avatar ?? null}
          size={LIST_TILE}
          decorative
        />
        {uploading ? (
          <View style={styles.avatarBusy}>
            <ActivityIndicator size="small" color={th.colors.onScrim} />
          </View>
        ) : null}
      </View>
      <View style={styles.meta}>
        <Text style={styles.label} numberOfLines={1}>
          {t("avatar.change")}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {uploading ? t("avatar.uploading") : t("avatar.sub")}
        </Text>
      </View>
      <Icon icon={iconMap.ChevronRight} size={18} color={th.colors.textSubtle} />
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: ROW_GAP,
    minHeight: SETTINGS_ROW_MIN_HEIGHT,
    paddingVertical: t.space["2"],
    paddingHorizontal: ROW_PAD_H,
  },
  rowPressed: {
    backgroundColor: t.colors.bgAlt,
  },
  avatarWrap: {
    position: "relative",
    width: LIST_TILE,
    height: LIST_TILE,
    flexShrink: 0,
    borderRadius: t.radius.pill,
  },
  avatarBusy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.scrimStrong,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 14.5,
    color: t.colors.text,
  },
  sub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    color: t.colors.textSubtle,
    marginTop: 1,
  },
}))
