import assert from "node:assert/strict"
import { test } from "node:test"
import * as lifecycle from "../src/lib/mapLifecycle.ts"

test("a camera request made while the map is hidden replays when its instance becomes ready", () => {
  const target = { lat: 37.7749, lng: -122.4194, zoom: 16 }
  const request = lifecycle.beginMapRequest(lifecycle.createMapLifecycleState())
  let state = lifecycle.resolveMapRequest(request.state, request.generation, target)

  state = lifecycle.mountMap(state, 1)
  state = lifecycle.markMapReady(state, 1)
  const flight = lifecycle.takePendingMapTarget(state, 1)

  assert.deepEqual(flight.target, target)
  assert.equal(flight.state.pendingTarget, null)
})

test("the actual panned and zoomed viewport restores after a map remount", () => {
  const viewport = { center: { lat: 40.7411, lng: -73.9897 }, zoom: 13.25 }
  let state = lifecycle.mountMap(lifecycle.createMapLifecycleState(), 10)
  state = lifecycle.markMapReady(state, 10)
  state = lifecycle.acknowledgeMapSettlement(state, 10, viewport)
  state = lifecycle.unmountMap(state, 10)
  state = lifecycle.mountMap(state, 11)
  state = lifecycle.markMapReady(state, 11)

  assert.deepEqual(lifecycle.takePendingMapTarget(state, 11).target, {
    lat: viewport.center.lat,
    lng: viewport.center.lng,
    zoom: viewport.zoom,
  })
})

test("a late ready callback from an old map cannot consume the new map target", () => {
  let state = lifecycle.mountMap(lifecycle.createMapLifecycleState(), 20)
  state = lifecycle.unmountMap(state, 20)
  state = lifecycle.mountMap(state, 21)
  const request = lifecycle.beginMapRequest(state)
  const target = { lat: 47.6062, lng: -122.3321, zoom: 15 }
  state = lifecycle.resolveMapRequest(request.state, request.generation, target)

  state = lifecycle.markMapReady(state, 20)
  const staleFlight = lifecycle.takePendingMapTarget(state, 20)
  assert.equal(staleFlight.target, null)
  assert.deepEqual(staleFlight.state.pendingTarget?.target, target)

  state = lifecycle.markMapReady(staleFlight.state, 21)
  assert.deepEqual(lifecycle.takePendingMapTarget(state, 21).target, target)
})

test("a delayed initial-location result cannot replace a newer camera request", () => {
  const initial = lifecycle.beginMapRequest(lifecycle.createMapLifecycleState())
  const detail = lifecycle.beginMapRequest(initial.state)
  const detailTarget = { lat: 34.0522, lng: -118.2437, zoom: 14 }
  const staleInitialTarget = { lat: 37.7749, lng: -122.4194, zoom: 11 }

  let state = lifecycle.resolveMapRequest(detail.state, detail.generation, detailTarget)
  state = lifecycle.resolveMapRequest(state, initial.generation, staleInitialTarget)

  assert.deepEqual(state.pendingTarget?.target, detailTarget)
})

test("beginning a newer request invalidates an older pending target", () => {
  const first = lifecycle.beginMapRequest(lifecycle.createMapLifecycleState())
  const oldTarget = { lat: 41.8781, lng: -87.6298, zoom: 12 }
  const queued = lifecycle.resolveMapRequest(first.state, first.generation, oldTarget)

  const newer = lifecycle.beginMapRequest(queued)

  assert.equal(newer.state.pendingTarget, null)
})

test("a remount cannot resurrect an old target while a newer request is unresolved", () => {
  const oldTarget = { lat: 41.8781, lng: -87.6298, zoom: 12 }
  const newTarget = { lat: 47.6062, lng: -122.3321, zoom: 15 }
  const oldRequest = lifecycle.beginMapRequest(lifecycle.createMapLifecycleState())
  let state = lifecycle.resolveMapRequest(
    oldRequest.state,
    oldRequest.generation,
    oldTarget,
  )

  const newerRequest = lifecycle.beginMapRequest(state)
  state = lifecycle.mountMap(newerRequest.state, 60)
  state = lifecycle.markMapReady(state, 60)

  let flight = lifecycle.takePendingMapTarget(state, 60)
  assert.equal(flight.target, null)

  state = lifecycle.resolveMapRequest(
    flight.state,
    newerRequest.generation,
    newTarget,
  )
  flight = lifecycle.takePendingMapTarget(state, 60)
  assert.deepEqual(flight.target, newTarget)
})

test("map readiness cannot fly a target from an obsolete request generation", () => {
  const first = lifecycle.beginMapRequest(lifecycle.createMapLifecycleState())
  const oldTarget = { lat: 41.8781, lng: -87.6298, zoom: 12 }
  const newer = lifecycle.beginMapRequest(first.state)
  let state: lifecycle.MapLifecycleState = {
    ...newer.state,
    pendingTarget: { generation: first.generation, target: oldTarget },
  }
  state = lifecycle.mountMap(state, 30)
  state = lifecycle.markMapReady(state, 30)

  const flight = lifecycle.takePendingMapTarget(state, 30)

  assert.equal(flight.target, null)
  assert.equal(flight.state.pendingTarget, null)
})

