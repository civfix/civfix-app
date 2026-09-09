import React from "react"
import { View, Pressable, Image, StyleSheet } from "react-native"
import { makeThemedStyles, useTheme, focusRingProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { TextField } from "../primitives"
import type { ComposerAttachments } from "../primitives/useComposerAttachments"
import { GROUP_NAME_MAX, GROUP_DESCRIPTION_MAX } from "./groupWizard"

export interface GroupIdentityLabels {
  avatarA11y: string
  avatarClearA11y?: string
  nameLabel: string
  namePlaceholder: string
  descriptionLabel: string
  descriptionPlaceholder: string
}

export interface GroupIdentityFieldsProps {
  avatar: ComposerAttachments
  name: string
  onChangeName: (value: string) => void
  description: string
  onChangeDescription: (value: string) => void
  fallbackAvatarUrl?: string | null
  labels: GroupIdentityLabels
  variant?: "wizard" | "sheet"
}

export function GroupIdentityFields({
  avatar,
  name,
  onChangeName,
  description,
  onChangeDescription,
  fallbackAvatarUrl,
  labels,
  variant = "wizard",
}: GroupIdentityFieldsProps) {
  const styles = useStyles()
  const t = useTheme()
  const picked = avatar.attachments[0] ?? null
  const isSheet = variant === "sheet"
  const showClear = !!picked && !!labels.avatarClearA11y

  return (
    <>
      <View style={[styles.avatarRow, isSheet ? styles.avatarRowSheet : null]}>
        <Pressable
          onPress={() => void avatar.onAttach()}
          disabled={avatar.uploading}
          accessibilityRole="button"
          accessibilityLabel={labels.avatarA11y}
          {...focusRingProps}
          style={({ pressed }) => [
            styles.avatarCircle,
            isSheet ? styles.avatarCircleSheet : null,
            picked || fallbackAvatarUrl ? styles.avatarCircleFramed : null,
            pressed ? styles.avatarPressed : null,
          ]}
        >
          {picked ? (
            <Image source={{ uri: picked.uri }} style={styles.avatarImage} resizeMode="cover" />
          ) : fallbackAvatarUrl ? (
            <Image source={{ uri: fallbackAvatarUrl }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <Icon icon={iconMap.Camera} size={isSheet ? 24 : 26} color={t.colors.onAccent} />
          )}
        </Pressable>
        {showClear ? (
          <Pressable
            onPress={() => picked && avatar.removeAttachment(picked.id)}
            accessibilityRole="button"
            accessibilityLabel={labels.avatarClearA11y ?? ""}
            hitSlop={6}
            {...focusRingProps}
            style={({ pressed }) => [styles.avatarClear, pressed ? styles.clearPressed : null]}
          >
            <Icon icon={iconMap.Close} size={14} color={t.colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {avatar.attachError ? <Text style={styles.errorText}>{avatar.attachError}</Text> : null}

      <TextField
        label={labels.nameLabel}
        placeholder={labels.namePlaceholder}
        value={name}
        onChangeText={onChangeName}
        maxLength={GROUP_NAME_MAX}
        containerStyle={isSheet ? styles.fieldSheet : styles.field}
      />
      <TextField
        label={labels.descriptionLabel}
        placeholder={labels.descriptionPlaceholder}
        value={description}
        onChangeText={onChangeDescription}
        maxLength={GROUP_DESCRIPTION_MAX}
        multiline
        containerStyle={isSheet ? styles.fieldSheet : styles.field}
      />
    </>
  )
}

const useStyles = makeThemedStyles((t) => ({
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["2"],
    marginTop: t.space["2"],
    marginBottom: t.space["4"],
  },
  avatarRowSheet: {
    marginTop: 0,
    marginBottom: 0,
  },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.brand.moss,
  },
  avatarCircleFramed: t.imageFrame,
  avatarCircleSheet: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarPressed: {
    opacity: 0.8,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarClear: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  clearPressed: {
    opacity: 0.6,
    backgroundColor: t.colors.bgAlt,
  },
  field: {
    marginBottom: t.space["3"],
  },
  fieldSheet: {
    marginBottom: t.space["1"],
  },
  errorText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: t.colors.bloom["600"],
    textAlign: "center",
    marginBottom: t.space["2"],
  },
}))
