import React, { useCallback } from "react"
import { IconTile, ListRow, SectionCard } from "../../../primitives"
import { managePath, manageOrgPath, managePortfolioPath } from "../../../primitives/externalUrls"
import { openConsolePath } from "../../../primitives/consoleReach"
import { useOpenExternal } from "../../../capabilities"
import { useT } from "../../../i18n"
import type { ConsoleLinkRowProps, ConsoleLinkTarget } from "./ConsoleLinkRow.types"

function pathFor(target: ConsoleLinkTarget): string {
  switch (target.kind) {
    case "org":
      return manageOrgPath(target.orgId)
    case "event":
      return managePath(target.eventId)
    default:
      return managePortfolioPath()
  }
}

export function ConsoleLinkRow({ target }: ConsoleLinkRowProps) {
  const { t } = useT("event-dashboard")
  const openExternal = useOpenExternal()

  const open = useCallback(() => {
    openConsolePath(pathFor(target), openExternal)
  }, [openExternal, target])

  return (
    <SectionCard variant="list">
      <ListRow
        leading={<IconTile icon="Building2" />}
        title={t("console.open")}
        titleLines={1}
        sub={t("console.sub")}
        chevron
        onPress={open}
      />
    </SectionCard>
  )
}
