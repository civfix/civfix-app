import React, { useCallback, useRef, useState } from "react"
import { View } from "react-native"
import type { SocialLinks, UpdateProfileRequest } from "@civfix/shared"
import { makeThemedStyles, useTheme } from "../theme"
import { iconMap } from "../typography"
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
import { useT } from "../i18n"
import { DeleteAccountModal } from "./DeleteAccountModal"
import { AvatarSettingRow } from "./settings/AvatarSettingRow"
import { avatarErrorMessage, uploadAvatar } from "./settings/avatarUpload"
import { BioEditor } from "./settings/BioEditor"
import { ChangeUsernameEditor } from "./settings/ChangeUsernameEditor"
import { DataExportSection } from "./settings/DataExportSection"
import { DisplayNameEditor } from "./settings/DisplayNameEditor"
import { DonationLinkEditor } from "./settings/DonationLinkEditor"
import { PrimaryOrganizationPicker } from "./settings/PrimaryOrganizationPicker"
import { SocialLinksEditor } from "./settings/SocialLinksEditor"

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
  // Guards the whole pick-then-upload run; the visible uploading state only starts once a photo is
  // chosen, so a second tap while the OS picker is open must not open a second picker.
  const avatarBusyRef = useRef(false)

  // Every save re-sends the current handle and display name, which the request requires.
  const saveProfile = useCallback(
    (patch: Partial<UpdateProfileRequest>): Promise<void> => {
      if (!profile) return Promise.resolve()
      return updateProfile
        .mutateAsync({ handle: profile.handle ?? "", displayName: profile.name, ...patch })
        .then(() => undefined)
    },
    [profile, updateProfile],
  )

  const onSaveName = useCallback(
    (displayName: string): Promise<void> => saveProfile({ displayName }),
    [saveProfile],
  )

  const onSaveBio = useCallback(
    (bio: string): Promise<void> => saveProfile({ bio: bio.length > 0 ? bio : null }),
    [saveProfile],
  )

  const onChangeAvatar = useCallback(() => {
    if (!profile || avatarBusyRef.current) return
    avatarBusyRef.current = true
    void (async () => {
      try {
        const picked = await camera.pickFromLibrary()
        if (!picked || picked.kind !== "image") return
        setAvatarUploading(true)
        const avatarUploadId = await uploadAvatar(api, camera, picked)
        await saveProfile({ avatarUploadId })
      } catch (err) {
        toast.show(avatarErrorMessage(err, t), { variant: "error" })
      } finally {
        avatarBusyRef.current = false
        setAvatarUploading(false)
      }
    })()
  }, [api, camera, profile, saveProfile, toast, t])

  const onSaveHandle = useCallback(
    (handle: string): Promise<void> =>
      saveProfile({ handle, bio: profile?.bio && profile.bio.length > 0 ? profile.bio : null }),
    [profile, saveProfile],
  )

  const onSaveSocialLinks = useCallback(
    (socialLinks: SocialLinks): Promise<void> => saveProfile({ socialLinks }),
    [saveProfile],
  )

  const onSaveDonationUrl = useCallback(
    (donationUrl: string | null): Promise<void> => saveProfile({ donationUrl }),
    [saveProfile],
  )

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

      <DataExportSection requestMyData={requestMyData} style={styles.sectionGap} />

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
}))