test("an issued target survives immediate unmount and replays on the next map instance", () => {
  const target = { lat: 29.7604, lng: -95.3698, zoom: 14 }
  let state = lifecycle.mountMap(lifecycle.createMapLifecycleState(), 40)
  state = lifecycle.markMapReady(state, 40)
  const request = lifecycle.beginMapRequest(state)
  state = lifecycle.resolveMapRequest(request.state, request.generation, target)

  const issued = lifecycle.takePendingMapTarget(state, 40)
  assert.deepEqual(issued.state.inFlightTarget?.target, target)

  state = lifecycle.unmountMap(issued.state, 40)
  state = lifecycle.mountMap(state, 41)
  state = lifecycle.markMapReady(state, 41)

  assert.deepEqual(lifecycle.takePendingMapTarget(state, 41).target, target)
})

test("pre-flight and duplicate region callbacks cannot replace an issued target viewport", () => {
  const previousViewport = { lat: 39.7392, lng: -104.9903, zoom: 11 }
  const target = { lat: 32.7767, lng: -96.797, zoom: 15 }
  let state: lifecycle.MapLifecycleState = {
    ...lifecycle.mountMap(lifecycle.createMapLifecycleState(), 50),
    readyGeneration: 50,
    lastViewport: previousViewport,
  }
  const request = lifecycle.beginMapRequest(state)
  state = lifecycle.resolveMapRequest(request.state, request.generation, target)
  state = lifecycle.takePendingMapTarget(state, 50).state

  const preflight = {
    center: { lat: previousViewport.lat, lng: previousViewport.lng },
    zoom: previousViewport.zoom,
  }
  state = lifecycle.acknowledgeMapSettlement(state, 50, preflight)
  state = lifecycle.acknowledgeMapSettlement(state, 50, preflight)
  assert.deepEqual(state.lastViewport, previousViewport)
  assert.deepEqual(state.inFlightTarget?.target, target)

  state = lifecycle.acknowledgeMapSettlement(state, 50, {
    center: { lat: target.lat, lng: target.lng },
    zoom: target.zoom,
  })
  assert.deepEqual(state.lastViewport, target)
  assert.equal(state.inFlightTarget, null)
})

test("a flight that never arrives stops freezing the settled viewport once its deadline lapses", () => {
  const issuedAt = 1_000_000
  const preFlight = { lat: 39.7392, lng: -104.9903, zoom: 11 }
  const unreachable = { lat: 21.3069, lng: -157.8583, zoom: 15 }
  const panned = { center: { lat: 39.75, lng: -104.99 }, zoom: 12 }

  let state: lifecycle.MapLifecycleState = {
    ...lifecycle.mountMap(lifecycle.createMapLifecycleState(), 80),
    readyGeneration: 80,
    lastViewport: preFlight,
  }
  const request = lifecycle.beginMapRequest(state)
  state = lifecycle.resolveMapRequest(request.state, request.generation, unreachable)
  state = lifecycle.takePendingMapTarget(state, 80, issuedAt).state
  assert.deepEqual(state.inFlightTarget?.target, unreachable)

  state = lifecycle.acknowledgeMapSettlement(state, 80, panned, issuedAt + 500)
  assert.deepEqual(state.lastViewport, preFlight)
  assert.deepEqual(state.inFlightTarget?.target, unreachable)

  state = lifecycle.acknowledgeMapSettlement(
    state,
    80,
    panned,
    issuedAt + lifecycle.IN_FLIGHT_TARGET_TIMEOUT_MS,
  )
  assert.equal(state.inFlightTarget, null)
  assert.deepEqual(state.lastViewport, { lat: panned.center.lat, lng: panned.center.lng, zoom: panned.zoom })

  const later = { center: { lat: 47.6062, lng: -122.3321 }, zoom: 14 }
  state = lifecycle.acknowledgeMapSettlement(state, 80, later, issuedAt + 20_000)
  assert.deepEqual(state.lastViewport, { lat: later.center.lat, lng: later.center.lng, zoom: later.zoom })
})

test("a seed viewport survives a MapHomeScreen remount and replays on the next instance (defect 6)", () => {
  const seed = { lat: 37.7749, lng: -122.4194, zoom: 13.5 }
  let state = lifecycle.createMapLifecycleState(seed)
  assert.deepEqual(state.lastViewport, seed)
  state = lifecycle.mountMap(state, 70)
  state = lifecycle.markMapReady(state, 70)
  assert.deepEqual(lifecycle.takePendingMapTarget(state, 70).target, seed)
})

test("the module-singleton viewport persists the last settled camera across remounts, ignoring null", () => {
  const first = { lat: 40.7411, lng: -73.9897, zoom: 12 }
  lifecycle.rememberMapViewport(first)
  assert.deepEqual(lifecycle.recallMapViewport(), first)
  lifecycle.rememberMapViewport(null)
  assert.deepEqual(lifecycle.recallMapViewport(), first)
  const next = { lat: 34.0522, lng: -118.2437, zoom: 14 }
  lifecycle.rememberMapViewport(next)
  assert.deepEqual(lifecycle.recallMapViewport(), next)
})
