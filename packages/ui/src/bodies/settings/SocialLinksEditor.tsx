import React, { useState } from "react"
import { View } from "react-native"
import {
  SocialLinksSchema,
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
} from "@civfix/shared"
import type { SocialLinks, SocialPlatform } from "@civfix/shared"
import { Text } from "../../typography"
import {
  ModalCardSheet,
  PrimaryButton,
  SecondaryButton,
  SettingsRow,
  TextField,
} from "../../primitives"
import { useT } from "../../i18n"
import { profileSaveErrorKey } from "../errorCode"
import { useEditorStyles } from "./editorStyles"

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
  const [editing, setEditing] = useState(false)
  const [drafts, setDrafts] = useState<Record<SocialPlatform, string>>(() =>
    socialDraftsFrom(socialLinks),
  )
  const [submitError, setSubmitError] = useState<string | null>(null)

  const count = SOCIAL_PLATFORMS.filter((platform) => {
    const value = socialLinks?.[platform]
    return typeof value === "string" && value.trim().length > 0
  }).length

  const saved = socialDraftsFrom(socialLinks)
  const dirty = SOCIAL_PLATFORMS.some(
    (platform) =>
      normalizeSocialValue(platform, drafts[platform] ?? "") !==
      normalizeSocialValue(platform, saved[platform] ?? ""),
  )
  const canSave = !saving && dirty

  const begin = () => {
    setDrafts(socialDraftsFrom(socialLinks))
    setSubmitError(null)
    setEditing(true)
  }
  const cancel = () => {
    setSubmitError(null)
    setEditing(false)
  }
  const save = () => {
    if (!canSave) return
    const parsed = SocialLinksSchema.safeParse(normalizedLinks(drafts))
    if (!parsed.success) {
      setSubmitError(t("social.error.invalid"))
      return
    }
    setSubmitError(null)
    void onSave(parsed.data)
      .then(() => setEditing(false))
      .catch((err: unknown) =>
        setSubmitError(t(profileSaveErrorKey(err, "social.error.save", "social.error.invalid"))),
      )
  }

  return (
    <>
      <SettingsRow
        icon="Link2"
        label={t("social.title")}
        sub={count > 0 ? t("social.count", { count }) : t("social.add")}
        onPress={begin}
      />
      <ModalCardSheet
        visible={editing}
        onClose={cancel}
        onCommit={save}
        headerIcon="Link2"
        title={t("social.title")}
        dismissLabel={t("social.dismiss")}
        error={submitError}
        actions={
          <>
            <SecondaryButton label={t("common:cancel")} onPress={cancel} size="sm" />
            <PrimaryButton
              label={t("social.save")}
              onPress={save}
              loading={saving}
              disabled={!canSave}
            />
          </>
        }
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
                maxLength={120}
                editable={!saving}
                accessibilityLabel={label}
              />
            </View>
          )
        })}
      </ModalCardSheet>
    </>
  )
}
