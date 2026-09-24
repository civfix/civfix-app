import React from "react"
import { View } from "react-native"
import {
  SocialLinksSchema,
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
} from "@civfix/shared"
import type { SocialLinks, SocialPlatform } from "@civfix/shared"
import { Text } from "../../typography"
import { TextField } from "../../primitives"
import { useT } from "../../i18n"
import { profileSaveErrorKey } from "../../data/errorCode"
import { useEditorStyles } from "./editorStyles"
import { SettingsEditorSheet } from "./SettingsEditorSheet"
import { useSheetEditor } from "./useSheetEditor"

const SOCIAL_LINK_MAX_LENGTH = 120

function normalizeSocialValue(platform: SocialPlatform, raw: string): string {
  if (platform === "whatsapp") return raw.replace(/\D/g, "")
  return raw.trim().replace(/^@+/, "").trim()
}

function socialDraftsFrom(links: SocialLinks | null | undefined): Record<SocialPlatform, string> {
  const out = {} as Record<SocialPlatform, string>
  for (const platform of SOCIAL_PLATFORMS) {
    const value = links?.[platform]
    out[platform] = typeof value === "string" ? value : ""
  }
  return out
}

function normalizedLinks(drafts: Record<SocialPlatform, string>): SocialLinks {
  const out: SocialLinks = {}
  for (const platform of SOCIAL_PLATFORMS) {
    const value = normalizeSocialValue(platform, drafts[platform] ?? "")
    if (value.length > 0) out[platform] = value
  }
  return out
}

export interface SocialLinksEditorProps {
  socialLinks: SocialLinks | null | undefined
  saving?: boolean
  onSave: (links: SocialLinks) => Promise<void>
}

export function SocialLinksEditor({ socialLinks, saving, onSave }: SocialLinksEditorProps) {
  const styles = useEditorStyles()
  const { t } = useT("settings-account")
  const saved = socialDraftsFrom(socialLinks)
  const editor = useSheetEditor({
    initial: saved,
    save: onSave,
    mapError: (err) => t(profileSaveErrorKey(err, "social.error.save", "social.error.invalid")),
  })
  const { draft: drafts, setDraft: setDrafts, setSubmitError } = editor

  const count = SOCIAL_PLATFORMS.filter((platform) => {
    const value = socialLinks?.[platform]
    return typeof value === "string" && value.trim().length > 0
  }).length

  const dirty = SOCIAL_PLATFORMS.some(
    (platform) =>
      normalizeSocialValue(platform, drafts[platform] ?? "") !==
      normalizeSocialValue(platform, saved[platform] ?? ""),
  )
  const canSave = !saving && dirty

  const save = () => {
    if (!canSave) return
    const parsed = SocialLinksSchema.safeParse(normalizedLinks(drafts))
    if (!parsed.success) {
      setSubmitError(t("social.error.invalid"))
      return
    }
    editor.commit(parsed.data)
  }

  return (
    <SettingsEditorSheet
      editor={editor}
      icon="Link2"
      label={t("social.title")}
      sub={count > 0 ? t("social.count", { count }) : t("social.add")}
      dismissLabel={t("social.dismiss")}
      cancelLabel={t("common:cancel")}
      saveLabel={t("social.save")}
      saving={saving}
      canSave={canSave}
      onCommit={save}
    >
      <Text style={styles.note}>{t("social.note")}</Text>
      {SOCIAL_PLATFORMS.map((platform) => {
        const label = SOCIAL_PLATFORM_LABELS[platform]
        return (
          <View key={platform} style={styles.field}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <TextField
              placeholder={
                platform === "whatsapp"
                  ? t("social.placeholder_phone")
                  : t("social.placeholder_handle")
              }
              value={drafts[platform]}
              onChangeText={(text) => setDrafts((prev) => ({ ...prev, [platform]: text }))}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={platform === "whatsapp" ? "phone-pad" : "default"}
              maxLength={SOCIAL_LINK_MAX_LENGTH}
              editable={!saving}
              accessibilityLabel={label}
            />
          </View>
        )
      })}
    </SettingsEditorSheet>
  )
}
