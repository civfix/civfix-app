// On a tablet the drop-pin camera must offset by the frame plan's occlusion, not half the card alone, or
// the pin sits west of the visible strip's centre. The home screen imports react-native, so the guard
// reads the camera call as text.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const home = readFileSync(new URL("../app/index.tsx", import.meta.url), "utf8")
const cameraCall = home.slice(
  home.indexOf("const target = dropPinCameraTarget({"),
  home.indexOf("if (viewportBefore) {", home.indexOf("const target = dropPinCameraTarget({")),
)

test("the drop-pin camera takes the expanded frame plan's occlusion, read after the menu opens", () => {
  assert.match(cameraCall, /occlusionLeft: expandedFramePlan\(\{/)
  assert.match(cameraCall, /view: useNavStore\.getState\(\)\.view,/)
  assert.match(cameraCall, /stackLength: useNavStore\.getState\(\)\.stack\.length,/)
  assert.match(cameraCall, /sidebarWidth: clampSidebarWidth\(useSidebarStore\.getState\(\)\.width, windowWidth\),/)
  assert.match(cameraCall, /\}\)\.occlusionLeft,/)
})
