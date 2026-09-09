import React, { useCallback, useEffect, useRef, useState } from "react"
import { View, TextInput, Pressable, ActivityIndicator, Platform, StyleSheet, type ViewStyle } from "react-native"
import { tokens } from "@civfix/shared/tokens"
import { parseLatLng, ipLocate, type GeoSuggestion, type LatLng } from "@civfix/shared/geocode"
import { makeThemedStyles, useTheme, focusRingProps, webInputReset } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useGeolocation } from "../capabilities"
import { useApi } from "../data"
import { useMapViewport, viewportBias } from "../map/mapViewportStore"
import { useT } from "../i18n"
import { buildSuggestRequest } from "./addressSuggestRequest"

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
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<GeoSuggestion[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const proximityRef = useRef<Promise<LatLng | null> | null>(null)

  const resolveProximity = useCallback((): Promise<LatLng | null> => {
    if (!proximityRef.current) {
      proximityRef.current = (async () => {
        const pos = geo.isAvailable() ? await geo.getCurrentPosition().catch(() => null) : null
        if (pos) return { lat: pos.latitude, lng: pos.longitude }
        try {
          return await ipLocate()
        } catch {
          proximityRef.current = null
          return null
        }
      })()
    }
    return proximityRef.current
  }, [geo])

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
      } catch {
        if (!ac.signal.aborted) setResults([])
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
      setLoading(false)
      setOpen(false)
    },
    [cancelPending, onPick, onChangeText],
  )

  const clear = useCallback(() => {
    cancelPending()
    onChangeText("")
    setResults([])
    setLoading(false)
    setOpen(false)
  }, [cancelPending, onChangeText])

  const showEmpty = open && !loading && results.length === 0 && value.trim().length > 0

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

      {open && results.length > 0 ? (
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
      ) : showEmpty ? (
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
