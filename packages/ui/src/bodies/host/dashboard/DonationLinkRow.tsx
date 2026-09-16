import React, { useCallback } from "react"
import type { OrganizationDTO } from "@civfix/shared"
import { IconTile, ListRow, SectionCard } from "../../../primitives"
import { consoleReachable, openConsolePath } from "../../../primitives/consoleReach"
import { donationUrlHost, safeDonationUrl } from "../../../primitives/donationUrl"
import { manageOrgSettingsPath } from "../../../primitives/externalUrls"
import { useOpenExternal } from "../../../capabilities"
import { useMyProfile } from "../../../data"
import { useT } from "../../../i18n"
import { useNavStore } from "../../../nav"

export interface DonationLinkRowProps {
  org: OrganizationDTO | null
}

export function DonationLinkRow({ org }: DonationLinkRowProps) {
  const { t } = useT("donation-link")
  const openExternal = useOpenExternal()
  const profile = useMyProfile()

  const url = safeDonationUrl(org ? org.donationUrl : profile.data?.profile.donationUrl)
  const orgId = org?.id ?? null

  const openOrgSettings = useCallback(() => {
    if (!orgId) return
    openConsolePath(manageOrgSettingsPath(orgId), openExternal)
  }, [openExternal, orgId])
  const openAccountSettings = useCallback(() => {
    useNavStore.getState().push({ kind: "settings-account" })
  }, [])

  const onPress = orgId ? (consoleReachable ? openOrgSettings : null) : openAccountSettings
  const sub = url
    ? t("dashboard.row_set", { host: donationUrlHost(url) })
    : orgId && !consoleReachable
      ? t("dashboard.row_org_web")
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
