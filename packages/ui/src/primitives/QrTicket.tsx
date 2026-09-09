import React, { useMemo } from "react"
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native"
import Svg, { Path, Rect } from "react-native-svg"
import qrcode from "qrcode-generator"
import { qrInk, qrPaper } from "@civfix/shared/tokens"
import { makeThemedStyles } from "../theme"
import { Text } from "../typography"
import { QR_ERROR_CORRECTION, QR_QUIET_ZONE, qrPath } from "./qrMatrix"

export interface QrTicketProps {
  value: string
  size?: number
  label: string
  caption?: string
  code?: string
  style?: StyleProp<ViewStyle>
}

function qrModules(value: string): boolean[][] {
  const qr = qrcode(0, QR_ERROR_CORRECTION)
  qr.addData(value)
  qr.make()
  const count = qr.getModuleCount()
  const rows: boolean[][] = []
  for (let row = 0; row < count; row++) {
    const cells: boolean[] = []
    for (let col = 0; col < count; col++) cells.push(qr.isDark(row, col))
    rows.push(cells)
  }
  return rows
}

export function QrTicket({ value, size = 220, label, caption, code, style }: QrTicketProps) {
  const styles = useStyles()

  const rendered = useMemo(() => {
    if (value.length === 0) return null
    try {
      const modules = qrModules(value)
      return qrPath(modules, 1, QR_QUIET_ZONE)
    } catch {
      return null
    }
  }, [value])

  return (
    <View style={[styles.wrap, style]}>
      <View
        style={[styles.plate, { width: size, height: size }]}
        accessibilityRole="image"
        accessibilityLabel={label}
      >
        {rendered && rendered.path.length > 0 ? (
          <Svg width={size} height={size} viewBox={`0 0 ${rendered.size} ${rendered.size}`}>
            <Rect x={0} y={0} width={rendered.size} height={rendered.size} fill={qrPaper} />
            <Path d={rendered.path} fill={qrInk} />
          </Svg>
        ) : (
          <View style={styles.fallback} />
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
