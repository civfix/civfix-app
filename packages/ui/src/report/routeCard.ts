import type { JurisdictionDTO } from "@civfix/shared"

export type RouteCardState =
  | { kind: "no_point" }
  | { kind: "routable"; name: string }
  | { kind: "new_area"; cityState: string }
  | { kind: "uncovered" }
  | { kind: "unavailable" }
  | { kind: "resolving" }

export interface RouteLookup {
  data: JurisdictionDTO | null | undefined
  isError: boolean
  isFetching: boolean
}

/**
 * What the review step's route card says. The lookup rejects on a transient failure instead of caching
 * "not covered", so a failed lookup with nothing to show is its own state, not an endless "resolving".
 */
export function routeCardState(hasPoint: boolean, lookup: RouteLookup): RouteCardState {
  if (!hasPoint) return { kind: "no_point" }
  const { data } = lookup
  if (data) return data.routable ? { kind: "routable", name: data.name } : { kind: "new_area", cityState: data.cityStateLabel }
  if (data === null) return { kind: "uncovered" }
  if (lookup.isError && !lookup.isFetching) return { kind: "unavailable" }
  return { kind: "resolving" }
}
