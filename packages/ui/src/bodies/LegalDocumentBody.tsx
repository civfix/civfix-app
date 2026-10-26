import React from "react"
import { View } from "react-native"
import { ErrorCode, LegalVersionSchema, toAppError, type LegalDocumentType } from "@civfix/contract"
import { makeThemedStyles, useTheme } from "../theme"
import { Text, TextLink, iconMap } from "../typography"
import { useLegalDocument } from "../data"
import { useT } from "../i18n"
import { EmptyState, LoadingState } from "../primitives/StateView"
import { LegalDocumentView, type LegalDocumentViewProps } from "../primitives/LegalDocumentView"
import { readableLegalDocument } from "../primitives/legalDocument"
import { openLegalDocumentInPlace } from "../primitives/legalDocumentNav"

export interface LegalDocumentBodyProps {
  type: LegalDocumentType
  /** An exact version to show instead of the current one (the web's `?version=`). */
  version?: string | undefined
  onOpenLegalDocument?: LegalDocumentViewProps["onOpenLegalDocument"]
  /** Shows the current version in place of a missing earlier one; without it, the document's own page opens. */
  onOpenCurrentVersion?: ((type: LegalDocumentType) => void) | undefined
}

export function LegalDocumentBody({
  type,
  version,
  onOpenLegalDocument,
  onOpenCurrentVersion,
}: LegalDocumentBodyProps) {
  const requested = version !== undefined && LegalVersionSchema.safeParse(version).success ? version : undefined
  const current = useLegalDocument(type)
  const pinned = useLegalDocument(type, requested)

  // A version that can't exist, the server doesn't have, or has no text for is a missing earlier
  // version, not an outage, so it never offers a retry.
  if (version !== undefined && requested === undefined) {
    return <EarlierVersionUnavailable type={type} onOpenCurrent={onOpenCurrentVersion} />
  }

  const query = requested === undefined ? current : pinned
  if (query.isPending || (requested !== undefined && current.isPending)) return <LoadingState variant="detail" />
  if (query.isError) {
    if (requested !== undefined && toAppError(query.error).code === ErrorCode.NOT_FOUND) {
      return <EarlierVersionUnavailable type={type} onOpenCurrent={onOpenCurrentVersion} />
    }
    return <LoadFailed onRetry={() => void query.refetch()} />
  }

  const document = readableLegalDocument(query.data)
  if (document === null) {
    return requested === undefined ? (
      <LoadFailed onRetry={() => void query.refetch()} />
    ) : (
      <EarlierVersionUnavailable type={type} onOpenCurrent={onOpenCurrentVersion} />
    )
  }
  // Without the current version the pinned one can't be labelled current or earlier truthfully.
  if (current.isError) return <LoadFailed onRetry={() => void current.refetch()} />
  return (
    <LegalDocumentView
      document={document}
      current={current.data?.version === document.version}
      onOpenLegalDocument={onOpenLegalDocument}
    />
  )
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useT("legal")
  const th = useTheme()
  return (
    <EmptyState
      variant="detail"
      tone="neutral"
      icon={iconMap.CloudOff}
      iconColor={th.colors.textSubtle}
      title={t("error.title")}
      body={t("error.body")}
      cta={{ label: t("retry"), onPress: onRetry }}
    />
  )
}

function EarlierVersionUnavailable({
  type,
  onOpenCurrent,
}: {
  type: LegalDocumentType
  onOpenCurrent: LegalDocumentBodyProps["onOpenCurrentVersion"]
}) {
  const styles = useStyles()
  const { t } = useT("legal")
  const openCurrent = () => {
    if (onOpenCurrent) onOpenCurrent(type)
    else openLegalDocumentInPlace(type)
  }
  return (
    <View style={styles.unavailable}>
      <Text variant="bodyStrong">{t("unavailable")}</Text>
      <TextLink standalone onPress={openCurrent}>
        {t("current_link")}
      </TextLink>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  unavailable: {
    alignItems: "flex-start",
    gap: t.space["2"],
    paddingVertical: t.space["6"],
  },
}))
