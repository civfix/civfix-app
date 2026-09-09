/**
 * Report data hooks that remain MOBILE-LOCAL after the UI-unification.
 *
 * Stage 4 slice 2 moved the report LIST + DETAIL + FOLLOW hooks into the shared @civfix/ui bodies, which
 * carry their own data hooks (`useMyReports` / `useReport` / `useFollowReport` in @civfix/ui/data). The
 * mobile deep-link host screens (app/reports, app/pin/[id]) now import those from @civfix/ui/data, so the
 * mobile duplicates were deleted. What REMAINS here is only what the mobile host still needs directly and
 * is NOT part of a shared body:
 *   - `reverseLabel`           - POST /map/reverse-label for the report DETAILS step address.
 * The reverse-label helper belongs to the report CAPTURE flow (the camera surface), not to a shared
 * list/detail body, so it stays here until that flow migrates in a later slice.
 *
 * The former `reportKeys` object is GONE: it hand-mirrored the shared factory (`detail(id)` ==
 * queryKeys.report, `myList` == the queryKeys.myReportsRoot prefix) and could only drift from it. Its one
 * consumer, useRealtimeChannel, now invalidates `queryKeys.myReportsRoot` from @civfix/ui/data directly.
 */
import type { ReverseLabelResponse } from "@civfix/shared"
import { api } from "@/api/client"

/**
 * POST /map/reverse-label - resolve a lat/lng to a human-readable label for the details step.
 *
 * The server replies 200 with an EMPTY `cityStateLabel` when the geocoder cannot place the point
 * (e.g. an off-grid coordinate or the simulator's default location). We normalize the label here -
 * trimming it - so callers get a clean string and can treat empty as "no result" with a simple
 * truthiness check instead of writing whitespace into the form (which previously left the address
 * field spinning on "Resolving location..." forever).
 */
export async function reverseLabel(lat: number, lng: number): Promise<ReverseLabelResponse> {
  const res = await api.reverseLabel({ lat, lng })
  return { ...res, cityStateLabel: res.cityStateLabel?.trim() ?? "" }
}
