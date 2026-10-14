import React, { useCallback } from "react"
import { View, type StyleProp, type ViewStyle } from "react-native"
import { makeThemedStyles, useTheme } from "../../theme"
import { Text, Icon, iconMap } from "../../typography"
import { SettingsRow, SettingsSection } from "../../primitives"
import type { useRequestMyData } from "../../data"
import { announce } from "../../announce"
import { useT } from "../../i18n"
import { ErrorCode, errorCopyKey, type ErrorCodeTable } from "@civfix/shared"

type Translate = (key: string, options?: Record<string, unknown>) => string

const DATA_EXPORT_ERROR_KEYS: ErrorCodeTable<string> = {
  [ErrorCode.VALIDATION]: "data_export.error.no_email",
  [ErrorCode.RATE_LIMITED]: "data_export.error.rate_limited",
}

function requestErrorMessage(err: unknown, t: Translate): string {
  return t(errorCopyKey(err, DATA_EXPORT_ERROR_KEYS, "data_export.error.generic"))
}

export interface DataExportSectionProps {
  requestMyData: ReturnType<typeof useRequestMyData>
  style?: StyleProp<ViewStyle>
}

export function DataExportSection({ requestMyData, style }: DataExportSectionProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("settings-account")

  const onRequestData = useCallback(() => {
    if (requestMyData.isPending) return
    requestMyData.mutate(undefined, {
      onSuccess: (data) =>
        announce(
          data?.email
            ? t("data_export.announce.success_email", { email: data.email })
            : t("data_export.announce.success"),
        ),
      onError: () => announce(t("data_export.announce.failed")),
    })
  }, [requestMyData, t])

  return (
    <>
      <SettingsSection label={t("section.data")} style={style}>
        <SettingsRow
          icon="Download"
          label={requestMyData.isPending ? t("data_export.requesting") : t("data_export.request")}
          sub={t("data_export.sub")}
          onPress={onRequestData}
          disabled={requestMyData.isPending}
          chevron={false}
          accessibilityLabel={t("data_export.request_a11y")}
        />
      </SettingsSection>

      {requestMyData.isSuccess ? (
        <View style={styles.dataNote}>
          <Icon icon={iconMap.CheckCircle2} size={14} color={th.colors.moss["600"]} />
          <Text style={styles.dataNoteText}>
            {requestMyData.data?.email
              ? t("data_export.note.success_email", { email: requestMyData.data.email })
              : t("data_export.note.success")}
          </Text>
        </View>
      ) : requestMyData.isError ? (
        <View style={styles.dataNote}>
          <Icon icon={iconMap.AlertCircle} size={14} color={th.colors.bloom["600"]} />
          <Text style={[styles.dataNoteText, styles.dataNoteWarnText]}>
            {requestErrorMessage(requestMyData.error, t)}
          </Text>
        </View>
      ) : null}
    </>
  )
}

const useStyles = makeThemedStyles((t) => ({
  dataNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 2,
    marginTop: t.space["2"],
  },
  dataNoteText: {
    flex: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12.5,
    color: t.colors.moss["700"],
  },
  dataNoteWarnText: {
    color: t.colors.dangerInk,
  },
}))
