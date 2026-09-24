import React, { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { View, Pressable, ActivityIndicator, Platform, StyleSheet, type ViewStyle } from "react-native"
import { TextInput } from "../primitives/TextInput"
import { tokens } from "@civfix/shared/tokens"
import { parseLatLng, type GeoSuggestion, type LatLng } from "@civfix/shared/geocode"
import { makeThemedStyles, useTheme, focusRingProps, webInputReset } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useGeolocation } from "../capabilities"
import { useApi, fetchApproximateLocation } from "../data"
import { useMapViewport, viewportBias } from "../map/mapViewportStore"
import { useT } from "../i18n"
import { announce } from "../announce"
import {
  PROXIMITY_FIX_TIMEOUT_MS,
  addressSearchStatus,
  buildSuggestRequest,
  settleWithin,
} from "./addressSuggestRequest"

const MAP_BIAS_SCALE = 0.6

type Bias = { proximity?: LatLng | null; proximityZoom?: number; locationBiasScale?: number }

export interface AddressPick {
  name: string
  lat: number
  lng: number
}

export interface AddressSearchProps {
  value: string
  onChangeText: (next: string) => void
  onPick: (place: AddressPick) => void
}

const DEBOUNCE_MS = 280

export function AddressSearch({ value, onChangeText, onPick }: AddressSearchProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("map-address")
  const geo = useGeolocation()
  const api = useApi()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<GeoSuggestion[]>([])
  const [failed, setFailed] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const proximityRef = useRef<Promise<LatLng | null> | null>(null)

  const resolveProximity = useCallback((): Promise<LatLng | null> => {
    if (!proximityRef.current) {
      proximityRef.current = (async () => {
        const pos = geo.isAvailable() ? await settleWithin(geo.getCurrentPosition(), PROXIMITY_FIX_TIMEOUT_MS) : null
        if (pos) return { lat: pos.latitude, lng: pos.longitude }
        const approximate = await fetchApproximateLocation(api, qc)
        if (approximate) return approximate
        proximityRef.current = null
        return null
      })()
    }
    return proximityRef.current
  }, [geo, api, qc])

  const resolveBias = useCallback(async (): Promise<Bias> => {
    return (
      viewportBias(useMapViewport.getState().viewport, MAP_BIAS_SCALE) ?? {
        proximity: await resolveProximity(),
      }
    )
  }, [resolveProximity])

  const cancelPending = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  useEffect(() => cancelPending, [cancelPending])

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim()
      setFailed(false)
      if (!trimmed) {
        abortRef.current?.abort()
        abortRef.current = null
        setResults([])
        setLoading(false)
        return
      }
      const coord = parseLatLng(trimmed)
      if (coord) {
        abortRef.current?.abort()
        setResults([
          {
            id: `coordinate:${coord.lat},${coord.lng}`,
            label: `${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}`,
            secondary: t("coordinate.exact"),
            lat: coord.lat,
            lng: coord.lng,
            source: "coordinate",
          },
        ])
        setOpen(true)
        setLoading(false)
        announce(t("results.count", { count: 1 }))
        return
      }
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setLoading(true)
      try {
        let bias: Bias = {}
        try {
          bias = await resolveBias()
        } catch {
          bias = {}
        }
        if (ac.signal.aborted) return
        const res = await api.suggest(buildSuggestRequest(trimmed, bias), { signal: ac.signal })
        if (ac.signal.aborted) return
        setResults(res.suggestions)
        setOpen(true)
        announce(
          res.suggestions.length > 0
            ? t("results.count", { count: res.suggestions.length })
            : t("empty.noMatches"),
        )
      } catch {
        if (!ac.signal.aborted) {
          setResults([])
          setFailed(true)
          announce(t("error.failed"))
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    },
    [resolveBias, t, api],
  )

  const onChange = useCallback(
    (next: string) => {
      onChangeText(next)
      setOpen(true)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => void runSearch(next), DEBOUNCE_MS)
    },
    [onChangeText, runSearch],
  )

  const choose = useCallback(
    (s: GeoSuggestion) => {
      cancelPending()
      onPick({ name: s.label, lat: s.lat, lng: s.lng })
      onChangeText(s.label)
      setResults([])
      setFailed(false)
      setLoading(false)
      setOpen(false)
    },
    [cancelPending, onPick, onChangeText],
  )

  const clear = useCallback(() => {
    cancelPending()
    onChangeText("")
    setResults([])
    setFailed(false)
    setLoading(false)
    setOpen(false)
  }, [cancelPending, onChangeText])

  const status = addressSearchStatus({ open, loading, failed, resultCount: results.length, query: value })

  return (
    <View>
      <View style={[styles.field, focused ? styles.fieldFocused : null]}>
        <Icon icon={iconMap.Search} size={17} color={th.colors.textSubtle} />
        <TextInput
          value={value}
          onChangeText={onChange}
          onFocus={() => {
            setFocused(true)
            if (value.trim().length > 0) setOpen(true)
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
  fieldFocused:
    Platform.OS === "web"
      ? ({ boxShadow: tokens.shadow.ring, borderColor: t.colors.accent } as ViewStyle)
      : { borderColor: t.colors.accent },
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
    fontSize: 14,
    color: t.colors.text,
  },
  resultAddr: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 12,
    color: t.colors.textSubtle,
    marginTop: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  retry: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: t.space["2"],
  },
  retryText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 13,
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
