import { HomeShell } from "@/components/home/home-shell"

/**
 * /cleanups - the public events browse. The web nav adapter seeds the Events / cleanups surface from
 * the URL. AppShell presents it standalone without the map in portrait and in the map-backed sidebar
 * in expanded layout.
 */
export default function CleanupsPage() {
  return <HomeShell />
}
