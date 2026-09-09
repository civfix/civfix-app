import { HomeShell } from "@/components/home/home-shell"

/**
 * /report - the public anonymous report submission flow. This route renders the same HomeShell as `/`;
 * its web nav adapter seeds the `drop` surface from the URL. AppShell presents the wizard as a
 * standalone portrait surface without the map, while expanded layout places it in the sidebar and
 * keeps the map mounted. See src/features/report for the submit pipeline (media presign -> PUT ->
 * finalize -> /anon/reports) and offline-graceful behavior.
 */
export default function ReportPage() {
  return <HomeShell />
}
