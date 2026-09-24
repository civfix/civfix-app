import React, { useState } from "react"
import { View, Pressable, ActivityIndicator, StyleSheet } from "react-native"
import { TextInput } from "../primitives/TextInput"
import { makeThemedStyles, useTheme, focusRingProps, webInputReset, PRESSED_OPACITY, MIN_TOUCH_TARGET, inputFocusedStyle } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT } from "../i18n"
import { useAddressSearch, type AddressPick } from "./useAddressSearch"

export type { AddressPick } from "./useAddressSearch"

export interface AddressSearchProps {
  value: string
  onChangeText: (next: string) => void
  onPick: (place: AddressPick) => void
}

export function AddressSearch({ value, onChangeText, onPick }: AddressSearchProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("map-address")
  const [focused, setFocused] = useState(false)
  const { loading, results, status, runSearch, onChange, reopen, choose, clear } = useAddressSearch({
    value,
    onChangeText,
    onPick,
  })

  return (
    <View>
      <View style={[styles.field, focused ? styles.fieldFocused : null]}>
        <Icon icon={iconMap.Search} size={17} color={th.colors.textSubtle} />
        <TextInput
          value={value}
          onChangeText={onChange}
          onFocus={() => {
            setFocused(true)
            reopen()
          }}
          onBlur={() => setFocused(false)}
          placeholder={t("input.placeholder")}
          accessibilityLabel={t("input.a11y")}
          placeholderTextColor={th.colors.textSubtle}
          selectionColor={th.colors.brand.bloom}
          autoCorrect={false}
          style={[styles.input, webInputReset]}
        />
        {loading ? (
          <ActivityIndicator size="small" color={th.colors.textSubtle} />
        ) : value.length > 0 ? (
          <Pressable
            onPress={clear}
            accessibilityRole="button"
            accessibilityLabel={t("input.clear")}
            hitSlop={8}
            {...focusRingProps}
            style={({ pressed }) => [styles.clear, pressed ? styles.pressed : null]}
          >
            <Icon icon={iconMap.Close} size={15} color={th.colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {status === "results" ? (
        <View style={styles.results}>
          {results.map((s, i) => (
            <Pressable
              key={s.id}
              onPress={() => choose(s)}
              accessibilityRole="button"
              accessibilityLabel={s.secondary ? `${s.label}, ${s.secondary}` : s.label}
              {...focusRingProps}
              style={({ pressed }) => [
                styles.result,
                i < results.length - 1 ? styles.resultDivider : null,
                pressed ? styles.resultPressed : null,
              ]}
            >
              <Icon icon={iconMap.MapPin} size={16} color={th.colors.textSubtle} />
              <View style={styles.resultMeta}>
                <Text style={styles.resultName} numberOfLines={1}>
                  {s.label}
                </Text>
                {s.secondary ? (
                  <Text style={styles.resultAddr} numberOfLines={1}>
                    {s.secondary}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
          {results.some((s) => s.source === "mapbox") ? (
            <Text style={styles.attribution}>© Mapbox © OpenStreetMap</Text>
          ) : null}
        </View>
      ) : status === "failed" ? (
        <View style={styles.results}>
          <View style={styles.result}>
            <Icon icon={iconMap.AlertCircle} size={16} color={th.colors.textSubtle} />
            <View style={styles.resultMeta}>
              <Text style={styles.resultAddr} numberOfLines={2}>
                {t("error.failed")}
              </Text>
            </View>
            <Pressable
              onPress={() => void runSearch(value)}
              accessibilityRole="button"
              accessibilityLabel={t("error.retry")}
              {...focusRingProps}
              style={({ pressed }) => [styles.retry, pressed ? styles.pressed : null]}
            >
              <Text style={styles.retryText}>{t("error.retry")}</Text>
            </Pressable>
          </View>
        </View>
      ) : status === "empty" ? (
        <View style={styles.results}>
          <View style={styles.result}>
            <Icon icon={iconMap.Info} size={16} color={th.colors.textSubtle} />
            <View style={styles.resultMeta}>
              <Text style={styles.resultAddr} numberOfLines={2}>
                {t("empty.noMatches")}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    paddingHorizontal: t.space["4"],
    minHeight: 52,
  },
  fieldFocused: inputFocusedStyle(t),
  input: {
    flex: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["16"],
    color: t.colors.text,
    paddingVertical: t.space["3"],
  },
  clear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
  },
  results: {
    marginTop: t.space["2"],
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    overflow: "hidden",
    ...t.shadows.s2,
  },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["3"],
  },
  resultDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  resultPressed: {
    backgroundColor: t.colors.bgAlt,
  },
  resultMeta: {
    flex: 1,
    minWidth: 0,
  },
  resultName: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["14"],
    color: t.colors.text,
  },
  resultAddr: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
    marginTop: 1,
  },
  pressed: {
    opacity: PRESSED_OPACITY,
  },
  retry: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    paddingHorizontal: t.space["2"],
  },
  retryText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.accentText,
  },
  attribution: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 10,
    color: t.colors.textSubtle,
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["2"],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  },
}))
