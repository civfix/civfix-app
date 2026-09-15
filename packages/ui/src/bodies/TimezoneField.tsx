import React, { useMemo, useState } from "react"
import { View, Pressable } from "react-native"
import { COMMON_TIMEZONES, supportedTimeZones } from "@civfix/shared/datetime"
import {
  makeThemedStyles,
  useTheme,
  focusRingProps,
  webCursorPointer,
  webTransition,
  webHover,
} from "../theme"
import { Text, TextLink, Icon, iconMap } from "../typography"
import { TextField } from "../primitives"
import { useLocale, useT, useViewerTimeZone } from "../i18n"
import { zoneDisplayName } from "./calendarModel"

const MAX_TIMEZONE_ROWS = 8

const displayNames = new Map<string, string>()

let everyZone: readonly string[] | null = null

function allTimeZones(): readonly string[] {
  everyZone ??= supportedTimeZones()
  return everyZone
}

function cachedDisplayName(timeZone: string, locale: string): string {
  const key = `${locale}|${timeZone}`
  const cached = displayNames.get(key)
  if (cached !== undefined) return cached
  const name = zoneDisplayName(timeZone, locale)
  displayNames.set(key, name)
  return name
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/_/g, " ")
}

export function matchingTimeZones(
  zones: readonly string[],
  query: string,
  locale: string,
  limit = MAX_TIMEZONE_ROWS,
): string[] {
  const needle = normalize(query.trim())
  if (needle === "") return zones.slice(0, limit)
  const out: string[] = []
  for (const zone of zones) {
    if (normalize(zone).includes(needle)) {
      out.push(zone)
      if (out.length === limit) return out
    }
  }
  const byId = new Set(out)
  for (const zone of zones) {
    if (byId.has(zone)) continue
    if (normalize(cachedDisplayName(zone, locale)).includes(needle)) {
      out.push(zone)
      if (out.length === limit) break
    }
  }
  return out
}

export interface TimezoneFieldProps {
  value: string
  onChange?: (timezone: string) => void
}

export function TimezoneField({ value, onChange }: TimezoneFieldProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("event-form")
  const { locale } = useLocale()
  const deviceZone = useViewerTimeZone()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const zoneLabel = cachedDisplayName(value, locale)
  const deviceLabel = cachedDisplayName(deviceZone, locale)

  const rows = useMemo(
    () => matchingTimeZones(query.trim() === "" ? COMMON_TIMEZONES : allTimeZones(), query, locale),
    [locale, query],
  )

  const pick = (timeZone: string) => {
    onChange?.(timeZone)
    setQuery("")
    setOpen(false)
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.captionRow}>
        <Icon icon={iconMap.Globe} size={13} color={th.colors.textSubtle} />
        <Text numberOfLines={2} style={styles.caption}>
          {t("timezone.caption", { zone: zoneLabel })}
        </Text>
        {onChange ? (
          <TextLink variant="caption" onPress={() => setOpen((prev) => !prev)}>
            {t("timezone.change")}
          </TextLink>
        ) : null}
      </View>

      {value !== deviceZone ? (
        <Text numberOfLines={2} style={styles.caption}>
          {t("timezone.device_hint", { deviceZone: deviceLabel })}
        </Text>
      ) : null}

      {open && onChange ? (
        <View style={styles.panel}>
          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder={t("timezone.search_placeholder")}
            accessibilityLabel={t("timezone.search_placeholder")}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <ZoneRow
            title={t("timezone.use_device", { deviceZone: deviceLabel })}
            subtitle={deviceZone}
            selected={value === deviceZone}
            onPress={() => pick(deviceZone)}
          />

          {rows.map((zone) => (
            <ZoneRow
              key={zone}
              title={cachedDisplayName(zone, locale)}
              subtitle={zone}
              selected={value === zone}
              onPress={() => pick(zone)}
            />
          ))}

          {rows.length === 0 ? <Text style={styles.caption}>{t("timezone.no_match")}</Text> : null}
        </View>
      ) : null}
    </View>
  )
}

function ZoneRow({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string
  subtitle: string
  selected: boolean
  onPress: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected }}
      {...focusRingProps}
      style={(state) => [
        styles.zoneRow,
        webCursorPointer,
        webTransition,
        webHover(state) ? styles.zoneRowHovered : null,
        state.pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.zoneMeta}>
        <Text numberOfLines={1} style={styles.zoneTitle}>
          {title}
        </Text>
        <Text numberOfLines={1} style={styles.zoneSub}>
          {subtitle}
        </Text>
      </View>
      {selected ? <Icon icon={iconMap.Check} size={14} color={th.colors.brand.bloom} /> : null}
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  wrap: {
    gap: t.space["1"],
    marginTop: t.space["2"],
  },
  captionRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: t.space["1"],
  },
  caption: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  panel: {
    marginTop: t.space["1"],
    gap: t.space["1"],
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["3"],
  },
  zoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    minHeight: 44,
    paddingHorizontal: t.space["2"],
    borderRadius: t.radius.md,
  },
  zoneRowHovered: {
    backgroundColor: t.colors.bgAlt,
  },
  zoneMeta: {
    flex: 1,
    minWidth: 0,
  },
  zoneTitle: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.text,
  },
  zoneSub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  pressed: {
    opacity: 0.85,
  },
}))
