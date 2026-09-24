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

const occlusion = readFileSync(new URL("../../../packages/ui/src/shell/shellOcclusion.ts", import.meta.url), "utf8")

test("the drop-pin camera takes the expanded frame plan's occlusion, read after the menu opens", () => {
  assert.match(cameraCall, /occlusionLeft: shellOcclusionLeft\(windowWidth\),/)
  assert.match(occlusion, /return expandedFramePlan\(\{/)
  assert.match(occlusion, /view: useNavStore\.getState\(\)\.view,/)
  assert.match(occlusion, /stackLength: useNavStore\.getState\(\)\.stack\.length,/)
  assert.match(occlusion, /sidebarWidth: clampSidebarWidth\(useSidebarStore\.getState\(\)\.width, windowWidth\),/)
  assert.match(occlusion, /\}\)\.occlusionLeft/)
})
