import { HomeShell } from "@/components/home/home-shell"

/**
 * /host - the host-an-event form. This route renders the same HomeShell as `/`; its web nav adapter
 * seeds the `create-cleanup` surface from the URL. AppShell presents the form standalone without the
 * map in portrait and in the map-backed sidebar in expanded layout. It posts to /cleanups with type
 * "site"; see src/features/host/host-form.
 */
export default function HostPage() {
  return <HomeShell />
}
