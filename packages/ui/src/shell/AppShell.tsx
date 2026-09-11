import React from "react"
import { StyleSheet, View } from "react-native"
import { useLayoutMode } from "../theme"
import { useNavStore } from "../nav"
import { ExpandedShell } from "./ExpandedShell"
import { PortraitShell } from "./PortraitShell"
import { defaultRenderBody } from "./BodyRouter"
import { MediaLightboxProvider } from "../lightbox"
import { effectiveBaseView, portraitShellPlan } from "./bodyLayout"
import { DETAILS_ARE_FULL_PAGE } from "./detailPresentationPlatform"
import { MAP_IS_RETAINED } from "./mapRetentionPlatform"
import { SEARCH_IS_OVERLAY } from "./searchRevealPlatform"
import { useTabBarStore } from "./tabBarStore"
import type { AppShellProps } from "./types"

export function AppShell({ map, mapControls, authOverlay, renderBody = defaultRenderBody }: AppShellProps) {
  const mode = useLayoutMode()
  const view = useNavStore((state) => state.view)
  const active = useNavStore((state) => state.active)
  const seededDetailPage = useNavStore((state) => state.seededDetailPage)
  const fullPageDetails = DETAILS_ARE_FULL_PAGE || (mode === "compact" && seededDetailPage)
  const searchOverlayUp = SEARCH_IS_OVERLAY && view === "search"
  const lastNonSearchView = useTabBarStore((state) =>
    searchOverlayUp ? state.lastNonSearchView : null,
  )
  const baseView = effectiveBaseView(view, lastNonSearchView ?? view, SEARCH_IS_OVERLAY)
  const [mapRetained, setMapRetained] = React.useState(false)
  const basePlan = portraitShellPlan(baseView, active, fullPageDetails, mapRetained)
  const mountMap = mode === "expanded" || basePlan.mountMap
  React.useEffect(() => {
    if (MAP_IS_RETAINED && mountMap) setMapRetained(true)
  }, [mountMap])
  const mapVisible = mode === "expanded" || !basePlan.renderBaseBody
  const mountMapControls =
    mode === "expanded" || portraitShellPlan(view, active, fullPageDetails).mountMapControls

  React.useEffect(() => {
    useNavStore.getState().setMode(mode)
  }, [mode])

  return (
    <MediaLightboxProvider>
      <View style={StyleSheet.absoluteFill}>
        {mountMap ? (
          <View
            style={[StyleSheet.absoluteFill, styles.map, mapVisible ? null : styles.mapDetached]}
            accessibilityElementsHidden={!mapVisible}
            importantForAccessibility={mapVisible ? "auto" : "no-hide-descendants"}
          >
            {map}
          </View>
        ) : null}
        {mountMapControls ? <View style={styles.controls}>{mapControls}</View> : null}
        {mode === "expanded" ? (
          <ExpandedShell renderBody={renderBody} />
        ) : (
          <PortraitShell
            active={active}
            plan={basePlan}
            renderBody={renderBody}
            view={view}
            baseView={baseView}
            fullPageDetails={fullPageDetails}
          />
        )}
        {authOverlay ? (
          <View style={styles.overlay}>
            {authOverlay}
          </View>
        ) : null}
      </View>
    </MediaLightboxProvider>
  )
}

const styles = StyleSheet.create({
  map: { zIndex: 0 },
  mapDetached: { opacity: 0, pointerEvents: "none" },
  controls: { ...StyleSheet.absoluteFillObject, zIndex: 50, pointerEvents: "box-none" },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 70, pointerEvents: "box-none" },
})
