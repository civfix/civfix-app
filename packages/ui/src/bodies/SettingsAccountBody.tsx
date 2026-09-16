import React, { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import type { SocialLinks } from "@civfix/shared"
import { makeThemedStyles, useTheme } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import {
  EmptyState,
  SettingsRow,
  SettingsSection,
  SignInPrompt,
  SkeletonGroup,
  SkeletonList,
  SkeletonRow,
  SkeletonText,
  useToast,
} from "../primitives"
import {
  useApi,
  useAuthState,
  useMyProfile,
  useRequestMyData,
  useRequireAuth,
  useUpdateProfile,
} from "../data"
import { useCamera } from "../capabilities"
import { useScrollHost } from "../shell/ScrollHost"
import { announce } from "../announce"
import { useT } from "../i18n"
import { appErrorCode } from "./errorCode"
import { DeleteAccountModal } from "./DeleteAccountModal"
import { AvatarSettingRow } from "./settings/AvatarSettingRow"
import { avatarErrorMessage, uploadAvatar } from "./settings/avatarUpload"
import { BioEditor } from "./settings/BioEditor"
import { ChangeUsernameEditor } from "./settings/ChangeUsernameEditor"
import { DisplayNameEditor } from "./settings/DisplayNameEditor"
import { DonationLinkEditor } from "./settings/DonationLinkEditor"
import { PrimaryOrganizationPicker } from "./settings/PrimaryOrganizationPicker"
import { SocialLinksEditor } from "./settings/SocialLinksEditor"

type Translate = (key: string, options?: Record<string, unknown>) => string

function requestErrorMessage(err: unknown, t: Translate): string {
  switch (appErrorCode(err)) {
    case "VALIDATION":
      return t("data_export.error.no_email")
    case "RATE_LIMITED":
      return t("data_export.error.rate_limited")
    default:
      return t("data_export.error.generic")
  }
}

export function SettingsAccountBody() {
  const styles = useStyles()
  const th = useTheme()
  const { ScrollView } = useScrollHost()
  const { t } = useT("settings-account")
  const { isAuthenticated, isPending, user } = useAuthState()
  const requireAuth = useRequireAuth()
  const query = useMyProfile()
  const profile = query.data?.profile
  const updateProfile = useUpdateProfile()
  const requestMyData = useRequestMyData()
  const api = useApi()
  const camera = useCamera()
  const toast = useToast()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)

  const onSaveName = useCallback(
    (displayName: string): Promise<void> => {
      if (!profile) return Promise.resolve()
      return updateProfile
        .mutateAsync({ handle: profile.handle ?? "", displayName })
        .then(() => undefined)
    },
    [profile, updateProfile],
  )

  const onSaveBio = useCallback(
    (bio: string): Promise<void> => {
      if (!profile) return Promise.resolve()
      return updateProfile
        .mutateAsync({
          handle: profile.handle ?? "",
          displayName: profile.name,
          bio: bio.length > 0 ? bio : null,
        })
        .then(() => undefined)
    },
    [profile, updateProfile],
  )

  const onChangeAvatar = useCallback(() => {
    if (!profile || avatarUploading) return
    void (async () => {
      setAvatarUploading(true)
      try {
        const picked = await camera.pickFromLibrary()
        if (!picked || picked.kind !== "image") return
        const avatarUploadId = await uploadAvatar(api, camera, picked)
        await updateProfile.mutateAsync({
          handle: profile.handle ?? "",
          displayName: profile.name,
          avatarUploadId,
        })
      } catch (err) {
        toast.show(avatarErrorMessage(err, t), { variant: "error" })
      } finally {
        setAvatarUploading(false)
      }
    })()
  }, [api, camera, profile, avatarUploading, updateProfile, toast, t])

  const onSaveHandle = useCallback(
    (handle: string): Promise<void> => {
      if (!profile) return Promise.resolve()
      return updateProfile
        .mutateAsync({
          handle,
          displayName: profile.name,
          bio: profile.bio && profile.bio.length > 0 ? profile.bio : null,
        })
        .then(() => undefined)
    },
    [profile, updateProfile],
  )

  const onSaveSocialLinks = useCallback(
    (socialLinks: SocialLinks): Promise<void> => {
      if (!profile) return Promise.resolve()
      return updateProfile
        .mutateAsync({
          handle: profile.handle ?? "",
          displayName: profile.name,
          socialLinks,
        })
        .then(() => undefined)
    },
    [profile, updateProfile],
  )

  const onSaveDonationUrl = useCallback(
    (donationUrl: string | null): Promise<void> => {
      if (!profile) return Promise.resolve()
      return updateProfile
        .mutateAsync({
          handle: profile.handle ?? "",
          displayName: profile.name,
          donationUrl,
        })
        .then(() => undefined)
    },
    [profile, updateProfile],
  )

  const onRequestData = useCallback(() => {
    if (requestMyData.isPending) return
    requestMyData.mutate()
  }, [requestMyData])

  useEffect(() => {
    if (requestMyData.status === "success") {
      announce(
        requestMyData.data?.email
          ? t("data_export.announce.success_email", { email: requestMyData.data.email })
          : t("data_export.announce.success"),
      )
    } else if (requestMyData.status === "error") {
      announce(t("data_export.announce.failed"))
    }
  }, [requestMyData.status, requestMyData.data, t])

  if (!isAuthenticated && !isPending) {
    return (
      <View style={styles.stateFill}>
        <SignInPrompt
          icon={iconMap.User}
          iconSize={32}
          variant="detail"
          title={t("signedOut.title")}
          body={t("signedOut.body")}
          onSignIn={() => requireAuth(() => {}, { next: "/settings/account" })}
        />
      </View>
    )
  }

  if (isPending || query.isLoading) {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SkeletonGroup>
          <SkeletonText width="34%" height={11} style={styles.skeletonLabel} />
          <SkeletonRow kind="person" />
          <SkeletonList rows={3} kind="settings" />
        </SkeletonGroup>
        <SkeletonGroup style={styles.sectionGap}>
          <SkeletonText width="26%" height={11} style={styles.skeletonLabel} />
          <SkeletonList rows={3} kind="settings" />
        </SkeletonGroup>
        <SkeletonGroup style={styles.sectionGap}>
          <SkeletonText width="30%" height={11} style={styles.skeletonLabel} />
          <SkeletonList rows={2} kind="settings" />
        </SkeletonGroup>
      </ScrollView>
    )
  }

  if (query.isError || !profile) {
    return (
      <View style={styles.stateFill}>
        <EmptyState
          variant="detail"
          tone="neutral"
          icon={iconMap.CloudOff}
          iconColor={th.colors.textSubtle}
          iconSize={30}
          title={t("error.title")}
          body={t("error.body")}
        />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SettingsSection label={t("section.identity")}>
        <AvatarSettingRow
          profile={profile}
          uploading={avatarUploading}
          onPress={onChangeAvatar}
        />
        <DisplayNameEditor
          currentName={profile.name}
          saving={updateProfile.isPending}
          onSave={onSaveName}
        />
        <BioEditor
          currentBio={profile.bio}
          saving={updateProfile.isPending}
          onSave={onSaveBio}
        />
        <SettingsRow icon="Mail" label={t("email.label")} sub={user?.email ?? t("email.none")} />
        <ChangeUsernameEditor
          currentHandle={profile.handle}
          lockedUntil={user?.handleChangeableAt}
          saving={updateProfile.isPending}
          onSave={onSaveHandle}
        />
        <SocialLinksEditor
          socialLinks={profile.socialLinks}
          saving={updateProfile.isPending}
          onSave={onSaveSocialLinks}
        />
        <DonationLinkEditor
          currentUrl={profile.donationUrl}
          saving={updateProfile.isPending}
          onSave={onSaveDonationUrl}
        />
      </SettingsSection>

      <PrimaryOrganizationPicker style={styles.sectionGap} />

      <SettingsSection label={t("section.data")} style={styles.sectionGap}>
        <SettingsRow
          icon="Download"
          label={requestMyData.isPending ? t("data_export.requesting") : t("data_export.request")}
          sub={t("data_export.sub")}
          onPress={onRequestData}
          disabled={requestMyData.isPending}
          chevron={false}
          accessibilityLabel={t("data_export.request_a11y")}
        />
      </SettingsSection>

      {requestMyData.isSuccess ? (
        <View style={styles.dataNote}>
          <Icon icon={iconMap.CheckCircle2} size={14} color={th.colors.moss["600"]} />
          <Text style={styles.dataNoteText}>
            {requestMyData.data?.email
              ? t("data_export.note.success_email", { email: requestMyData.data.email })
              : t("data_export.note.success")}
          </Text>
        </View>
      ) : requestMyData.isError ? (
        <View style={styles.dataNote}>
          <Icon icon={iconMap.AlertCircle} size={14} color={th.colors.bloom["600"]} />
          <Text style={[styles.dataNoteText, styles.dataNoteWarnText]}>
            {requestErrorMessage(requestMyData.error, t)}
          </Text>
        </View>
      ) : null}

      <SettingsSection style={styles.sectionGap}>
        <SettingsRow
          icon="Trash2"
          label={t("delete_account.label")}
          sub={t("delete_account.sub")}
          variant="destructive"
          onPress={() => setDeleteOpen(true)}
        />
      </SettingsSection>

      <DeleteAccountModal
        visible={deleteOpen}
        email={user?.email}
        onClose={() => setDeleteOpen(false)}
      />
    </ScrollView>
  )
}

const useStyles = makeThemedStyles((t) => ({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: t.space["4"],
    paddingTop: t.space["2"],
    paddingBottom: t.space["10"],
  },
  stateFill: {
    flex: 1,
  },
  sectionGap: {
    marginTop: t.space["6"],
  },
  skeletonLabel: {
    marginBottom: t.space["3"],
  },
  dataNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 2,
    marginTop: t.space["2"],
  },
  dataNoteText: {
    flex: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12.5,
    color: t.colors.moss["700"],
  },
  dataNoteWarnText: {
    color: t.colors.bloom["700"],
  },
}))
