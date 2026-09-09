/**
 * MESSAGES inbox deep-link host (/messages) - UI-unification slice 6.
 *
 * The message-thread inbox is now a SHARED @civfix/ui body (MessagingListBody) rendered IN the map-home
 * sheet by the unified shell's BodyRouter (the "messaging" list view). `messages` is an IN-SHEET kind, so
 * an in-app open and a deep link both route through the nav store, not a full screen. This route file
 * remains only as the deep-link HOST: a `router.push("/messages")` seeds the "messaging" sheet view and
 * replaces to the map-home ("/"), which renders the shared inbox in the sheet over the live map.
 *
 * The old mobile MessagingListBody was deleted in slice 6 (now @civfix/ui); this host carries no inbox UI.
 */
import { useNavStore } from "@civfix/ui"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function MessagesHostScreen() {
  return (
    <DeepLinkHost
      seed={() => {
        // Seed the compact "messaging" tab with no detail open, then hand off to the always-mounted
        // map-home, which renders the shared MessagingListBody in the sheet.
        // originView must be nulled alongside the emptied stack: the store's invariant is that a
        // non-null originView implies a non-empty stack (it is what a pull-up dismisses back TO), and
        // this raw setState bypasses the reducers that normally maintain it.
        useNavStore.setState({ view: "messaging", stack: [], active: null, originView: null })
      }}
    />
  )
}
