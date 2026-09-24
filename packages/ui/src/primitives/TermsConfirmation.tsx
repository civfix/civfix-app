import React from "react"
import { View, Pressable } from "react-native"
import {
  a11yState,
  makeThemedStyles,
  webCursor,
  webHover,
  focusRingProps,
  HOVERED_OPACITY,
  PRESSED_OPACITY,
} from "../theme"
import { Text } from "../typography"
import type { LegalDocumentType } from "@civfix/shared"
import { currentVersion } from "@civfix/shared/legal"
import { useOpenExternal } from "../capabilities"
import { useT } from "../i18n"
import { CheckboxBox } from "./CheckboxBox"
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
    <View style={styles.row}>
      <Pressable
        onPress={toggle}
        accessibilityRole="checkbox"
        {...a11yState({ checked: confirmed })}
        accessibilityLabel={t("a11y.affirmation")}
        {...focusRingProps}
        style={(state) => [
          styles.check,
          webCursor(),
          webHover(state) ? styles.checkHovered : null,
          state.pressed ? styles.checkPressed : null,
        ]}
      >
        <CheckboxBox checked={confirmed} />
        <Text variant="body">{t("label.lead").trim()}</Text>
      </Pressable>
      <Text variant="body" style={styles.links}>
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
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: t.space["1"],
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["1"],
    minHeight: 52,
  },
  check: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    minHeight: 44,
    borderRadius: t.radius.sm,
  },
  checkHovered: {
    opacity: HOVERED_OPACITY,
  },
  checkPressed: {
    opacity: PRESSED_OPACITY,
  },
  links: {
    flexShrink: 1,
  },
  link: {
    color: t.colors.accentText,
    textDecorationLine: "underline",
  },
}))
