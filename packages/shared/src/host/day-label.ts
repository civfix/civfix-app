const DAY_LABEL_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  // Day keys are plain calendar dates that `new Date(key)` reads as UTC midnight; formatting that
  // instant in the viewer's zone shows the previous day everywhere west of UTC.
  timeZone: "UTC",
}

export function weekDayLabel(locale: string): (day: string) => string {
  let format: Intl.DateTimeFormat
  try {
    format = new Intl.DateTimeFormat(locale, DAY_LABEL_FORMAT)
  } catch {
    format = new Intl.DateTimeFormat(undefined, DAY_LABEL_FORMAT)
  }
  return (day: string) => {
    const at = new Date(day)
    return Number.isNaN(at.getTime()) ? day : format.format(at)
  }
}
