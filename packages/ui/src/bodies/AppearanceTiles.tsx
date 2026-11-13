import { useCallback, useEffect, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import {
  focusRingProps,
  makeThemedStyles,
  setAppearancePreference,
  themeFor,
  useAppearancePreference,
  useTheme,
  webHover,
  webTransition,
  type AppearancePreference,
  type ColorSchemeName,
} from "../theme"
import { Icon, iconMap, Text } from "../typography"
import { useHaptics } from "../capabilities"
import { useT } from "../i18n"
import {
  appearanceCommit,
  appearancePressTarget,
  appearanceRowState,
  scheduleAfterPaint,
  type AppearancePending,
} from "./appearanceSelection"

const ORDER: readonly AppearancePreference[] = ["light", "dark", "system"]

// The tile's picture is a miniature of a civfix screen, so its parts are drawn smaller than any spacing token.
const PREVIEW_HEIGHT = 76
const PREVIEW_BORDER = 2
const PREVIEW_INNER_GAP = 5
const PREVIEW_BAR_HEIGHT = 5
const PREVIEW_LINE_GAP = 3
const PREVIEW_LINE_HEIGHT = 4
const PREVIEW_DOT_SIZE = 10
const RADIO_SIZE = 18
const RADIO_BORDER = 1.5
const RADIO_GLYPH = 11

/** A tiny civfix screen drawn in one scheme's own tokens, whatever scheme the app is in now. */
function SchemePreview({ scheme }: { scheme: ColorSchemeName }) {
  const styles = useStyles()
  const c = themeFor(scheme).colors
  return (
    <View style={[styles.previewHalf, { backgroundColor: c.bg }]}>
      <View style={[styles.previewBar, { backgroundColor: c.text }]} />
      <View style={[styles.previewCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={[styles.previewDot, { backgroundColor: c.brand.bloom }]} />
        <View style={styles.previewLines}>
          <View style={[styles.previewLine, { backgroundColor: c.textMuted }]} />
          <View style={[styles.previewLineShort, { backgroundColor: c.textSubtle }]} />
        </View>
      </View>
    </View>
  )
}

function AppearanceTile({
  code,
  selected,
  onSelect,
}: {
  code: AppearancePreference
  selected: boolean
  onSelect: (code: AppearancePreference) => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("appearance-settings")
  const press = useCallback(() => onSelect(code), [onSelect, code])
  return (
    <Pressable
      onPress={press}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={t(`option.${code}`)}
      {...focusRingProps}
      style={(state) => [styles.tile, webTransition, state.pressed ? styles.pressed : null]}
    >
      {(state) => (
        <>
          <View
            style={[
              styles.preview,
              selected ? styles.previewSelected : null,
              !selected && webHover(state) ? styles.previewHovered : null,
            ]}
          >
            {code === "system" ? (
              <>
                <SchemePreview scheme="light" />
                <SchemePreview scheme="dark" />
              </>
            ) : (
              <SchemePreview scheme={code} />
            )}
          </View>
          <View style={styles.labelRow}>
            <View style={[styles.radio, selected ? styles.radioOn : null]}>
              {selected ? (
                <Icon icon={iconMap.Check} size={RADIO_GLYPH} color={th.colors.onAccent} />
              ) : null}
            </View>
            <Text style={[styles.label, selected ? styles.labelOn : null]} numberOfLines={1}>
              {t(`option.${code}`)}
            </Text>
          </View>
        </>
      )}
    </Pressable>
  )
}

/** Light, Dark and System as three picture tiles at the top of Settings. */
export function AppearanceTiles() {
  const styles = useStyles()
  const preference = useAppearancePreference()
  const haptics = useHaptics()
  const { t } = useT("appearance-settings")
  const [pending, setPending] = useState<AppearancePending | null>(null)

  const onSelect = useCallback(
    (code: AppearancePreference) => {
      const next = appearancePressTarget(code, pending, preference)
      if (next === pending) return
      haptics.selection()
      setPending(next)
    },
    [haptics, pending, preference],
  )

  // Like the radio list: the tile repaints first, then the whole app switches scheme.
  useEffect(() => {
    const commit = appearanceCommit(pending, preference)
    if (commit.kind === "idle") return
    if (commit.kind === "clear") {
      setPending(null)
      return
    }
    return scheduleAfterPaint(() => setAppearancePreference(commit.preference))
  }, [pending, preference])

  return (
    <View style={styles.cell}>
      <View style={styles.tiles} accessibilityRole="radiogroup" accessibilityLabel={t("title")}>
        {ORDER.map((code) => (
          <AppearanceTile
            key={code}
            code={code}
            selected={appearanceRowState(code, pending, preference).selected}
            onSelect={onSelect}
          />
        ))}
      </View>
      <Text style={styles.sub}>{t("subtitle")}</Text>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  cell: {
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["2"],
    gap: t.space["3"],
  },
  tiles: {
    flexDirection: "row",
    gap: t.space["3"],
  },
  tile: {
    flex: 1,
    minWidth: 0,
    gap: t.space["2"],
  },
  preview: {
    height: PREVIEW_HEIGHT,
    flexDirection: "row",
    borderRadius: t.radius.md,
    overflow: "hidden",
    borderWidth: PREVIEW_BORDER,
    borderColor: t.colors.border,
  },
  previewSelected: {
    borderColor: t.colors.brand.bloom,
  },
  previewHovered: {
    borderColor: t.colors.borderStrong,
  },
  previewHalf: {
    flex: 1,
    padding: t.space["2"],
    gap: t.space["2"],
  },
  previewBar: {
    width: "45%",
    height: PREVIEW_BAR_HEIGHT,
    borderRadius: t.radius.pill,
    opacity: 0.85,
  },
  previewCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: PREVIEW_INNER_GAP,
    borderRadius: t.radius.xs,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: PREVIEW_INNER_GAP,
  },
  previewDot: {
    width: PREVIEW_DOT_SIZE,
    height: PREVIEW_DOT_SIZE,
    borderRadius: t.radius.pill,
  },
  previewLines: {
    flex: 1,
    gap: PREVIEW_LINE_GAP,
  },
  previewLine: {
    height: PREVIEW_LINE_HEIGHT,
    borderRadius: t.radius.pill,
  },
  previewLineShort: {
    width: "60%",
    height: PREVIEW_LINE_HEIGHT,
    borderRadius: t.radius.pill,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["2"],
  },
  radio: {
    width: RADIO_SIZE,
    height: RADIO_SIZE,
    borderRadius: t.radius.pill,
    borderWidth: RADIO_BORDER,
    borderColor: t.colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: {
    backgroundColor: t.colors.brand.bloom,
    borderColor: t.colors.brand.bloom,
  },
  label: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
  labelOn: {
    fontFamily: t.fontFamily.bodyBold,
    color: t.colors.text,
  },
  sub: {
    fontFamily: t.fontFamily.bodyMedium,
    fontSize: t.fontSize["12"],
    lineHeight: 16,
    color: t.colors.textSubtle,
    paddingHorizontal: t.space["1"],
  },
  pressed: { opacity: 0.85 },
}))
