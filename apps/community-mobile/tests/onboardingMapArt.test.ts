import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { test } from "node:test"
import { space } from "../../../packages/shared/src/tokens/design-tokens.ts"
import { DEFAULT_ATTRIBUTION } from "../../../packages/ui/src/map/mapStyle.ts"
import { readPngHeader } from "./helpers/png.ts"
import {
  LA_BASIN_BOUNDS,
  ONBOARDING_MAP_SCALES,
  ONBOARDING_MAP_SCENES,
  ONBOARDING_MAP_SCHEMES,
  ONBOARDING_MAP_STAGES,
  REPORT_PIN_SPOT,
  TOGETHER_EVENT_SPOT,
  TRACK_CLUSTER_SPOT,
  TRACK_PINS,
  fractionInScene,
  mapArtFileName,
  pointInBox,
  sceneAspectRatio,
  type GeoPoint,
  type OnboardingMapScene,
} from "../src/components/onboarding/onboardingMapScenes.ts"

const appDir = new URL("../", import.meta.url)
const assetsDir = new URL("assets/onboarding/", appDir)
const onboardingDir = new URL("src/components/onboarding/", appDir)
const stagesDir = new URL("stages/", onboardingDir)
const manifest = JSON.parse(readFileSync(new URL("manifest.json", assetsDir), "utf8"))
const script = readFileSync(new URL("scripts/onboarding-map-art.mjs", appDir), "utf8")

const MAX_TOTAL_BYTES = 1_500_000
const PALETTE_COLOUR_TYPE = 3
const EDGE_MARGIN = 0.06
const PIN_ASPECT = 76 / 64
const STAGE_WIDTHS_PT = [353, 358, 390]
const STAGE_ASPECT_RATIO = 0.92
const TRACK_ROW_TOP_OF_STAGE = 0.36
const TRACK_MAP_HEIGHT_OF_STAGE = 0.64
const TRACK_ROW_TOP_IN_MAP = TRACK_ROW_TOP_OF_STAGE / TRACK_MAP_HEIGHT_OF_STAGE
const REPORT_MAP_TOP_OF_STAGE = 0.2
const REPORT_MAP_HEIGHT_OF_STAGE = 0.8
const REPORT_SUCCESS_TOP_OF_STAGE = 0.82
const REPORT_SUCCESS_TOP_IN_MAP =
  (REPORT_SUCCESS_TOP_OF_STAGE - REPORT_MAP_TOP_OF_STAGE) / REPORT_MAP_HEIGHT_OF_STAGE
const REPORT_PIN_MIN_Y = 0.45
const TOGETHER_PIN_MID_TOLERANCE = 0.05
const TOGETHER_CARD_OVERLAP = space["4"]
const TOGETHER_ATTRIBUTION_INSET = TOGETHER_CARD_OVERLAP + space["2"]
const ATTRIBUTION_PILL_HEIGHT = 24

function stageSource(name: string): string {
  return readFileSync(new URL(name, stagesDir), "utf8")
}

function constantOf(source: string, name: string): number {
  const match = source.match(new RegExp(`const ${name} = (\\d+)`))
  assert.ok(match, `${name} is not a plain numeric constant`)
  return Number(match[1])
}

function inBasin(point: GeoPoint): boolean {
  return (
    point.lat >= LA_BASIN_BOUNDS.south &&
    point.lat <= LA_BASIN_BOUNDS.north &&
    point.lng >= LA_BASIN_BOUNDS.west &&
    point.lng <= LA_BASIN_BOUNDS.east
  )
}

function spotsOf(scene: OnboardingMapScene): readonly GeoPoint[] {
  if (scene.stage === "report") return [REPORT_PIN_SPOT]
  if (scene.stage === "track") return [...TRACK_PINS.map((pin) => pin.spot), TRACK_CLUSTER_SPOT]
  return [TOGETHER_EVENT_SPOT]
}

