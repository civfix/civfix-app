import type { CalendarFileCapability } from "../capabilities"

export type CalendarSaveResult = "downloaded" | "unavailable"

export interface CalendarSaveInput {
  filename: string
  ics: string
  writer?: CalendarFileCapability | undefined
}
