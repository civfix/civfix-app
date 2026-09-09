"use client"

import { useT } from "@civfix/ui/i18n"

import { ImageUploadField } from "./image-upload-field"
import type { ConsoleImage } from "./image-upload-field"

export interface SingleImageFieldProps {
  value: ConsoleImage | null
  onChange: (value: ConsoleImage | null) => void
  disabled?: boolean
  className?: string
}

function toList(value: ConsoleImage | null): ConsoleImage[] {
  return value ? [value] : []
}

export function CoverField({ value, onChange, disabled, className }: SingleImageFieldProps) {
  const { t } = useT("host-page-builder")
  return (
    <ImageUploadField
      shape="cover"
      label={t("cover.add")}
      values={toList(value)}
      onChange={(next) => onChange(next[0] ?? null)}
      max={1}
      disabled={disabled}
      className={className}
    />
  )
}

export function LogoField({ value, onChange, disabled, className }: SingleImageFieldProps) {
  const { t } = useT("host-page-builder")
  return (
    <ImageUploadField
      shape="logo"
      label={t("logo.add")}
      values={toList(value)}
      onChange={(next) => onChange(next[0] ?? null)}
      max={1}
      disabled={disabled}
      className={className}
    />
  )
}

export interface GalleryFieldProps {
  values: readonly ConsoleImage[]
  onChange: (values: ConsoleImage[]) => void
  max?: number
  disabled?: boolean
  className?: string
}

export function GalleryField({
  values,
  onChange,
  max = 12,
  disabled,
  className,
}: GalleryFieldProps) {
  const { t } = useT("host-page-builder")
  return (
    <ImageUploadField
      shape="gallery"
      label={t("gallery.add")}
      values={values}
      onChange={onChange}
      max={max}
      disabled={disabled}
      className={className}
    />
  )
}
