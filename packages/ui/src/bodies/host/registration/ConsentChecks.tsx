import React, { useMemo } from "react"
import { View, Pressable } from "react-native"
import { currentVersion } from "@civfix/shared/legal"
import { focusRingProps, makeThemedStyles, useTheme, webCursor, webHover, webTransition } from "../../../theme"
import { Text, TextLink, Icon, iconMap } from "../../../typography"
import { useOpenExternal } from "../../../capabilities"
import { useT } from "../../../i18n"
import { PRIVACY_URL, TERMS_URL } from "../../../primitives/externalUrls"
import type { ConsentState } from "./consentModel"

const CHECKBOX_SIZE = 20

export interface ConsentChecksProps {
  value: ConsentState
  onChange: (next: ConsentState) => void
  showHostContact?: boolean
  showSms?: boolean
  disabled?: boolean
}

function Row({
  checked,
  onToggle,
  disabled,
  a11yLabel,
  children,
}: {
  checked: boolean
  onToggle: () => void
  disabled: boolean
  a11yLabel: string
  children: React.ReactNode
}) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <Pressable
      onPress={disabled ? undefined : onToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={a11yLabel}
      {...focusRingProps}
      style={(state) => [
        styles.row,
        webTransition,
        webCursor(disabled),
        webHover(state) && !disabled ? styles.rowHovered : null,
      ]}
    >
      <View style={[styles.box, checked ? styles.boxChecked : null]}>
        {checked ? <Icon icon={iconMap.Check} size={13} color={th.colors.onAccent} /> : null}
      </View>
      <Text style={styles.label}>{children}</Text>
    </Pressable>
  )
}

export function ConsentChecks({
  value,
  onChange,
  showHostContact = true,
  showSms = false,
  disabled = false,
}: ConsentChecksProps) {
  const styles = useStyles()
  const { t } = useT("host-ticket")
  const openExternal = useOpenExternal()

  const openLegal = React.useCallback(
    (url: string) => {
      void openExternal?.open(url)
    },
    [openExternal],
  )

  const termsVersion = useMemo(() => currentVersion("terms"), [])

  return (
    <View style={styles.list}>
      <Row
        checked={value.terms}
        disabled={disabled}
        a11yLabel={t("consent.terms_a11y")}
        onToggle={() => onChange({ ...value, terms: !value.terms })}
      >
        {t("consent.terms_lead")}
        {t("consent.terms_link")}
        {t("consent.terms_conjunction")}
        {t("consent.privacy_link")}
        {t("consent.terms_trailing")}
      </Row>
      {/* The links sit outside the checkbox: a checkbox's children are presentational, so screen
          readers and keyboards cannot reach a link nested inside it. */}
      <View style={styles.links}>
        <TextLink variant="caption" standalone onPress={() => openLegal(TERMS_URL)}>
          {t("consent.terms_link")}
        </TextLink>
        <TextLink variant="caption" standalone onPress={() => openLegal(PRIVACY_URL)}>
          {t("consent.privacy_link")}
        </TextLink>
      </View>

      {showHostContact ? (
        <Row
          checked={value.hostContactOptIn}
          disabled={disabled}
          a11yLabel={t("consent.host_contact_a11y")}
          onToggle={() => onChange({ ...value, hostContactOptIn: !value.hostContactOptIn })}
        >
          {t("consent.host_contact")}
        </Row>
      ) : null}

      {showSms ? (
        <Row
          checked={value.smsOptIn}
          disabled={disabled}
          a11yLabel={t("consent.sms_a11y")}
          onToggle={() => onChange({ ...value, smsOptIn: !value.smsOptIn })}
        >
          {t("consent.sms")}
        </Row>
      ) : null}

      <Text style={styles.version}>{t("consent.version", { version: termsVersion })}</Text>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  list: {
    gap: t.space["2"],
  },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: t.space["3"],
    paddingVertical: t.space["1"],
  },
  rowHovered: {
    opacity: 0.92,
  },
  box: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    marginTop: 1,
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
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    lineHeight: 18,
    color: t.colors.text,
  },
  links: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: t.space["4"],
    paddingLeft: CHECKBOX_SIZE + t.space["3"],
  },
  version: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
}))
