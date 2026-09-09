import { HomeShell } from "@/components/home/home-shell"

/**
 * /people - public people discovery. The web nav adapter seeds the People surface from the URL.
 * AppShell presents it as a standalone portrait surface without the map; expanded layout places the
 * same surface in the sidebar while keeping the map mounted.
 */
export default function PeoplePage() {
  return <HomeShell />
}
