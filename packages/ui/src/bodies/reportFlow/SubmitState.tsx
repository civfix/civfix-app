import React, { useEffect } from "react"
import { View, ActivityIndicator } from "react-native"
import { makeThemedStyles, useTheme } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { PrimaryButton, SuccessCheck } from "../../primitives"
import { useAuthState } from "../../data"
import { useNavStore } from "../../nav"
import { announce } from "../../announce"
import type { ReportSubmitOutcome } from "../../report/submit"
import { useT } from "../../i18n"
import { FeedShareOutcomeRow } from "./FeedShareOutcomeRow"
import type { ShareSnapshot, SubmitPhase } from "./submitFlowModel"
import { SUBMIT_STATE_MAX_WIDTH } from "./flowStyles"

const ERROR_ICON_SIZE = 72

export function SubmitState({
  phase,
  error,
  retryable,
  result,
  share,
  onRetry,
  onEdit,
}: {
  phase: Exclude<SubmitPhase, "idle">
  error: string | null
  retryable: boolean
  result: ReportSubmitOutcome | null
  share: ShareSnapshot | null
  onRetry: () => void
  onEdit: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("report-wizard")
  const { isAuthenticated } = useAuthState()
  useEffect(() => {
    if (phase === "error") announce(t("submit.announce_error", { detail: error ?? "" }))
  }, [phase, error, t])
  useEffect(() => {
    if (phase === "done") {
      announce(
        result?.status === "held"
          ? t("submit.announce_held")
          : t("submit.announce_live"),
      )
    }
  }, [phase, result, t])

  if (phase === "submitting") {
    return (
      <View style={styles.stateFill}>
        <ActivityIndicator size="large" color={th.colors.brand.bloom} />
        <Text variant="title" style={styles.stateTitle}>
          {t("submit.submitting_title")}
        </Text>
        <Text variant="body" color={th.colors.textMuted} style={styles.stateBody}>
          {t("submit.submitting_body")}
        </Text>
      </View>
    )
  }

  if (phase === "error") {
    return (
      <View style={styles.stateFill}>
        <View style={styles.errorIcon}>
          <Icon icon={iconMap.CloudOff} size={30} color={th.colors.bloom["600"]} />
        </View>
        <Text variant="title" style={styles.stateTitle}>
          {t("submit.error_title")}
        </Text>
        <Text variant="body" color={th.colors.textMuted} style={styles.stateBody}>
          {error}
        </Text>
        <View style={styles.errorActions}>
          {retryable ? (
            <PrimaryButton label={t("submit.try_again")} icon={iconMap.RefreshCw} onPress={onRetry} />
          ) : null}
          <PrimaryButton
            label={t("submit.edit_report")}
            variant={retryable ? "outline" : undefined}
            onPress={onEdit}
          />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.stateFill}>
      <View style={styles.successCheck}>
        <SuccessCheck announce={t("submit.success_title")} />
      </View>
      <Text variant="body" color={th.colors.textMuted} style={styles.stateBody}>
        {result?.status === "held"
          ? t("submit.success_body_held")
          : t("submit.success_body_live")}
      </Text>
      {result && share ? (
        <FeedShareOutcomeRow key={result.reportId} outcome={result.feedShare} share={share} />
      ) : null}
      {!isAuthenticated ? (
        <Text variant="caption" color={th.colors.textSubtle} style={styles.signedOutHint}>
          {t("share.signed_out_hint")}
        </Text>
      ) : null}
      <View style={styles.successActions}>
        {result ? (
          <PrimaryButton
            label={t("submit.view_report")}
            variant="outline"
            onPress={() => {
              useNavStore.getState().finishReportFlow({
                kind: "pin",
                id: result.reportId,
                lat: result.lat,
                lng: result.lng,
              })
            }}
          />
        ) : null}
        <PrimaryButton label={t("submit.done")} onPress={() => useNavStore.getState().leaveReportFlow()} />
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  stateFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: t.space["6"],
  },
  stateTitle: { marginTop: t.space["5"], textAlign: "center" },
  stateBody: {
    marginTop: t.space["2"],
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  },
  errorActions: {
    marginTop: t.space["6"],
    width: "100%",
    maxWidth: SUBMIT_STATE_MAX_WIDTH,
    gap: t.space["3"],
  },
  errorIcon: {
    width: ERROR_ICON_SIZE,
    height: ERROR_ICON_SIZE,
    borderRadius: ERROR_ICON_SIZE / 2,
    backgroundColor: t.colors.bloom["50"],
    alignItems: "center",
    justifyContent: "center",
  },
  successCheck: { marginBottom: t.space["3"] },
  successActions: {
    marginTop: t.space["8"],
    width: "100%",
    maxWidth: SUBMIT_STATE_MAX_WIDTH,
    gap: t.space["3"],
  },
  signedOutHint: {
    marginTop: t.space["4"],
    width: "100%",
    maxWidth: SUBMIT_STATE_MAX_WIDTH,
    textAlign: "center",
  },
}))