function stillNames(): string[] {
  return ONBOARDING_MAP_STAGES.flatMap((stage) =>
    ONBOARDING_MAP_SCHEMES.flatMap((scheme) =>
      ONBOARDING_MAP_SCALES.map((scale) => mapArtFileName(stage, scheme, scale)),
    ),
  )
}

function togetherStripHeight(width: number): number {
  return width / sceneAspectRatio(ONBOARDING_MAP_SCENES.together)
}

test("the scene table covers exactly the three map stages of the tour", () => {
  assert.deepEqual([...ONBOARDING_MAP_STAGES], ["report", "track", "together"])
  assert.deepEqual(Object.keys(ONBOARDING_MAP_SCENES).sort(), [...ONBOARDING_MAP_STAGES].sort())
  for (const stage of ONBOARDING_MAP_STAGES) {
    const scene = ONBOARDING_MAP_SCENES[stage]
    assert.equal(scene.stage, stage)
    assert.ok(scene.place.length > 0)
    assert.ok(scene.zoom >= 15 && scene.zoom <= 17, `${stage}: blocks and street names need z15-z17`)
    assert.ok(scene.widthPt > 0 && scene.heightPt > 0)
  }
})

test("every scene centre and every pin spot is a real place inside the Los Angeles basin", () => {
  for (const stage of ONBOARDING_MAP_STAGES) {
    const scene = ONBOARDING_MAP_SCENES[stage]
    assert.ok(inBasin(scene.center), `${stage}: centre outside LA`)
    for (const spot of spotsOf(scene)) assert.ok(inBasin(spot), `${stage}: pin spot outside LA`)
  }
})

test("every pin lands inside its still, clear of the edges", () => {
  for (const stage of ONBOARDING_MAP_STAGES) {
    const scene = ONBOARDING_MAP_SCENES[stage]
    for (const spot of spotsOf(scene)) {
      const { x, y } = fractionInScene(scene, spot)
      assert.ok(x >= EDGE_MARGIN && x <= 1 - EDGE_MARGIN, `${stage}: x=${x.toFixed(3)}`)
      assert.ok(y >= EDGE_MARGIN && y <= 1 - EDGE_MARGIN, `${stage}: y=${y.toFixed(3)}`)
    }
  }
})

test("the track pins are one table of category, spot and rise that every consumer reads", () => {
  assert.equal(TRACK_PINS.length, 7)
  assert.equal(new Set(TRACK_PINS.map((pin) => pin.category)).size, TRACK_PINS.length)
  for (const pin of TRACK_PINS) assert.ok(pin.rise > 0)
  const demo = readFileSync(new URL("demoWorld.ts", onboardingDir), "utf8")
  assert.doesNotMatch(demo, /TRACK_PIN_CATEGORIES|TRACK_PIN_RISES|TRACK_PIN_SPOTS|export \{ TRACK_CLUSTER_SPOT \}/)
  assert.match(demo, /DEMO_REPORT_LAT = TRACK_PINS\[TRACK_ROW_PIN_INDEX\]\.spot\.lat/)
  const track = stageSource("TrackStage.tsx")
  assert.match(track, /import \{ TRACK_CLUSTER_SPOT, TRACK_PINS, type BoxPoint \} from "\.\.\/onboardingMapScenes"/)
  assert.doesNotMatch(track, /TRACK_PINS,\n\s+TRACK_ROW_PIN_INDEX/)
  assert.match(script, /TRACK_PINS\.map\(\(pin\) => pin\.spot\)/)
  assert.doesNotMatch(script, /TRACK_PIN_SPOTS/)
})

