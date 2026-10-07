import { useCallback, useState } from "react"

export type HostSheetKey = "walkup" | "linking" | "duplicate" | "cancel" | "resources" | "noShows"

export type HostSheetsOpen = Readonly<Record<HostSheetKey, boolean>>

const NO_SHEETS_OPEN: HostSheetsOpen = {
  walkup: false,
  linking: false,
  duplicate: false,
  cancel: false,
  resources: false,
  noShows: false,
}

export function useHostSheetsOpen() {
  const [open, setOpen] = useState<HostSheetsOpen>(NO_SHEETS_OPEN)
  const setSheet = useCallback((key: HostSheetKey, value: boolean) => {
    setOpen((current) => (current[key] === value ? current : { ...current, [key]: value }))
  }, [])
  const openSheet = useCallback((key: HostSheetKey) => setSheet(key, true), [setSheet])
  const closeSheet = useCallback((key: HostSheetKey) => setSheet(key, false), [setSheet])
  return { open, openSheet, closeSheet }
}
