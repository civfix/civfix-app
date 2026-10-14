import React from "react"
import { Text } from "../../typography"
import {
  ModalCardSheet,
  PopoverMenu,
  PrimaryButton,
  ReportContentSheet,
  SecondaryButton,
} from "../../primitives"
import type { PopoverMenuItem } from "../../primitives"
import { useT } from "../../i18n"
import type { PersonModeration } from "./usePersonModeration"
import { usePersonDetailStyles } from "./personDetailStyles"

export function PersonModerationLayer({
  name,
  menuItems,
  moderation,
}: {
  name: string
  menuItems: PopoverMenuItem[]
  moderation: PersonModeration
}) {
  const styles = usePersonDetailStyles()
  const { t } = useT("profile-person")
  const {
    menuOpen,
    menuRect,
    closeMenu,
    confirmingBlock,
    closeBlockConfirm,
    confirmBlock,
    blockUser,
    reporting,
    reportContent,
    onSubmitReport,
    closeReport,
  } = moderation

  return (
    <>
      <PopoverMenu
        visible={menuOpen}
        anchorRect={menuRect}
        onClose={closeMenu}
        items={menuItems}
      />

      <ModalCardSheet
        visible={confirmingBlock}
        onClose={closeBlockConfirm}
        headerIcon="Ban"
        tone="danger"
        title={t("block.confirm")}
        dismissLabel={t("block.cancel")}
        actions={
          <>
            <SecondaryButton label={t("block.cancel")} onPress={closeBlockConfirm} size="sm" />
            <PrimaryButton
              label={t("block.confirm")}
              variant="destructive"
              onPress={confirmBlock}
              loading={blockUser.isPending}
            />
          </>
        }
      >
        <Text style={styles.confirmText}>
          {t("block.confirm_message", { name })}
        </Text>
      </ModalCardSheet>

      <ReportContentSheet
        visible={reporting}
        subjectLabel={t("report.subject_label")}
        pending={reportContent.isPending}
        error={reportContent.isError ? t("report.error") : null}
        onSubmit={onSubmitReport}
        onClose={closeReport}
      />
    </>
  )
}