test("the report pin sits between the capture card and the success line at every phone width", () => {
  const source = stageSource("ReportStage.tsx")
  assert.match(source, /height: "80%"/)
  assert.match(source, /top: "82%"/)
  const scene = ONBOARDING_MAP_SCENES.report
  const pinHeight = Math.round(constantOf(source, "PIN_SIZE") * PIN_ASPECT)
  const { y } = fractionInScene(scene, REPORT_PIN_SPOT)
  assert.ok(y >= REPORT_PIN_MIN_Y && y <= REPORT_SUCCESS_TOP_IN_MAP, `report pin y=${y.toFixed(3)}`)
  for (const width of STAGE_WIDTHS_PT) {
    const height = (width / STAGE_ASPECT_RATIO) * REPORT_MAP_HEIGHT_OF_STAGE
    const at = pointInBox(scene, REPORT_PIN_SPOT, { width, height })
    assert.ok(at.top - pinHeight >= height * REPORT_PIN_MIN_Y - pinHeight, `${width}: pin under the card`)
    assert.ok(at.top <= height * REPORT_SUCCESS_TOP_IN_MAP, `${width}: pin tip under the success line`)
  }
})

test("the report pin stays landed through the loop's reset and only lifts to re-drop", () => {
  const source = stageSource("ReportStage.tsx")
  assert.match(source, /const landed = useSharedValue\(false\)/)
  assert.match(source, /if \(!active\) landed\.value = false/)
  assert.match(source, /\(\) => progress\.value >= W_PIN\[1\],\n\s+\(dropped\) => \{\n\s+if \(dropped\) landed\.value = true/)
  assert.match(source, /const resting = landed\.value && progress\.value < W_PIN\[0\]/)
  assert.match(source, /const drop = resting \? 1 : GRAVITY_EASE\(segment\(progress\.value, W_PIN\[0\], W_PIN\[1\]\)\)/)
})

test("track pins and the cluster stay above the report row and never overlap each other", () => {
  const source = stageSource("TrackStage.tsx")
  assert.match(source, /top: "36%"/)
  assert.match(source, /height: "64%"/)
  const scene = ONBOARDING_MAP_SCENES.track
  const pinSize = constantOf(source, "PIN_SIZE")
  const pinHeight = Math.round(pinSize * PIN_ASPECT)
  const clusterSize = constantOf(source, "CLUSTER_SIZE")
  const pins = TRACK_PINS.map((pin) => fractionInScene(scene, pin.spot))
  for (const [i, pin] of pins.entries()) {
    assert.ok(pin.y <= TRACK_ROW_TOP_IN_MAP, `pin ${i} tip is under the report row`)
    assert.ok(pin.y * scene.heightPt >= pinHeight, `pin ${i} head is clipped by the top edge`)
    for (const [j, other] of pins.entries()) {
      if (j <= i) continue
      const dx = Math.abs(pin.x - other.x) * scene.widthPt
      const dy = Math.abs(pin.y - other.y) * scene.heightPt
      assert.ok(dx >= pinSize || dy >= pinHeight, `pins ${i} and ${j} overlap`)
    }
  }
  const cluster = fractionInScene(scene, TRACK_CLUSTER_SPOT)
  assert.ok(cluster.y * scene.heightPt + clusterSize / 2 <= TRACK_ROW_TOP_IN_MAP * scene.heightPt)
})

test("the together strip is a fixed-aspect box sized by its scene, not the leftover of a flex column", () => {
  const source = stageSource("TogetherStage.tsx")
  assert.match(source, /const STRIP_ASPECT_RATIO = sceneAspectRatio\(ONBOARDING_MAP_SCENES\.together\)/)
  assert.match(source, /mapStrip: \{\n\s+width: "100%",\n\s+aspectRatio: STRIP_ASPECT_RATIO,\n\s+\}/)
  assert.match(source, /const CARD_OVERLAP = space\["4"\]/)
  assert.match(source, /marginTop: -CARD_OVERLAP/)
  assert.match(source, /const ATTRIBUTION_INSET = CARD_OVERLAP \+ space\["2"\]/)
  assert.match(source, /<MapStill stage="together" style=\{styles\.mapStrip\} attributionInset=\{ATTRIBUTION_INSET\}>/)
  assert.doesNotMatch(source, /minHeight|STAGE_ASPECT_RATIO|attributionEdge/)
  assert.equal(TOGETHER_CARD_OVERLAP, 16)
  assert.equal(TOGETHER_ATTRIBUTION_INSET, 24)
})

test("the together pin lands mid-strip with its head inside the strip and its tip above the card and the credit", () => {
  const source = stageSource("TogetherStage.tsx")
  const scene = ONBOARDING_MAP_SCENES.together
  const pinSize = constantOf(source, "PIN_SIZE")
  const pinHeight = Math.round(pinSize * PIN_ASPECT)
  const { y } = fractionInScene(scene, TOGETHER_EVENT_SPOT)
  assert.ok(Math.abs(y - 0.5) <= TOGETHER_PIN_MID_TOLERANCE, `together pin y=${y.toFixed(3)}`)
  for (const width of STAGE_WIDTHS_PT) {
    const height = togetherStripHeight(width)
    const at = pointInBox(scene, TOGETHER_EVENT_SPOT, { width, height })
    assert.ok(at.top - pinHeight >= 0, `${width}: pin head is clipped by the strip's top edge`)
    assert.ok(at.left - pinSize / 2 >= 0 && at.left + pinSize / 2 <= width, `${width}: pin off the strip`)
    assert.ok(at.top <= height - TOGETHER_CARD_OVERLAP, `${width}: pin tip is under the event card`)
    assert.ok(
      at.top <= height - TOGETHER_ATTRIBUTION_INSET - ATTRIBUTION_PILL_HEIGHT,
      `${width}: pin tip is on the credit pill`,
    )
  }
})

test("a still exists for every stage, scheme and scale, at exactly the scaled point size", () => {
  for (const stage of ONBOARDING_MAP_STAGES) {
    const scene = ONBOARDING_MAP_SCENES[stage]
    for (const scheme of ONBOARDING_MAP_SCHEMES) {
      for (const scale of ONBOARDING_MAP_SCALES) {
        const name = mapArtFileName(stage, scheme, scale)
        const header = readPngHeader(readFileSync(new URL(name, assetsDir)))
        assert.equal(header.width, scene.widthPt * scale, `${name}: width`)
        assert.equal(header.height, scene.heightPt * scale, `${name}: height`)
        assert.equal(header.colourType, PALETTE_COLOUR_TYPE, `${name}: must stay palettised`)
        assert.equal(header.bitDepth, 8, `${name}: bit depth`)
        assert.equal(header.interlace, 0, `${name}: interlace`)
      }
    }
  }
})

test("the manifest matches the stills byte for byte and nothing else lives in the folder", () => {
  const onDisk = readdirSync(fileURLToPath(assetsDir)).filter((name) => name.endsWith(".png")).sort()
  assert.deepEqual(onDisk, stillNames().sort())
  assert.deepEqual(Object.keys(manifest.files).sort(), onDisk)
  assert.equal(manifest.attribution, DEFAULT_ATTRIBUTION)
  for (const name of onDisk) {
    const bytes = readFileSync(new URL(name, assetsDir))
    const entry = manifest.files[name]
    assert.equal(entry.bytes, bytes.length, `${name}: size drifted from the manifest`)
    assert.equal(
      entry.sha256,
      createHash("sha256").update(bytes).digest("hex"),
      `${name}: content drifted from the manifest; re-run scripts/onboarding-map-art.mjs`,
    )
    const header = readPngHeader(bytes)
    assert.equal(entry.width, header.width)
    assert.equal(entry.height, header.height)
  }
})

test("every still was cut from the scene the table describes today", () => {
  for (const stage of ONBOARDING_MAP_STAGES) {
    const { center, zoom, widthPt, heightPt } = ONBOARDING_MAP_SCENES[stage]
    for (const scheme of ONBOARDING_MAP_SCHEMES) {
      for (const scale of ONBOARDING_MAP_SCALES) {
        const name = mapArtFileName(stage, scheme, scale)
        assert.deepEqual(
          manifest.files[name].scene,
          { center, zoom, widthPt, heightPt },
          `${name}: scene drifted from the manifest; re-run scripts/onboarding-map-art.mjs`,
        )
      }
    }
  }
})

test("the stills stay inside the weight budget and light differs from dark", () => {
  const total = Object.values(manifest.files).reduce(
    (sum: number, entry: any) => sum + entry.bytes,
    0,
  )
  assert.ok(total <= MAX_TOTAL_BYTES, `onboarding stills weigh ${total} bytes`)
  for (const stage of ONBOARDING_MAP_STAGES) {
    for (const scale of ONBOARDING_MAP_SCALES) {
      const light = manifest.files[mapArtFileName(stage, "light", scale)]
      const dark = manifest.files[mapArtFileName(stage, "dark", scale)]
      assert.notEqual(light.sha256, dark.sha256, `${stage}: light and dark stills are identical`)
    }
  }
})

test("the map surface bundles every still per scheme and credits OSM and CARTO", () => {
  const source = stageSource("MapStill.tsx")
  for (const stage of ONBOARDING_MAP_STAGES) {
    for (const scheme of ONBOARDING_MAP_SCHEMES) {
      assert.ok(
        source.includes(`require("../../../../assets/onboarding/${stage}-${scheme}.png")`),
        `MapStill does not bundle ${stage}-${scheme}`,
      )
      for (const scale of ONBOARDING_MAP_SCALES) {
        assert.equal(mapArtFileName(stage, scheme, scale), `${stage}-${scheme}@${scale}x.png`)
      }
    }
  }
  assert.match(source, /\{DEFAULT_ATTRIBUTION\}/)
  assert.equal(DEFAULT_ATTRIBUTION, "(c) OpenStreetMap contributors, (c) CARTO")
  assert.match(source, /resizeMode="cover"/)
  assert.match(source, /const inset = attributionInset \?\? space\["2"\]/)
})

test("every map stage draws the real still and the drawn paper map is gone", () => {
  const files = readdirSync(fileURLToPath(stagesDir))
  assert.ok(!files.includes("PaperMap.tsx"))
  assert.match(stageSource("ReportStage.tsx"), /<MapStill stage="report"/)
  assert.match(stageSource("TrackStage.tsx"), /<MapStill stage="track"/)
  assert.match(stageSource("TogetherStage.tsx"), /<MapStill stage="together"/)
  for (const name of ["ReportStage.tsx", "TrackStage.tsx", "TogetherStage.tsx"]) {
    assert.doesNotMatch(stageSource(name), /PaperMap|mapSpot\(/)
  }
})

test("pointInBox is the identity for the still's own aspect and letterboxes a wider box", () => {
  const scene = ONBOARDING_MAP_SCENES.together
  const fraction = fractionInScene(scene, TOGETHER_EVENT_SPOT)
  const same = pointInBox(scene, TOGETHER_EVENT_SPOT, {
    width: scene.widthPt,
    height: scene.heightPt,
  })
  assert.ok(Math.abs(same.left - fraction.x * scene.widthPt) < 1e-9)
  assert.ok(Math.abs(same.top - fraction.y * scene.heightPt) < 1e-9)
  const shorter = pointInBox(scene, TOGETHER_EVENT_SPOT, { width: scene.widthPt, height: 100 })
  assert.ok(Math.abs(shorter.left - same.left) < 1e-9)
  assert.ok(Math.abs(shorter.top - (same.top - (scene.heightPt - 100) / 2)) < 1e-9)
})

test("the generator re-execs on the strip-types flag itself and never prints the CARTO key", () => {
  assert.match(script, /if \(!process\.execArgv\.includes\("--experimental-strip-types"\)\) \{/)
  assert.doesNotMatch(script, /process\.features\.typescript/)
  assert.match(script, /for \$\{publicTileUrl\(url\)\}/)
  assert.doesNotMatch(script, /for \$\{url\}/)
  assert.match(script, /scene: \{\n\s+center: scene\.center,\n\s+zoom: scene\.zoom,\n\s+widthPt: scene\.widthPt,\n\s+heightPt: scene\.heightPt,/)
})
