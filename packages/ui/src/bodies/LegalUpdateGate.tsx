import React, { useCallback, useContext, useRef, useState } from "react"
import { ScrollView, View } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import type { LegalDocumentMetaDTO, LegalDocumentType } from "@civfix/contract"
import { headingLevel, makeThemedStyles, useTheme } from "../theme"
import { Text, TextLink } from "../typography"
import {
  outdatedLegalVersions,
  promptAcceptance,
  useAcceptLegal,
  useAuthState,
  useLogout,
  useMyLegalStatus,
} from "../data"
import { useT } from "../i18n"
import { PrimaryButton } from "../primitives/PrimaryButton"
import { LegalDocumentScreen } from "./LegalDocumentScreen"
import { LEGAL_GATE_LAYER, useContainOutside } from "./legalGateLayer"
import { useHardwareBack } from "./reportFlow/useHardwareBack"

const TITLE_ID = "legal-update-title"

// Wide enough for the summaries to read as prose on a desktop screen.
const READABLE_MAX_WIDTH = 560

const DOCUMENT_ORDER: readonly LegalDocumentType[] = ["terms", "privacy", "cookies", "subprocessors"]

const READ_KEYS = {
  terms: "update.read.terms",
  privacy: "update.read.privacy",
  cookies: "update.read.cookies",
  subprocessors: "update.read.subprocessors",
} as const satisfies Record<LegalDocumentType, string>

// D4 only ever requires the Terms and the Privacy notice.
function titleKey(types: readonly LegalDocumentType[]) {
  if (!types.includes("terms")) return "update.title.privacy"
  return types.includes("privacy") ? "update.title.terms_and_privacy" : "update.title.terms"
}

/**
 * The full-screen prompt for an updated Terms or Privacy notice. It opens over every route once first
 * run is done, and only Accept and continue or Sign out leave it. A status that is loading or can't be
 * read shows nothing, so a network failure never locks anyone out; the next app start asks again.
 */
export function LegalUpdateGate() {
  const { isAuthenticated, user } = useAuthState()
  const status = useMyLegalStatus()
  const { refetch } = status
  const onOutdated = useCallback(() => void refetch(), [refetch])
  // First run owns the screen until the profile is saved, and its Continue records these same documents.
  if (!isAuthenticated || user?.profileComplete === false) return null
  const required = status.data?.required ?? []
  if (required.length === 0) return null
  return <LegalUpdateScreen required={required} notices={status.data?.notices ?? []} onOutdated={onOutdated} />
}

interface LegalUpdateScreenProps {
  required: LegalDocumentMetaDTO[]
  notices: LegalDocumentMetaDTO[]
  /** A version that stopped being current while the screen was up: the server names the new ones. */
  onOutdated: () => void
}

function LegalUpdateScreen({ required, notices, onOutdated }: LegalUpdateScreenProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("legal")
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 }
  const logout = useLogout()
  const accept = useAcceptLegal()
  const [reading, setReading] = useState<LegalDocumentType | null>(null)
  const rootRef = useRef<View>(null)
  useContainOutside(rootRef)

  const closeReading = useCallback(() => setReading(null), [])
  // Back always lands here: it closes a document being read and otherwise does nothing.
  useHardwareBack(true, closeReading)

  const owed = [...required].sort((a, b) => DOCUMENT_ORDER.indexOf(a.type) - DOCUMENT_ORDER.indexOf(b.type))
  const owedVersion = (type: LegalDocumentType) => owed.find((item) => item.type === type)?.version

  // isPending reaches the button a render later, after a quick second press has already landed.
  const sending = useRef(false)
  const onAccept = () => {
    if (sending.current) return
    sending.current = true
    accept.mutate(promptAcceptance({ required: owed, notices }), {
      onError: (err) => {
        if (outdatedLegalVersions(err) !== null) onOutdated()
      },
      onSettled: () => {
        sending.current = false
      },
    })
  }
  // An outdated version isn't the person's problem: the screen shows the new one and they accept that.
  const failed = accept.isError && outdatedLegalVersions(accept.error) === null

  return (
    <View
      ref={rootRef}
      style={[LEGAL_GATE_LAYER, styles.layer]}
      role="dialog"
      aria-modal
      accessibilityViewIsModal
      {...(reading === null ? { "aria-labelledby": TITLE_ID } : { "aria-label": t(READ_KEYS[reading]) })}
    >
      {reading !== null ? (
        <LegalDocumentScreen
          type={reading}
          version={owedVersion(reading)}
          onBack={closeReading}
          onOpenLegalDocument={setReading}
        />
      ) : (
        <View style={[styles.page, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            <View style={styles.column}>
              <Text id={TITLE_ID} accessibilityRole="header" {...headingLevel(1)} style={styles.title}>
                {t(titleKey(owed.map((item) => item.type)))}
              </Text>
              {owed.map((item) => (
                <View key={item.type} style={styles.document}>
                  {item.summary ? <Text style={styles.summary}>{item.summary}</Text> : null}
                  <TextLink standalone onPress={() => setReading(item.type)}>
                    {t(READ_KEYS[item.type])}
                  </TextLink>
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: insets.bottom + th.space["5"] }]}>
            <View style={styles.column}>
              {failed ? (
                <Text style={styles.error} accessibilityRole="alert">
                  {t("accept_error")}
                </Text>
              ) : null}
              <PrimaryButton label={t("update.accept")} loading={accept.isPending} onPress={onAccept} />
              <PrimaryButton label={t("update.sign_out")} variant="ghost" onPress={() => void logout()} />
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  layer: {
    backgroundColor: t.colors.bg,
  },
  page: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: t.space["8"],
    paddingHorizontal: t.space["5"],
  },
  column: {
    width: "100%",
    maxWidth: READABLE_MAX_WIDTH,
    alignSelf: "center",
    gap: t.space["4"],
  },
  title: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["30"],
    lineHeight: t.fontSize["30"] * t.lineHeight.snug,
    color: t.colors.text,
  },
  document: {
    alignItems: "flex-start",
    gap: t.space["2"],
  },
  summary: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["16"],
    lineHeight: t.fontSize["16"] * t.lineHeight.loose,
    color: t.colors.text,
  },
  footer: {
    paddingTop: t.space["4"],
    paddingHorizontal: t.space["5"],
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
  error: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["14"],
    lineHeight: t.fontSize["14"] * t.lineHeight.base,
    color: t.colors.dangerInk,
  },
}))
