/**
 * LocationPicker (native seam) - the interactive inline pin-drop map on native
 * (@maplibre/maplibre-react-native v11). Ported from the mobile `components/map/LocationPicker` map core
 * (the modal chrome is dropped - the unified picker is an embeddable inline map).
 *
 * Tap anywhere to drop / move the coral meeting-point pin; the tap fires `onChange(lat,lng)` so the host
 * form stores the coordinate (the inline model has no separate confirm step). The camera is seeded from
 * `value` (a prior pick) else `initialCenter`; tapping drops the pin WITHOUT recentering, so the map never
 * jumps under the user's finger. When the parent seeds a new `value` (e.g. an AddressSearch pick), an
 * effect flies the camera + moves the pin there.
 *
 * IT NEVER OPENS ON THE US CENTROID ANY MORE, and that is a rule, not a preference (the same rule the
 * app's own location hook states: "never jump to the neutral US center"). The camera used to be seeded
 * `value ?? initialCenter ?? NEUTRAL_CENTER` and FROZEN into a ref on the first render - and hosts resolve
 * `initialCenter` asynchronously, so on a cold open that first render had neither and the map opened,
 * every time, on a field in Kansas. Recovery was a single unguarded `flyTo` fired from an effect one
 * commit later, with no map-ready gate and no retry, against a map that may not have loaded its style yet.
 * Both are gone: the map is simply NOT MOUNTED until a real centre exists (a warm placeholder holds the
 * space, and the host's own address search still works over it), so the very first camera the user ever
 * sees is already the right one. No neutral fallback, no recovery animation, nothing to lose a race with.
 * The remaining `flyTo` - the parent seeding a NEW `value`, i.e. an address pick - is queued until the map
 * reports its style loaded, mirroring the mount-generation + queued-target discipline Map.native.tsx
 * documents for the same reason.
 *
 * SCROLL HANDOFF (bug fix): this inline picker is rendered INSIDE the host form's shell-scrolled body,
 * which on portrait/compact is the gorhom BottomSheetScrollView. A MapLibre map keeps a greedy native
 * PAN recognizer, so leaving drag-pan enabled lets the embedded map swallow every vertical drag that
 * starts on it - in the gorhom sheet that defeats the sheet's scroll-vs-drag coordination entirely and
 * the whole form becomes unscrollable in portrait. So BY DEFAULT the map's pan/zoom/rotate/pitch gestures
 * are DISABLED (mirrors MiniMap.native's "drag stays with the sheet" decision); only the discrete
 * `onPress` tap survives, which is all the inline pin-drop model needs. Tap is not a pan, so disabling
 * pan never blocks dropping the pin.
 *
 * FULL-SCREEN PICKER (`interactive` + `fullBleed`): the compact "Pick on map" flow (PortraitMapPickStep)
 * renders this map FULL-SCREEN inside an RN Modal - there is no sheet scroll to protect there, so it opts
 * back IN to the gestures (`interactive`) and fills edge-to-edge with no card chrome (`fullBleed`), so the
 * picker IS the moveable home map: pan / zoom to frame, tap to drop / move the pin, search to fly there.
 *
 * maplibre-react-native is allowed here (this is the *.native.* map seam). The draft pin is the shared
 * teardrop (PinSvg), themed from the caller's `pin` target through the one `pinAppearanceFor` derivation
 * the map's own markers use, so what the user drags around IS the marker the thing will get (Ionicons are
 * banned in @civfix/ui).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, View, StyleSheet, type NativeSyntheticEvent } from "react-native"
import {
  Map,
  Camera,
  Marker,
  type CameraRef,
  type PressEvent,
  type PressEventWithFeatures,
} from "@maplibre/maplibre-react-native"
import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec"
import { makeThemedStyles, useTheme } from "../theme"
import { Text } from "../typography"
import { useT } from "../i18n"
import { useCartoApiKey } from "../data"
import { rasterMapStyle, DEFAULT_ATTRIBUTION } from "./mapStyle"
import { PinSvg, pinAppearanceFor } from "./pins"
import { PICKER_ZOOM, PICKER_HEIGHT, type LatLng, type LocationPickerProps } from "./LocationPicker.types"

// MapLibre's Map.onPress passes either event shape; both carry lngLat (the touched coordinate).
type MapPress = NativeSyntheticEvent<PressEvent> | NativeSyntheticEvent<PressEventWithFeatures>

export function LocationPicker({
  value,
  onChange,
  initialCenter,
  height = PICKER_HEIGHT,
  interactive = false,
  fullBleed = false,
  attributionBottomInset,
  pin,
}: LocationPickerProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("map-ui")
  const [picked, setPicked] = useState<LatLng | null>(value ?? null)
  const cameraRef = useRef<CameraRef>(null)
  // The map's style-loaded signal + the ONE camera move that may need replaying against it. MapLibre
  // ignores a `flyTo` issued before the map is ready and reports no error, so an un-queued recenter is a
  // silent no-op that leaves the camera wherever it started - the failure mode Map.native.tsx guards with
  // mount generations and a queued target, in miniature.
  const mapReadyRef = useRef(false)
  const pendingCenterRef = useRef<LatLng | null>(null)

  const pinAppearance = useMemo(() => pinAppearanceFor(pin, th.scheme), [pin, th.scheme])

  // Structural MapStyleInput -> the concrete StyleSpecification the native Map wants (mirrors Map.native).
  // rasterMapStyle() rebuilds a deeply-nested style object every call; LocationPicker re-renders on every
  // tap (setPicked) and on every parent `value` change, so memoize it to a stable identity. The attribution
  // is a module constant and the CARTO key is build-time env, so [cartoApiKey] is the correct dep
  // (mirrors MiniMap.native.tsx).
  const cartoApiKey = useCartoApiKey()
  const mapStyle = useMemo(
    () =>
      rasterMapStyle(DEFAULT_ATTRIBUTION, {
        cartoApiKey,
        scheme: th.scheme,
      }) as string | StyleSpecification,
    [cartoApiKey, th.scheme],
  )

  // THE CAMERA SEED: the first real point this picker ever learns about, and then never again. Adopting it
  // lazily (rather than freezing whatever the first render happened to hold) is what removes the US
  // centroid: while both inputs are null there is no seed, and with no seed the map is not mounted at all -
  // so there is no camera to be wrong. Once adopted it is FROZEN, because the seed's only job is to place
  // the camera at mount: re-seeding it later would yank the map out from under a user who has since panned.
  const seedRef = useRef<LatLng | null>(null)
  if (seedRef.current == null) seedRef.current = value ?? initialCenter ?? null
  const cameraSeed = seedRef.current
  const initialViewState = useMemo(
    () =>
      cameraSeed ? { center: [cameraSeed.lng, cameraSeed.lat] as [number, number], zoom: PICKER_ZOOM } : null,
    [cameraSeed],
  )

  // When the parent seeds/changes `value` (an AddressSearch pick), fly the camera there + move the pin.
  // Skipped when the value already equals the pinned point (a tap we just applied), so it never fights
  // the user's drop. Compared with a small epsilon to tolerate float round-trips.
  //
  // A value -> null transition is the parent WIPING its committed coordinate (a form Reset): drop the pin
  // and fall back to the "tap to place" hint, so the picker never contradicts the form's empty state. This
  // cannot fight a fresh in-picker tap: a tap leaves `value` untouched on an uncontrolled host (so the
  // effect does not re-run) and sets it to the tapped point on a controlled one.
  //
  // QUEUED, not fired blind: if the style has not finished loading the target is parked and replayed from
  // `onDidFinishLoadingMap`. It is also skipped outright when it would only restate the seed the map is
  // about to mount with (the common case: the host resolves a point and the map opens on it).
  useEffect(() => {
    if (!value) {
      setPicked(null)
      return
    }
    setPicked((prev) => {
      if (prev && Math.abs(prev.lat - value.lat) < 1e-6 && Math.abs(prev.lng - value.lng) < 1e-6) {
        return prev
      }
      if (cameraSeed && Math.abs(cameraSeed.lat - value.lat) < 1e-6 && Math.abs(cameraSeed.lng - value.lng) < 1e-6) {
        return value
      }
      if (mapReadyRef.current) {
        cameraRef.current?.flyTo({ center: [value.lng, value.lat], zoom: PICKER_ZOOM, duration: 400 })
      } else {
        pendingCenterRef.current = value
      }
      return value
    })
  }, [value, cameraSeed])

  const onMapReady = useCallback(() => {
    mapReadyRef.current = true
    const queued = pendingCenterRef.current
    if (!queued) return
    pendingCenterRef.current = null
    cameraRef.current?.flyTo({ center: [queued.lng, queued.lat], zoom: PICKER_ZOOM, duration: 400 })
  }, [])

  const onMapPress = (event: MapPress) => {
    const [lng, lat] = event.nativeEvent.lngLat
    setPicked({ lat, lng })
    onChange(lat, lng)
  }

  // NOTHING KNOWN YET -> a warm placeholder, never a guess. `value` and `initialCenter` are both null on a
  // cold open while the host resolves the viewer's approximate position; the old code filled that gap with
  // the US centroid, so the reporter's first sight of the picker was a map of Kansas that then jumped (or,
  // when the recovery flyTo lost its race with the style load, did not). The placeholder is the picker's
  // own loading surface: the host's floating chrome (PortraitMapPickStep's address search + confirm bar)
  // renders over it as usual, so searching an address is still a way OUT of this state, not just a wait.
  if (!initialViewState) {
    return (
      <View style={fullBleed ? styles.wrapFull : [styles.wrap, { height }]}>
        <View style={styles.pending}>
          <ActivityIndicator color={th.colors.textSubtle} />
        </View>
      </View>
    )
  }

  return (
    <View style={fullBleed ? styles.wrapFull : [styles.wrap, { height }]}>
      <Map
        onDidFinishLoadingMap={onMapReady}
        style={styles.map}
        mapStyle={mapStyle}
        logo={false}
        compass={false}
        attribution={false}
        // Drag / zoom gestures follow `interactive`. DEFAULT (false): the embedded inline picker lives in
        // the host form's scroll body (the gorhom BottomSheetScrollView in portrait), so every gesture is
        // disabled and the drag stays with the sheet - only the discrete `onPress` tap drops/moves the pin
        // (mirrors MiniMap). FULL-SCREEN picker (`interactive`): no sheet to protect, so the map is the
        // moveable home map (pan / zoom / rotate), and the same `onPress` tap still drops the pin.
        dragPan={interactive}
        touchZoom={interactive}
        doubleTapZoom={interactive}
        doubleTapHoldZoom={interactive}
        touchRotate={interactive}
        touchPitch={interactive}
        onPress={onMapPress}
      >
        <Camera ref={cameraRef} initialViewState={initialViewState} />
        {picked ? (
          <Marker id="picked" lngLat={[picked.lng, picked.lat]} anchor="bottom">
            <View style={styles.pin}>
              <PinSvg fill={pinAppearance.fill} glyph={pinAppearance.glyph} size={40} />
            </View>
          </Marker>
        ) : null}
      </Map>

      {/* The "tap to place / move" hint pill. Suppressed in fullBleed: the full-screen picker's own
          floating chrome (PortraitMapPickStep) supplies the guidance + coord echo, and the pill would
          otherwise sit under that bottom bar. */}
      {fullBleed ? null : (
        <View style={styles.hint}>
          <Text style={styles.hintText} numberOfLines={1}>
            {picked ? t("hint.move") : t("hint.place")}
          </Text>
        </View>
      )}

      {/* Basemap attribution (App-Store-audit H10): the native maplibre attribution control is suppressed
          (attribution={false}) to keep the picker chrome clean, so a static CARTO/OSM credit stands in for
          it - the same static credit pattern MiniMap.native.tsx uses. In fullBleed it is lifted above the
          host's floating confirm/cancel bar via attributionBottomInset. */}
      <Text
        style={[
          styles.credit,
          fullBleed && attributionBottomInset != null ? { bottom: attributionBottomInset } : null,
        ]}
        pointerEvents="none"
      >
        {t("a11y.attribution")}
      </Text>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  // .pi-host-map: radius lg, overflow hidden, paper-2 while tiles load.
  wrap: {
    borderRadius: t.radius.lg,
    overflow: "hidden",
    backgroundColor: t.colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    justifyContent: "flex-end",
  },
  // Full-screen picker: fill the parent edge-to-edge, no card chrome. paper-2 shows while tiles load.
  wrapFull: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.bgAlt,
    justifyContent: "flex-end",
  },
  // The "no centre known yet" surface, in place of the map (see the early return): the same warm paper-2
  // the wrappers already paint while tiles load, so the placeholder -> map handoff is a fade-in of tiles
  // rather than a change of background colour.
  pending: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  pin: {
    alignItems: "center",
    justifyContent: "center",
    ...t.shadows.pin,
  },
  // .pi-host-map bottom hint strip.
  hint: {
    alignSelf: "center",
    marginBottom: t.space["3"],
    paddingHorizontal: t.space["3"],
    paddingVertical: 7,
    borderRadius: t.radius.pill,
    backgroundColor: t.glass.button.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.glass.button.border,
    maxWidth: "90%",
    pointerEvents: "none",
  },
  hintText: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: t.colors.text,
  },
  // Static basemap credit (bottom-right), mirroring MiniMap.native.tsx's CARTO/OSM credit.
  credit: {
    position: "absolute",
    bottom: 4,
    right: 6,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 9,
    color: t.colors.textSubtle,
  },
}))
