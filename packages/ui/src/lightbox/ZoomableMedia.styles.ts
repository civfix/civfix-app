import type { ViewStyle } from "react-native"

const CENTERED: ViewStyle = { alignItems: "center", justifyContent: "center" }

const FILL: ViewStyle = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }

export const zoomViewportStyle: ViewStyle = { ...FILL, ...CENTERED }

export const zoomSurfaceStyle: ViewStyle = CENTERED

/** While zoomed the surface fills the viewport, so a pan can start anywhere on screen. */
export const zoomSurfaceZoomedStyle: ViewStyle = { ...FILL, ...CENTERED }
