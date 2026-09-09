/**
 * MiniMap (native seam) - the small non-interactive detail-location map on native
 * (@maplibre/maplibre-react-native v11). Ported from the mobile `components/map/MiniMap`.
 *
 * A locked CARTO Voyager raster map centered once on lat/lng with the focused teardrop planted on the
 * point: the category report teardrop when `category` is given, else the gold cleanup teardrop. All
 * gestures (pan/zoom/rotate/pitch) are disabled so the drag stays with the sheet. An optional top-left
 * glass tag pill shows `label`; a faint CARTO/OSM credit sits bottom-right.
 *
 * maplibre-react-native + react-native-svg are allowed here (this is the *.native.* map seam). The
 * shared SVG pins keep the marker pixel-identical to the home map.
 */
import React, { useMemo } from "react"
import { View, StyleSheet } from "react-native"
import { Map, Camera, Marker } from "@maplibre/maplibre-react-native"
import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec"
import { makeThemedStyles, useTheme } from "../theme"
import { Text } from "../typography"
import { useT } from "../i18n"
import { useCartoApiKey } from "../data"
import { rasterMapStyle, DEFAULT_ATTRIBUTION } from "./mapStyle"
import { TeardropPin, EventPin } from "./pins"
import { MINIMAP_HEIGHT, MINIMAP_ZOOM, type MiniMapProps } from "./MiniMap.types"

export function MiniMap({ lat, lng, category, label, height = MINIMAP_HEIGHT, aspectRatio, zoom = MINIMAP_ZOOM }: MiniMapProps) {
  const styles = useStyles()
  const scheme = useTheme().scheme
  const { t } = useT("map-ui")
  // The shared rasterMapStyle is typed structurally (MapStyleInput); the native Map wants the concrete
  // StyleSpecification. The object is structurally identical, so cast through (mirrors Map.native).
  const cartoApiKey = useCartoApiKey()
  const mapStyle = useMemo(
    () => rasterMapStyle(DEFAULT_ATTRIBUTION, { cartoApiKey, scheme }) as string | StyleSpecification,
    [cartoApiKey, scheme],
  )
  const center: [number, number] = [lng, lat]

  return (
    <View style={[styles.wrap, aspectRatio != null ? { aspectRatio } : { height }]}>
      <Map
        style={styles.map}
        mapStyle={mapStyle}
        logo={false}
        compass={false}
        attribution={false}
        dragPan={false}
        touchZoom={false}
        doubleTapZoom={false}
        doubleTapHoldZoom={false}
        touchRotate={false}
        touchPitch={false}
      >
        <Camera initialViewState={{ center, zoom }} />
        <Marker id="mini" lngLat={center} anchor="bottom">
          {category != null ? <TeardropPin category={category} /> : <EventPin />}
        </Marker>
      </Map>

      {label ? (
        <View style={styles.tag}>
          <Text style={styles.tagText}>{label}</Text>
        </View>
      ) : null}

      <Text style={styles.credit} pointerEvents="none">
        {t("a11y.attribution")}
      </Text>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  // .pi-detail-map: radius lg, overflow hidden, paper-2 while tiles load.
  wrap: {
    borderRadius: t.radius.lg,
    overflow: "hidden",
    backgroundColor: t.colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    // The mini-map is purely decorative: disabling MapLibre's gesture props (dragPan/touchZoom/...)
    // stops the map panning but the native MapView STILL swallows the touch, so a drag that starts on
    // the hero never reaches the sheet's BottomSheetScrollView - the "can't scroll the event detail"
    // bug. Make the whole embed touch-transparent so the drag falls straight through to the scroller
    // (mirrors the web seam's `interactive: false` inert canvas; the label/credit are already inert).
    pointerEvents: "none",
  },
  map: {
    flex: 1,
  },
  // .pi-detail-tag: top-left glass pill, eyebrow text.
  tag: {
    position: "absolute",
    top: t.space["3"],
    left: t.space["3"],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: t.radius.pill,
    backgroundColor: t.glass.button.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.glass.button.border,
    pointerEvents: "none",
  },
  tagText: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    letterSpacing: 0.5,
    color: t.colors.text,
  },
  credit: {
    position: "absolute",
    bottom: 4,
    right: 6,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: 9,
    color: t.colors.textSubtle,
  },
}))
