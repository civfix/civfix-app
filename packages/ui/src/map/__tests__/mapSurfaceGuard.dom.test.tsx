import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type * as ReactNative from "react-native"
import { ApiProvider } from "../../data"
import { makeFakeDataContext } from "../../data/fakes"
import { I18nProvider } from "../../i18n"
import en from "../../i18n/locales/en/map-ui.json"
import { Map } from "../Map.web"
import { ReportPickMap } from "../ReportPickMap.web"
import { LocationPicker } from "../LocationPicker.web"

const constructed = vi.hoisted(() => ({ count: 0 }))

// maplibre-gl 6 throws GPUInitializationError from its constructor when the browser cannot create a WebGL2
// context, after the support probe has already passed.
vi.mock("maplibre-gl", () => {
  class GPUInitializationError extends Error {}
  class ThrowingMap {
    constructor() {
      constructed.count += 1
      throw new GPUInitializationError("Failed to initialize WebGL")
    }
  }
  class Control {}
  return {
    Map: ThrowingMap,
    NavigationControl: Control,
    AttributionControl: Control,
    Marker: Control,
    setWorkerUrl: () => {},
  }
})

// react-native-svg resolves to its native build under vitest; no pin is drawn once the constructor throws.
vi.mock("react-native-svg", () => {
  const Shape = () => null
  return {
    default: Shape,
    Circle: Shape,
    G: Shape,
    Line: Shape,
    Path: Shape,
    Polyline: Shape,
    Rect: Shape,
  }
})

// The icon set pulls in native-only modules; the fallback is read by its text.
vi.mock("../../typography", async () => {
  const { Text } = await vi.importActual<typeof ReactNative>("react-native")
  return { Text, Icon: () => null, iconMap: {} }
})

const CENTER = { lat: 34.05, lng: -118.25 }

const surfaces: [string, string, () => React.ReactElement][] = [
  ["home map", en.unavailable.home, () => <Map initialCenter={{ ...CENTER, zoom: 13 }} />],
  [
    "report pick map",
    en.unavailable.reportList,
    () => (
      <ReportPickMap
        center={CENTER}
        radiusM={500}
        zoom={14}
        pins={[]}
        stateOf={() => "idle"}
        focusedId={null}
        lookFor={() => ({ active: false, badge: null, muted: false })}
        pinLabel={() => ""}
        clusterLabel={() => ""}
        mapLabel="Map"
        meetingPointLabel="Meeting point"
        onPressPin={() => {}}
        onRegionChange={() => {}}
      />
    ),
  ],
  [
    "location picker",
    en.unavailable.picker,
    () => (
      <LocationPicker
        value={null}
        onChange={() => {}}
        initialCenter={CENTER}
        pin={{ kind: "report", category: null }}
      />
    ),
  ],
]

function renderSurface(surface: () => React.ReactElement) {
  return render(
    <ApiProvider value={makeFakeDataContext()}>
      <I18nProvider locale="en">{surface()}</I18nProvider>
    </ApiProvider>,
  )
}

const realGetContext = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "getContext")

function stubWebGL2(available: boolean) {
  const probeContext = { getExtension: () => ({ loseContext: () => {} }) }
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: (contextId: string) => (contextId === "webgl2" && available ? probeContext : null),
  })
}

beforeEach(() => {
  constructed.count = 0
})

afterEach(() => {
  if (realGetContext)
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", realGetContext)
  vi.restoreAllMocks()
})

describe("a web map surface that cannot render keeps the app up", () => {
  it.each(surfaces)(
    "%s shows the fallback when the map constructor throws",
    (_name, hint, surface) => {
      stubWebGL2(true)
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

      renderSurface(surface)

      expect(constructed.count).toBe(1)
      expect(screen.getByText(en.unavailable.title)).toBeTruthy()
      expect(screen.getByText(hint)).toBeTruthy()
      expect(consoleError).toHaveBeenCalled()
    },
  )

  it.each(surfaces)(
    "%s shows the fallback without constructing a map when WebGL2 is missing",
    (_name, hint, surface) => {
      stubWebGL2(false)
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})

      renderSurface(surface)

      expect(constructed.count).toBe(0)
      expect(screen.getByText(en.unavailable.title)).toBeTruthy()
      expect(screen.getByText(hint)).toBeTruthy()
      expect(consoleWarn.mock.calls.length).toBeLessThanOrEqual(1)
    },
  )
})
