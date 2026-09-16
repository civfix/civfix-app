import React, { useCallback } from "react"
import type { OrganizationDTO } from "@civfix/shared"
import { IconTile, ListRow, SectionCard } from "../../../primitives"
import { donationUrlHost, safeDonationUrl } from "../../../primitives/donationUrl"
import { useMyProfile } from "../../../data"
import { useT } from "../../../i18n"
import { useNavStore } from "../../../nav"
import { canOpenOrgManage } from "../orgManageModel"

export interface DonationLinkRowProps {
  org: OrganizationDTO | null
}

export function DonationLinkRow({ org }: DonationLinkRowProps) {
  const { t } = useT("donation-link")
  const profile = useMyProfile()

  const url = safeDonationUrl(org ? org.donationUrl : profile.data?.profile.donationUrl)
  const manageable = canOpenOrgManage(org)
  const slug = org?.slug ?? null

  const openOrgManage = useCallback(() => {
    if (!slug) return
    useNavStore.getState().push({ kind: "org-manage", slug })
  }, [slug])
  const openAccountSettings = useCallback(() => {
    useNavStore.getState().push({ kind: "settings-account" })
  }, [])

  const onPress = org ? (manageable ? openOrgManage : null) : openAccountSettings
  const sub = url
    ? t("dashboard.row_set", { host: donationUrlHost(url) })
    : org && !manageable
      ? t("dashboard.row_org_admin")
      : t("dashboard.row_unset")

  return (
    <SectionCard variant="list">
      <ListRow
        leading={<IconTile icon="HandHeart" />}
        title={t("dashboard.row")}
        titleLines={1}
        sub={sub}
        {...(onPress ? { chevron: true, onPress } : {})}
      />
    </SectionCard>
  )
}
