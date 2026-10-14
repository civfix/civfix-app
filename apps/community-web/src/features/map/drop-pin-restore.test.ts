/**
 * The web home map owns the drop-pin camera restore the mobile host already has: a dismissed pull-up flies
 * the map back to where the user was. `home-map.tsx` needs maplibre and a DOM, so the wiring is pinned by
 * source; the restore decision itself is covered by @civfix/ui's dropPinFlow tests.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const src = readFileSync(new URL("./home-map.tsx", import.meta.url), "utf8")
const handler = /const onLongPressMap = React\.useCallback\([\s\S]*?\n {2}\)\n/.exec(src)?.[0] ?? ""

describe("the web drop-pin camera restore", () => {
  it("registers the map's own LAT-first flyTo as the restorer and unregisters on unmount", () => {
    expect(src).toMatch(
      /setDropPinCameraRestorer\(\(restoreTarget\) => \{\n\s+mapRef\.current\?\.flyTo\(restoreTarget\.lat, restoreTarget\.lng, restoreTarget\.zoom\)\n\s+\}\)\n\s+return \(\) => setDropPinCameraRestorer\(null\)/,
    )
  })

  it("reads the pre-press camera and menu state BEFORE openDropPinMenu changes them", () => {
    const before = handler.indexOf("const viewportBefore = useMapViewport.getState().viewport")
    const menu = handler.indexOf('const menuAlreadyOpen = navBefore.stack.some((entry) => entry.kind === "drop-pin")')
    const open = handler.indexOf("if (!openDropPinMenu(lat, lng)) return")
    expect(before).toBeGreaterThan(-1)
    expect(menu).toBeGreaterThan(before)
    expect(open).toBeGreaterThan(menu)
  })

  it("arms the snapshot only after the menu opened, and before the fly", () => {
    const open = handler.indexOf("if (!openDropPinMenu(lat, lng)) return")
    const capture = handler.indexOf("captureDropPinCamera(")
    const fly = handler.indexOf("mapRef.current?.flyTo(target.lat, target.lng, target.zoom)")
    expect(capture).toBeGreaterThan(open)
    expect(fly).toBeGreaterThan(capture)
    expect(handler).toContain("flownTo: target,")
    expect(handler).toContain("view: navBefore.view,")
    expect(handler).toContain("menuAlreadyOpen,")
  })
})
