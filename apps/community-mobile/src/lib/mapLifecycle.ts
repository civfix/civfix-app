export interface MapCameraTarget {
  lat: number
  lng: number
  zoom?: number
}

export interface MapViewportSnapshot {
  center: { lat: number; lng: number }
  zoom: number
}

export interface PendingMapTarget {
  generation: number
  target: MapCameraTarget
}

export interface InFlightMapTarget extends PendingMapTarget {
  issuedAt: number
}

export const IN_FLIGHT_TARGET_TIMEOUT_MS = 4000

export interface MapLifecycleState {
  mountedGeneration: number | null
  readyGeneration: number | null
  latestRequestGeneration: number
  pendingTarget: PendingMapTarget | null
  inFlightTarget: InFlightMapTarget | null
  lastViewport: MapCameraTarget | null
}

export function createMapLifecycleState(seedViewport: MapCameraTarget | null = null): MapLifecycleState {
  return {
    mountedGeneration: null,
    readyGeneration: null,
    latestRequestGeneration: 0,
    pendingTarget: null,
    inFlightTarget: null,
    lastViewport: seedViewport,
  }
}

let persistedViewport: MapCameraTarget | null = null

export function rememberMapViewport(target: MapCameraTarget | null): void {
  if (target) persistedViewport = target
}

export function recallMapViewport(): MapCameraTarget | null {
  return persistedViewport
}

export function beginMapRequest(state: MapLifecycleState): {
  state: MapLifecycleState
  generation: number
} {
  const generation = state.latestRequestGeneration + 1
  return {
    state: {
      ...state,
      latestRequestGeneration: generation,
      pendingTarget: null,
    },
    generation,
  }
}

export function resolveMapRequest(
  state: MapLifecycleState,
  generation: number,
  target: MapCameraTarget,
): MapLifecycleState {
  if (generation !== state.latestRequestGeneration) return state
  return {
    ...state,
    pendingTarget: { generation, target },
  }
}

export function mountMap(state: MapLifecycleState, generation: number): MapLifecycleState {
  const replayTarget =
    state.pendingTarget ??
    state.inFlightTarget ??
    (state.lastViewport
      ? { generation: state.latestRequestGeneration, target: state.lastViewport }
      : null)
  return {
    ...state,
    mountedGeneration: generation,
    readyGeneration: null,
    pendingTarget: replayTarget,
    inFlightTarget: null,
  }
}

export function unmountMap(state: MapLifecycleState, generation: number): MapLifecycleState {
  if (state.mountedGeneration !== generation) return state
  return { ...state, mountedGeneration: null, readyGeneration: null }
}

const SETTLED_COORDINATE_EPSILON = 0.0001
const SETTLED_ZOOM_EPSILON = 0.1

function viewportMatchesTarget(
  viewport: MapViewportSnapshot,
  target: MapCameraTarget,
): boolean {
  const centerMatches =
    Math.abs(viewport.center.lat - target.lat) <= SETTLED_COORDINATE_EPSILON &&
    Math.abs(viewport.center.lng - target.lng) <= SETTLED_COORDINATE_EPSILON
  const zoomMatches =
    target.zoom === undefined || Math.abs(viewport.zoom - target.zoom) <= SETTLED_ZOOM_EPSILON
  return centerMatches && zoomMatches
}

export function acknowledgeMapSettlement(
  state: MapLifecycleState,
  generation: number,
  viewport: MapViewportSnapshot,
  now: number = Date.now(),
): MapLifecycleState {
  if (state.mountedGeneration !== generation) return state
  const inFlight = state.inFlightTarget
  if (
    inFlight &&
    !viewportMatchesTarget(viewport, inFlight.target) &&
    now - inFlight.issuedAt < IN_FLIGHT_TARGET_TIMEOUT_MS
  ) {
    return state
  }
  return {
    ...state,
    inFlightTarget: null,
    lastViewport: {
      lat: viewport.center.lat,
      lng: viewport.center.lng,
      zoom: viewport.zoom,
    },
  }
}

export function markMapReady(
  state: MapLifecycleState,
  generation: number,
): MapLifecycleState {
  if (state.mountedGeneration !== generation) return state
  return { ...state, readyGeneration: generation }
}

export function takePendingMapTarget(
  state: MapLifecycleState,
  generation: number,
  now: number = Date.now(),
): { state: MapLifecycleState; target: MapCameraTarget | null } {
  if (!state.pendingTarget) return { state, target: null }
  if (state.pendingTarget.generation !== state.latestRequestGeneration) {
    return { state: { ...state, pendingTarget: null }, target: null }
  }
  if (
    state.mountedGeneration !== generation ||
    state.readyGeneration !== generation
  ) {
    return { state, target: null }
  }
  return {
    state: {
      ...state,
      pendingTarget: null,
      inFlightTarget: { ...state.pendingTarget, issuedAt: now },
    },
    target: state.pendingTarget.target,
  }
}
