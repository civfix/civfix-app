import React from "react"
import { View } from "react-native"
import type { TFunction } from "i18next"
import type { OrganizationDTO, PersonDTO } from "@civfix/shared"
import { Avatar } from "../../primitives"
import { Text } from "../../typography"
import { usePostComposerStyles } from "./postComposerStyles"

const AUTHOR_AVATAR = 34

export function ComposerAuthorRow({
  postAsOrganization,
  profile,
  t,
}: {
  postAsOrganization: OrganizationDTO | null
  profile: PersonDTO | undefined
  t: TFunction
}) {
  const styles = usePostComposerStyles()
  return (
    <View style={styles.authorRow}>
      {postAsOrganization ? (
        <Avatar
          name={postAsOrganization.name}
          seed={postAsOrganization.id}
          photoUrl={postAsOrganization.logoUrl ?? null}
          size={AUTHOR_AVATAR}
          style={styles.authorOrgLogo}
        />
      ) : (
        <Avatar name={profile?.name ?? t("post_as.personal")} seed={profile?.id} photoUrl={profile?.avatarUrl} gradient={profile?.avatar ?? null} size={AUTHOR_AVATAR} />
      )}
      <Text style={styles.authorName}>{postAsOrganization?.name ?? profile?.name ?? t("post_as.personal")}</Text>
    </View>
  )
}
