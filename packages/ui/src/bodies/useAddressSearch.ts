import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { DEVICE_FIX_TIMEOUT_MS, withTimeout } from "@civfix/shared"
import { parseLatLng, type GeoSuggestion, type LatLng } from "@civfix/shared/geocode"
import { useGeolocation } from "../capabilities"
import { useApi, fetchApproximateLocation } from "../data"
import { useMapViewport, viewportBias } from "../map/mapViewportStore"
import { useT } from "../i18n"
import { announce } from "../announce"
import { addressSearchStatus, buildSuggestRequest } from "./addressSuggestRequest"

const MAP_BIAS_SCALE = 0.6

const DEBOUNCE_MS = 280

type Bias = { proximity?: LatLng | null; proximityZoom?: number; locationBiasScale?: number }

export interface AddressPick {
  name: string
  lat: number
  lng: number
}

export function useAddressSearch({
  value,
  onChangeText,
  onPick,
}: {
  value: string
  onChangeText: (next: string) => void
  onPick: (place: AddressPick) => void
}) {
  const { t } = useT("map-address")
  const geo = useGeolocation()
  const api = useApi()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<GeoSuggestion[]>([])
  const [failed, setFailed] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const proximityRef = useRef<Promise<LatLng | null> | null>(null)

  const resolveProximity = useCallback((): Promise<LatLng | null> => {
    if (!proximityRef.current) {
      proximityRef.current = (async () => {
        const pos = geo.isAvailable() ? await withTimeout(geo.getCurrentPosition(), DEVICE_FIX_TIMEOUT_MS) : null
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

  const reopen = useCallback(() => {
    if (value.trim().length > 0) setOpen(true)
  }, [value])

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

  return { loading, results, status, runSearch, onChange, reopen, choose, clear }
}
