import React, { useMemo } from "react"
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native"
import Svg, { Path, Rect } from "react-native-svg"
import { qrInk, qrPaper } from "@civfix/shared/tokens"
import { useT } from "../i18n"
import { makeThemedStyles } from "../theme"
import { Text } from "../typography"
import { qrTicketPath } from "./qrMatrix"

export interface QrTicketProps {
  value: string
  size?: number
  label: string
  caption?: string
  code?: string
  style?: StyleProp<ViewStyle>
}

export function QrTicket({ value, size = 220, label, caption, code, style }: QrTicketProps) {
  const styles = useStyles()
  const { t } = useT("common")

  const rendered = useMemo(() => qrTicketPath(value), [value])

  return (
    <View style={[styles.wrap, style]}>
      <View
        style={[styles.plate, { width: size, height: size }]}
        accessibilityRole="image"
        accessibilityLabel={label}
      >
        {rendered ? (
          <Svg width={size} height={size} viewBox={`0 0 ${rendered.size} ${rendered.size}`}>
            <Rect x={0} y={0} width={rendered.size} height={rendered.size} fill={qrPaper} />
            <Path d={rendered.path} fill={qrInk} />
          </Svg>
        ) : (
          <View style={styles.fallback}>
            <Text style={styles.fallbackText}>{t("qr_ticket.unavailable")}</Text>
          </View>
        )}
      </View>
      {code ? (
        <Text
          variant="mono"
          style={[styles.code, { maxWidth: size }]}
          accessibilityLabel={code}
          selectable
        >
          {code}
        </Text>
      ) : null}
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  wrap: {
    alignItems: "center",
    gap: t.space["2"],
  },
  plate: {
    backgroundColor: qrPaper,
    borderRadius: t.radius.md,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  fallback: {
    width: "100%",
    height: "100%",
    backgroundColor: qrPaper,
    alignItems: "center",
    justifyContent: "center",
    padding: t.space["4"],
  },
  fallbackText: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: qrInk,
    textAlign: "center",
  },
  code: {
    fontSize: t.fontSize["13"],
    letterSpacing: 1,
    color: t.colors.text,
    textAlign: "center",
  },
  caption: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
    textAlign: "center",
  },
}))
