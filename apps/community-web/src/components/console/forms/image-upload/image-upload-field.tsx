"use client"

import { ImagePlus, Loader2, TriangleAlert, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { DragEvent } from "react"
import { useApi } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { cn } from "@/lib/utils"
import { errorMessage } from "@/lib/error-messages"
import { releaseCaptured } from "@/lib/web-camera"
import {
  acceptDroppedImage,
  pickConsoleImage,
  uploadConsoleImage,
} from "@/features/host/upload"

import { ConsoleIconButton } from "../../button"

export interface ConsoleImage {
  mediaId: string
  url: string
}

export type ImageUploadShape = "cover" | "logo" | "gallery"

const SHAPE_CLASSES: Record<ImageUploadShape, string> = {
  cover: "aspect-[16/9] w-full",
  logo: "h-24 w-24",
  gallery: "h-24 w-24",
}

interface UploadSlot {
  key: string
  previewUrl: string
  state: "uploading" | "error"
  message?: string
}

export interface ImageUploadFieldProps {
  shape: ImageUploadShape
  values: readonly ConsoleImage[]
  onChange: (values: ConsoleImage[]) => void
  max?: number
  label: string
  disabled?: boolean
  className?: string
}

export function ImageUploadField({
  shape,
  values,
  onChange,
  max = shape === "gallery" ? 12 : 1,
  label,
  disabled,
  className,
}: ImageUploadFieldProps) {
  const { t } = useT("host-common")
  const api = useApi()
  const [slots, setSlots] = useState<UploadSlot[]>([])
  const [dragging, setDragging] = useState(false)
  const counter = useRef(0)
  const mounted = useRef(true)
  const valuesRef = useRef(values)
  valuesRef.current = values

  useEffect(
    () => () => {
      mounted.current = false
    },
    [],
  )

  const room = Math.max(0, max - values.length - slots.filter((s) => s.state === "uploading").length)

  const startUpload = useCallback(
    async (mediaUri: string, media: Parameters<typeof uploadConsoleImage>[0]["media"]) => {
      counter.current += 1
      const key = `upload-${counter.current}`
      setSlots((prev) => [...prev, { key, previewUrl: mediaUri, state: "uploading" }])
      try {
        const result = await uploadConsoleImage({ api, media })
        if (!mounted.current) return
        setSlots((prev) => prev.filter((slot) => slot.key !== key))
        onChange([...valuesRef.current, { mediaId: result.mediaId, url: mediaUri }])
      } catch (err) {
        if (!mounted.current) return
        setSlots((prev) =>
          prev.map((slot) =>
            slot.key === key
              ? {
                  ...slot,
                  state: "error",
                  message: errorMessage(err, {}, { fallback: t("upload.failed") }),
                }
              : slot,
          ),
        )
      }
    },
    [api, onChange, t],
  )

  const pick = useCallback(async () => {
    if (disabled || room <= 0) return
    const media = await pickConsoleImage()
    if (!media) return
    if (media.kind !== "image") {
      releaseCaptured(media.uri)
      return
    }
    void startUpload(media.uri, media)
  }, [disabled, room, startUpload])

  const onDrop = useCallback(
    async (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault()
      setDragging(false)
      if (disabled) return
      const files = Array.from(event.dataTransfer.files).slice(0, room)
      for (const file of files) {
        const media = await acceptDroppedImage(file)
        if (!media) continue
        if (media.kind !== "image") {
          releaseCaptured(media.uri)
          continue
        }
        void startUpload(media.uri, media)
      }
    },
    [disabled, room, startUpload],
  )

  const remove = (mediaId: string) => {
    const target = valuesRef.current.find((value) => value.mediaId === mediaId)
    if (target && target.url.startsWith("blob:")) releaseCaptured(target.url)
    onChange(valuesRef.current.filter((value) => value.mediaId !== mediaId))
  }

  return (
    <div className={cn("flex flex-col gap-token-2", className)}>
      <div className={cn("flex flex-wrap items-start gap-token-2")}>
        {values.map((value) => (
          <div key={value.mediaId} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value.url}
              alt=""
              className={cn(
                "rounded-sm border border-console-line object-cover",
                SHAPE_CLASSES[shape],
                shape === "cover" && "max-w-md",
              )}
            />
            <ConsoleIconButton
              label={t("upload.remove")}
              disabled={disabled}
              onClick={() => remove(value.mediaId)}
              className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-pill border border-console-line bg-console-surface text-console-ink-3 shadow-console-1"
            >
              <X aria-hidden className="h-3 w-3" />
            </ConsoleIconButton>
          </div>
        ))}
        {slots.map((slot) => (
          <div
            key={slot.key}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-sm border border-dashed",
              SHAPE_CLASSES[shape],
              shape === "cover" && "max-w-md",
              slot.state === "error"
                ? "border-console-bloom-strong/50 bg-console-bloom-soft"
                : "border-console-line bg-console-surface-alt",
            )}
          >
            {slot.state === "uploading" ? (
              <>
                <Loader2 aria-hidden className="h-4 w-4 animate-spin text-console-ink-2" />
                <span className="sr-only">{t("upload.in_progress")}</span>
              </>
            ) : (
              <>
                <TriangleAlert aria-hidden className="h-4 w-4 text-console-bloom-strong" />
                <span className="px-1 text-center text-token-12 font-semibold text-console-bloom-strong">
                  {slot.message ?? t("upload.failed")}
                </span>
                <button
                  type="button"
                  onClick={() => setSlots((prev) => prev.filter((s) => s.key !== slot.key))}
                  className="rounded-xs text-token-12 font-semibold text-console-bloom-strong underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-console-ring"
                >
                  {t("action.dismiss")}
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      {room > 0 ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => void pick()}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => void onDrop(event)}
          className={cn(
            "flex min-h-[88px] w-full max-w-md flex-col items-center justify-center gap-token-1 rounded-sm border border-dashed px-token-4 py-token-4 text-center transition-colors duration-d1 focus-visible:outline-none focus-visible:shadow-console-ring",
            dragging
              ? "border-console-accent bg-console-bloom-soft/50"
              : "border-console-line bg-console-surface-alt/50 hover:bg-console-surface-alt",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <ImagePlus aria-hidden className="h-5 w-5 text-console-ink-3" />
          <span className="text-token-13 font-semibold text-console-ink-2">{label}</span>
          <span className="text-token-12 text-console-ink-3">{t("upload.hint")}</span>
        </button>
      ) : null}
    </div>
  )
}
