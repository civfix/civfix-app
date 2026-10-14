import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const base = strip(read("../MediaLightboxBase.tsx"))
const native = strip(read("../ZoomableMedia.native.tsx"))
const web = strip(read("../ZoomableMedia.web.tsx"))
const selector = strip(read("../ZoomableMedia.tsx"))

describe("the lightbox scrim", () => {
  it("uses the dedicated near-opaque lightbox scrim, not the shared strong scrim", () => {
    expect(base).toMatch(
      /scrim: \{\n\s*\.\.\.StyleSheet\.absoluteFillObject,\n\s*backgroundColor: t\.colors\.scrimLightbox,/,
    )
    expect(base).not.toContain("t.colors.scrimStrong")
    expect(base).toMatch(/controlBase: \{[\s\S]*?backgroundColor: t\.colors\.lightboxControl,/)
  })

  it("hardcodes no colour", () => {
    expect(base).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(base).not.toMatch(/rgba?\(/)
  })
})

describe("the lightbox controls sit in the safe area", () => {
  it("reads the device insets through the context form, which degrades to zero on web", () => {
    expect(base).toContain('import { SafeAreaInsetsContext } from "react-native-safe-area-context"')
    expect(base).toContain("const insets = useContext(SafeAreaInsetsContext)")
    expect(base).toContain("const offsets = lightboxControlOffsets(insets)")
    expect(base).not.toContain("useSafeAreaInsets")
  })

  it("positions the close button and both chevrons from those offsets", () => {
    expect(base).toContain("style={(state) => [styles.controlBase, offset, webCursor(false),")
    expect(base.match(/styles\.controlBase,/g)).toHaveLength(1)
    for (const control of ["close", "prev", "next"]) {
      expect(base).toContain(`offset={offsets.${control}}`)
    }
    expect(base).not.toMatch(/closeButton: \{/)
    expect(base).not.toMatch(/top: t\.space/)
  })
})

describe("the zoomable stage", () => {
  it("wraps ONLY an image, leaving video on the plain stage", () => {
    expect(base).toContain('current && current.kind === "image" ? (')
    expect(base).toContain("<ZoomableMedia")
    expect(base).toContain('current && current.kind !== "image" ? (')
    expect(base).toMatch(/<View style=\{styles\.stage\} pointerEvents="box-none">/)
  })

  it("hands the stage its measured content box and the window as the viewport", () => {
    expect(base).toContain("contentWidth={mediaWidth}")
    expect(base).toContain("contentHeight={mediaHeight}")
    expect(base).toContain("viewportWidth={windowWidth}")
    expect(base).toContain("viewportHeight={windowHeight}")
  })

  it("resets the zoom on every index change and on dismissal", () => {
    expect(base).toContain('resetToken={visible ? `${index}:${current.url}` : "closed"}')
    expect(native).toMatch(/useEffect\(\(\) => \{[\s\S]*?setZoomed\(false\)[\s\S]*?\}, \[resetToken/)
    expect(web).toMatch(/useEffect\(\(\) => \{\n\s*apply\(ZOOM_IDENTITY\)\n\s*\}, \[apply, resetToken\]\)/)
  })
})

describe("the ZoomableMedia seam split", () => {
  it("keeps gesture-handler and reanimated inside the native seam", () => {
    expect(native).toMatch(/^import \{ Gesture, [\w, ]+\} from "react-native-gesture-handler"$/m)
    expect(native).toMatch(/^import Animated, \{$/m)
    expect(native).toContain('} from "react-native-reanimated"')
  })

  it("keeps both of them OUT of the web seam and the selector", () => {
    for (const src of [web, selector]) {
      expect(src).not.toMatch(/react-native-gesture-handler/)
      expect(src).not.toMatch(/react-native-reanimated/)
      expect(src).not.toMatch(/Gesture\.\w/)
      expect(src).not.toMatch(/useSharedValue|useAnimatedStyle|runOnJS/)
    }
  })

  it("keeps the shared viewer free of them too, so the RNW bundle never sees a worklet", () => {
    expect(base).not.toMatch(/react-native-gesture-handler|react-native-reanimated/)
    expect(base).toContain('import { ZoomableMedia } from "./ZoomableMedia"')
  })

  it("re-exports the web seam from the extension-less selector", () => {
    expect(selector).toContain('export { ZoomableMedia } from "./ZoomableMedia.web"')
    expect(selector).toContain('export type { ZoomableMediaProps } from "./ZoomableMedia.types"')
  })
})

describe("the native gesture set", () => {
  it("composes pinch, a zoom-gated pan and a double tap", () => {
    expect(native).toContain("Gesture.Pinch()")
    expect(native).toContain("Gesture.Pan()")
    expect(native).toContain("Gesture.Tap()\n      .numberOfTaps(2)")
    expect(native).toContain("Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan))")
  })

  it("RACES the double tap instead of making pinch and pan wait for it to fail", () => {
    expect(native).not.toContain("Gesture.Exclusive(")
    expect(native).not.toContain(".maxDuration(")
  })

  it("opens the inter-tap window to the platform double-tap timeout, not the library's tighter default", () => {
    expect(native).toMatch(/^const DOUBLE_TAP_MAX_DELAY_MS = 300$/m)
    expect(native).toContain(".maxDelay(DOUBLE_TAP_MAX_DELAY_MS)")
  })

  it("lets a double tap land as far apart as a human taps, and still rejects a drag", () => {
    expect(native).toMatch(/^const DOUBLE_TAP_MAX_TRAVEL = 40$/m)
    expect(native).toContain(".maxDistance(DOUBLE_TAP_MAX_TRAVEL)")
  })

  it("arms the pan only past a travel slop, so a double tap is never swallowed by the race", () => {
    expect(native).toMatch(/^const PAN_ACTIVATE_TRAVEL = 12$/m)
    expect(native).toContain("onTouchesDown((event) => {")
    expect(native).toContain(
      "if (!travelExceeds(panTouchOrigin.value, { x: touch.absoluteX, y: touch.absoluteY }, PAN_ACTIVATE_TRAVEL)) {",
    )
  })

  it("never activates the pan until the image is actually zoomed, so a swipe at 1x stays free", () => {
    expect(native).toContain(".manualActivation(true)")
    expect(native).toMatch(
      /onTouchesMove\(\(event, manager\) => \{\s*if \(!isZoomed\(scale\.value\)\) \{\s*manager\.fail\(\)/,
    )
    expect(native).toContain("if (event.numberOfTouches > 1) return")
    expect(native).toContain("manager.activate()")
  })

  it("takes every number from the pure model, never from inline arithmetic", () => {
    expect(native).toContain("focalZoomTransform({")
    expect(native).toContain("panZoomTransform(")
    expect(native).toContain("doubleTapZoomTransform({")
    expect(native).toContain("settleZoomTransform(")
    expect(native).toContain("zoomGeometry({")
    expect(native).toContain("travelExceeds(")
  })

  it("hoists the reanimated timing config out of every worklet", () => {
    expect(native).toMatch(/^const SETTLE_CFG = timingConfig\(motion\.zoomSettle\)$/m)
    expect(native).not.toMatch(/withTiming\([^,]+, timingConfig\(/)
  })

  it("exposes the gesture surface to assistive tech and hides the duplicate image node", () => {
    expect(native).toContain("accessible\n")
    expect(native).toContain('accessibilityRole="image"')
    expect(native).toContain('accessibilityLabel={t("control.zoom_label")}')
    expect(native).toContain('accessibilityHint={t("control.zoom_hint")}')
    expect(native).toContain("accessibilityElementsHidden")
    expect(native).toContain('importantForAccessibility="no-hide-descendants"')
  })

  it("lets an unzoomed tap fall through to the scrim below", () => {
    expect(native).toContain('<View style={styles.viewport} pointerEvents="box-none">')
    expect(native).toContain("const surfaceStyle = zoomed ? styles.surfaceZoomed : styles.surface")
  })

  it("keeps box-none on a PLAIN View and sizes the gesture root to the surface, because Android drops pointerEvents on the RNGH root", () => {
    expect(native).toMatch(/<GestureHandlerRootView style=\{surfaceStyle\}>/)
    expect(native).not.toMatch(/<GestureHandlerRootView[^>]*pointerEvents/)
    expect(native).not.toMatch(/<GestureHandlerRootView style=\{styles\.viewport\}/)
  })

  it("carries its own gesture root, because an RN Modal is a separate native view tree on Android", () => {
    expect(native).toContain(
      'import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler"',
    )
    expect(native).toContain("</GestureHandlerRootView>")
  })

  it("only shrinks the full-screen pan surface once the zoom-out animation has finished", () => {
    expect(native).toMatch(/const nextZoomed = isZoomed\(next\.scale\)/)
    expect(native).toMatch(/if \(nextZoomed\) runOnJS\(setZoomed\)\(true\)/)
    expect(native).toMatch(/if \(finished && !nextZoomed\) runOnJS\(setZoomed\)\(false\)/)
  })
})

describe("the web pointer surface", () => {
  it("drives zoom from pointer, wheel and double-click events", () => {
    for (const event of ["pointerdown", "pointermove", "pointerup", "pointercancel", "wheel", "dblclick"]) {
      expect(web).toContain(`surface.addEventListener("${event}"`)
      expect(web).toContain(`surface.removeEventListener("${event}"`)
    }
    expect(web).toContain('surface.addEventListener("wheel", onWheel, { passive: false })')
  })

  it("claims the touch so the browser never pans or page-zooms the viewer", () => {
    expect(web).toContain('touchAction: "none"')
    expect(web).toContain("setPointerCapture")
    expect(web).toContain('surface.addEventListener("dragstart", onDragStart)')
  })

  it("writes the transform imperatively instead of re-rendering per frame", () => {
    expect(web).toContain("node.style.transform = cssZoomTransform(next)")
  })

  it("measures a two-finger pinch from the pointer pair", () => {
    expect(web).toContain("pointerDistance(two[0], two[1])")
    expect(web).toContain("pointerMidpoint(two[0], two[1])")
  })

  it("lets a trackpad accumulate small wheel steps, settling only once the stream stops", () => {
    expect(web).toMatch(/wheelSettle = window\.setTimeout\(\(\) => \{\n\s*wheelSettle = null\n\s*settle\(\)\n\s*\}, WHEEL_SETTLE_DELAY_MS\)/)
    expect(web).not.toMatch(/apply\(\s*settleZoomTransform\(\s*focalZoomTransform/)
    expect(web).toContain("cancelWheelSettle()")
  })

  it("recovers a pointer released outside the surface, so a stale id cannot fake a pinch", () => {
    expect(web).toContain('window.addEventListener("pointerup", onPointerEnd)')
    expect(web).toContain('window.removeEventListener("pointercancel", onPointerEnd)')
    expect(web).toContain("if (!pointers.delete(event.pointerId)) return")
  })

  it("holds the full-screen surface until the zoom-out transition ends", () => {
    expect(web).toMatch(/unzoomTimer\.current = window\.setTimeout\(/)
    expect(web).toContain("useEffect(() => clearUnzoomTimer, [clearUnzoomTimer])")
  })

  it("snaps without a transition when the viewer asks for reduced motion", () => {
    expect(web).toContain("const reduceMotion = useReducedMotion() === true")
    expect(web).toContain("const animate = animated && !reduceMotionRef.current")
    expect(web).toContain('node.style.transitionProperty = animate ? "transform" : "none"')
    expect(web).toContain("node.style.transitionDuration = `${animate ? SETTLE_MS : 0}ms`")
    expect(web).toContain('if (!animate || typeof window === "undefined") {')
  })

  it("zooms from the keyboard about the centre, and removes the listener with the others", () => {
    expect(web).toContain("const action = zoomKeyAction(event)")
    expect(web).toMatch(/focalX: rect\.width \/ 2,\s*focalY: rect\.height \/ 2,/)
    expect(web).toContain('window.addEventListener("keydown", onKeyDown)')
    expect(web).toContain('window.removeEventListener("keydown", onKeyDown)')
  })

  it("reads the pointer-worded zoom hint, not the touch one", () => {
    expect(web).toContain('accessibilityHint={t("control.zoom_hint_pointer")}')
    expect(native).toContain('accessibilityHint={t("control.zoom_hint")}')
  })

  it("keeps its own gesture surface tap-transparent while unzoomed", () => {
    expect(web).toContain('<View style={viewportStyle} pointerEvents="box-none">')
    expect(web).toContain("zoomed ? surfaceZoomedStyle : surfaceStyle")
  })
})

describe("the web seam keeps the keyboard shortcuts", () => {
  const shell = strip(read("../MediaLightbox.web.tsx"))

  it("still closes on Escape and pages with the arrow keys", () => {
    expect(shell).toContain('if (e.key === "Escape")')
    expect(shell).toContain('} else if (e.key === "ArrowRight") {')
    expect(shell).toContain('} else if (e.key === "ArrowLeft") {')
  })
})
