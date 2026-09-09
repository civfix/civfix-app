import { Platform, Share } from "react-native"
import { File, Paths } from "expo-file-system"
import type { CalendarFileCapability } from "@civfix/ui/capabilities"

import { calendarDocumentWritable, calendarFileName, calendarShareSupported } from "./calendarFile"

export const nativeCalendarFile: CalendarFileCapability | undefined = calendarShareSupported(
  Platform.OS,
)
  ? {
      async save({ filename, ics }): Promise<boolean> {
        if (!calendarDocumentWritable(ics)) return false
        const file = new File(Paths.cache, calendarFileName(filename))
        try {
          if (file.exists) file.delete()
          file.create()
          file.write(ics)
          await Share.share({ url: file.uri })
          return true
        } catch {
          return false
        } finally {
          try {
            if (file.exists) file.delete()
          } catch {
          }
        }
      },
    }
  : undefined
