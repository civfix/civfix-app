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
  MIN_TOUCH_TARGET,
} from "../theme"
import { Text } from "../typography"
import type { LegalDocumentDTO, LegalDocumentType } from "@civfix/contract"
import { useLegalDocuments } from "../data"
import { useT } from "../i18n"
import { CheckboxBox } from "./CheckboxBox"
import { useOpenLegalDocument } from "./useOpenLegalDocument"

export interface AcceptedLegalDocument {
  type: LegalDocumentType
  version: string
  sha256: string
}

export interface TermsConfirmationProps {
  confirmed: boolean
  onConfirmedChange: (next: boolean) => void
  documents?: readonly LegalDocumentType[]
  onAccept?: (documents: readonly AcceptedLegalDocument[]) => void
}

const DEFAULT_DOCUMENTS: readonly LegalDocumentType[] = ["terms", "privacy"]

function acceptedDocuments(
  fetched: readonly LegalDocumentDTO[] | undefined,
  types: readonly LegalDocumentType[],
): AcceptedLegalDocument[] | null {
  const accepted: AcceptedLegalDocument[] = []
  for (const type of types) {
    const document = fetched?.find((entry) => entry.type === type)
    if (document === undefined) return null
    accepted.push({ type, version: document.version, sha256: document.sha256 })
  }
  return accepted
}

export function TermsConfirmation({
  confirmed,
  onConfirmedChange,
  documents = DEFAULT_DOCUMENTS,
  onAccept,
}: TermsConfirmationProps) {
  const styles = useStyles()
  const { t } = useT("onboarding-terms")
  const openLegal = useOpenLegalDocument()

  const legal = useLegalDocuments({ enabled: onAccept !== undefined })
  // A confirming tick taken before the documents arrived; it is accepted once they do, if still ticked.
  const [acceptPending, setAcceptPending] = React.useState(false)

  const toggle = React.useCallback(() => {
    const next = !confirmed
    onConfirmedChange(next)
    if (!onAccept) return
    const accepted = next ? acceptedDocuments(legal.data, documents) : null
    if (accepted) onAccept(accepted)
    setAcceptPending(next && accepted === null)
  }, [confirmed, documents, legal.data, onAccept, onConfirmedChange])

  React.useEffect(() => {
    if (!acceptPending || !onAccept) return
    if (!confirmed) {
      setAcceptPending(false)
      return
    }
    const accepted = acceptedDocuments(legal.data, documents)
    if (accepted === null) return
    setAcceptPending(false)
    onAccept(accepted)
  }, [acceptPending, confirmed, documents, legal.data, onAccept])

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
          onPress={() => openLegal("terms")}
          accessibilityRole="link"
          accessibilityLabel={t("a11y.terms_link")}
        >
          {t("label.terms")}
        </Text>
        {t("label.conjunction")}
        <Text
          variant="body"
          style={styles.link}
          onPress={() => openLegal("privacy")}
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
    minHeight: MIN_TOUCH_TARGET,
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
