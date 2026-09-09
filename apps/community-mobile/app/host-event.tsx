/**
 * HOST AN EVENT deep-link host (/host-event) - UI-unification Stage 4 fix.
 *
 * The create-cleanup form is a SHARED @civfix/ui body (CreateCleanupBody) rendered IN the map-home sheet by
 * the unified shell's BodyRouter (a "create-cleanup" detail). It is an IN-SHEET surface now (it was one of
 * the old mobile full-screen "overlay" kinds), so the events list "Host" control and a deep link both route
 * through the nav store, not a full screen. This route file remains only as the cold deep-link HOST: a
 * `router.push("/host-event")` lands here, where we SEED the unified nav store with the `create-cleanup`
 * entry and replace to the map-home ("/"), which then renders the shared host form in the sheet (full snap;
 * the shared report/host draft store keeps wizard progress drag-safe). On publish the shared body itself
 * navigates to the new event via the nav store.
 *
 * NB: /host-event is deliberately NOT on the server-link allowlist (it is an in-app-only path), so this
 * shim seeds the entry directly rather than via applyInternalHref. The old mobile host form was deleted in
 * slice 3 (now @civfix/ui); this host carries no form UI.
 */
import { seedEntry } from "@/components/MobileNavAdapter"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function HostEventHostScreen() {
  return <DeepLinkHost seed={() => seedEntry({ kind: "create-cleanup" })} />
}
