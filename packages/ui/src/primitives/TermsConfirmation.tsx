import React from "react"
import { View, Pressable } from "react-native"
import { makeThemedStyles, useTheme, webCursor, webHover, focusRingProps } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import type { LegalDocumentType } from "@civfix/shared"
import { currentVersion } from "@civfix/shared/legal"
import { useOpenExternal } from "../capabilities"
import { useT } from "../i18n"
import { PRIVACY_URL, TERMS_URL } from "./externalUrls"

export interface AcceptedLegalDocument {
  id: LegalDocumentType
  version: string
}

export interface TermsConfirmationProps {
  confirmed: boolean
  onConfirmedChange: (next: boolean) => void
  documents?: readonly LegalDocumentType[]
  onAccept?: (documents: readonly AcceptedLegalDocument[]) => void
}

const DEFAULT_DOCUMENTS: readonly LegalDocumentType[] = ["terms", "privacy"]

export function TermsConfirmation({
  confirmed,
  onConfirmedChange,
  documents = DEFAULT_DOCUMENTS,
  onAccept,
}: TermsConfirmationProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("onboarding-terms")
  const openExternal = useOpenExternal()
  const openLegal = React.useCallback(
    (url: string) => {
      void openExternal?.open(url)
    },
    [openExternal],
  )

  const toggle = React.useCallback(() => {
    const next = !confirmed
    onConfirmedChange(next)
    if (next && onAccept) {
      onAccept(documents.map((id) => ({ id, version: currentVersion(id) })))
    }
  }, [confirmed, documents, onAccept, onConfirmedChange])

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: confirmed }}
      accessibilityLabel={t("a11y.affirmation")}
      {...focusRingProps}
      style={(state) => [
        styles.row,
        webCursor(),
        webHover(state) ? styles.rowHovered : null,
        state.pressed ? styles.rowPressed : null,
      ]}
    >
      <View style={[styles.box, confirmed ? styles.boxChecked : null]}>
        {confirmed ? <Icon icon={iconMap.Check} size={14} color={th.colors.onAccent} /> : null}
      </View>
      <Text variant="body" style={styles.label}>
        {t("label.lead")}
        <Text
          variant="body"
          style={styles.link}
          onPress={() => openLegal(TERMS_URL)}
          accessibilityRole="link"
          accessibilityLabel={t("a11y.terms_link")}
        >
          {t("label.terms")}
        </Text>
        {t("label.conjunction")}
        <Text
          variant="body"
          style={styles.link}
          onPress={() => openLegal(PRIVACY_URL)}
          accessibilityRole="link"
          accessibilityLabel={t("a11y.privacy_link")}
        >
          {t("label.privacy")}
        </Text>
        {t("label.trailing")}
      </Text>
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["3"],
    minHeight: 52,
  },
  rowHovered: {
    borderColor: t.colors.borderStrong,
  },
  rowPressed: {
    opacity: 0.92,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: t.radius.xs,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: {
    backgroundColor: t.colors.brand.bloom,
    borderColor: t.colors.brand.bloom,
  },
  label: {
    flex: 1,
  },
  link: {
    color: t.colors.accentText,
    textDecorationLine: "underline",
  },
}))
