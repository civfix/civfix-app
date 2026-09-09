import { HomeShell } from "@/components/home/home-shell"

/**
 * /profile - the signed-in viewer's own profile. The web nav adapter seeds the You / profile surface
 * from the URL. AppShell presents it as a standalone portrait surface without the map; expanded layout
 * places the same surface in the sidebar while keeping the map mounted.
 */
export default function ProfilePage() {
  return <HomeShell />
}
