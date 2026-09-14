import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { test } from "node:test"
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
  TRACK_PIN_SPOTS,
  fractionInScene,
  mapArtFileName,
  pointInBox,
  type GeoPoint,
  type OnboardingMapScene,
} from "../src/components/onboarding/onboardingMapScenes.ts"

const appDir = new URL("../", import.meta.url)
const assetsDir = new URL("assets/onboarding/", appDir)
const stagesDir = new URL("src/components/onboarding/stages/", appDir)
const manifest = JSON.parse(readFileSync(new URL("manifest.json", assetsDir), "utf8"))

const MAX_TOTAL_BYTES = 1_500_000
const PALETTE_COLOUR_TYPE = 3
const EDGE_MARGIN = 0.06
const PIN_ASPECT = 76 / 64
const TRACK_ROW_TOP_OF_STAGE = 0.36
const TRACK_MAP_HEIGHT_OF_STAGE = 0.64
const TRACK_ROW_TOP_IN_MAP = TRACK_ROW_TOP_OF_STAGE / TRACK_MAP_HEIGHT_OF_STAGE
const REPORT_MAP_TOP_OF_STAGE = 0.2
const REPORT_MAP_HEIGHT_OF_STAGE = 0.8
const REPORT_SUCCESS_TOP_OF_STAGE = 0.82
const REPORT_SUCCESS_TOP_IN_MAP =
  (REPORT_SUCCESS_TOP_OF_STAGE - REPORT_MAP_TOP_OF_STAGE) / REPORT_MAP_HEIGHT_OF_STAGE
const REPORT_PIN_MIN_Y = 0.45

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
  if (scene.stage === "track") return [...TRACK_PIN_SPOTS, TRACK_CLUSTER_SPOT]
  return [TOGETHER_EVENT_SPOT]
}

function stillNames(): string[] {
  return ONBOARDING_MAP_STAGES.flatMap((stage) =>
    ONBOARDING_MAP_SCHEMES.flatMap((scheme) =>
      ONBOARDING_MAP_SCALES.map((scale) => mapArtFileName(stage, scheme, scale)),
    ),
  )
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

test("the report pin sits between the capture card and the success line", () => {
  const source = stageSource("ReportStage.tsx")
  assert.match(source, /height: "80%"/)
  assert.match(source, /top: "82%"/)
  const { y } = fractionInScene(ONBOARDING_MAP_SCENES.report, REPORT_PIN_SPOT)
  assert.ok(y >= REPORT_PIN_MIN_Y && y <= REPORT_SUCCESS_TOP_IN_MAP, `report pin y=${y.toFixed(3)}`)
})

test("track pins and the cluster stay above the report row and never overlap each other", () => {
  const source = stageSource("TrackStage.tsx")
  assert.match(source, /top: "36%"/)
  assert.match(source, /height: "64%"/)
  const scene = ONBOARDING_MAP_SCENES.track
  const pinSize = constantOf(source, "PIN_SIZE")
  const pinHeight = Math.round(pinSize * PIN_ASPECT)
  const clusterSize = constantOf(source, "CLUSTER_SIZE")
  const pins = TRACK_PIN_SPOTS.map((spot) => fractionInScene(scene, spot))
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

test("the together pin keeps its head inside the strip and its tip above the event card", () => {
  const source = stageSource("TogetherStage.tsx")
  const scene = ONBOARDING_MAP_SCENES.together
  const pinHeight = Math.round(constantOf(source, "PIN_SIZE") * PIN_ASPECT)
  const { y } = fractionInScene(scene, TOGETHER_EVENT_SPOT)
  assert.ok(y * scene.heightPt - pinHeight >= 0)
  assert.match(source, /marginTop: -t\.space\["4"\]/)
  assert.ok(y <= 0.85, `together pin y=${y.toFixed(3)}`)
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
  assert.match(source, /import \{ DEFAULT_ATTRIBUTION, Text, basemapPaper \} from "@civfix\/ui"/)
  assert.match(source, /\{DEFAULT_ATTRIBUTION\}/)
  assert.equal(DEFAULT_ATTRIBUTION, "(c) OpenStreetMap contributors, (c) CARTO")
  assert.match(source, /resizeMode="cover"/)
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
