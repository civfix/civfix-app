export interface InlineDateTimePickerErrors {
  date?: string | null
  time?: string | null
  endTime?: string | null
}

export interface InlineDateTimePickerProps {
  date: Date | null
  time: Date | null
  endTime?: Date | null
  timeZone: string
  minDate?: Date | null
  onDateChange: (next: Date) => void
  onTimeChange: (next: Date) => void
  onEndTimeChange?: (next: Date) => void
  errors?: InlineDateTimePickerErrors
}

export interface DateFieldRowProps {
  value: Date | null
  displayValue: string
  placeholder: boolean
  accessibilityLabel: string
  onChange: (next: Date) => void
  minDate?: Date | null
  label?: string
  error?: string | null
  spaced?: boolean
}

export interface TimeFieldRowProps {
  value: Date | null
  displayValue: string
  placeholder: boolean
  accessibilityLabel: string
  onChange: (next: Date) => void
  day?: Date | null
  minTime?: Date | null
  maxTime?: Date | null
  minuteInterval?: 1 | 5
  suffix?: string | null
  label?: string
  error?: string | null
  spaced?: boolean
}
