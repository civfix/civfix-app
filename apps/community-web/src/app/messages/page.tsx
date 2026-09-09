import { HomeShell } from "@/components/home/home-shell"

/**
 * /messages - the full message inbox. The web nav adapter seeds the Messages surface from the URL.
 * AppShell presents it standalone without the map in portrait and in the map-backed sidebar in
 * expanded layout.
 */
export default function MessagesPage() {
  return <HomeShell />
}
