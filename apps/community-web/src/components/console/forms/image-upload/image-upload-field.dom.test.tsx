import { useState } from "react"
import { act, cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

const upload = vi.hoisted(() => ({
  uploadConsoleImage: vi.fn(),
  acceptDroppedImage: vi.fn(),
  pickConsoleImage: vi.fn(),
}))
vi.mock("@/features/host/upload", () => upload)

const camera = vi.hoisted(() => ({ releaseCaptured: vi.fn() }))
vi.mock("@/lib/web-camera", () => camera)

import { renderConsole } from "../../__testing__/harness"
import { ImageUploadField } from "./image-upload-field"
import type { ConsoleImage } from "./image-upload-field"

interface Deferred {
  resolve: (value: { mediaId: string }) => void
  reject: (err: unknown) => void
  signal: AbortSignal | undefined
}

let pending: Deferred[] = []

beforeEach(() => {
  pending = []
  upload.acceptDroppedImage.mockImplementation(async (file: File) => ({
    kind: "image",
    uri: `blob:${file.name}`,
  }))
  upload.uploadConsoleImage.mockImplementation(
    (input: { signal?: AbortSignal }) =>
      new Promise((resolve, reject) => {
        pending.push({ resolve, reject, signal: input.signal })
      }),
  )
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function Gallery() {
  const [values, setValues] = useState<ConsoleImage[]>([])
  return (
    <>
      <ImageUploadField shape="gallery" values={values} onChange={setValues} label="Add photos" />
      <output aria-label="count">{values.length}</output>
    </>
  )
}

async function drop(names: string[]) {
  const files = names.map((name) => new File(["x"], name, { type: "image/png" }))
  await act(async () => {
    fireEvent.drop(screen.getByRole("button", { name: /Add photos/ }), {
      dataTransfer: { files },
    })
  })
}

describe("ImageUploadField", () => {
  it("keeps both images when two uploads finish before a re-render", async () => {
    renderConsole(<Gallery />)
    await drop(["a.png", "b.png"])
    expect(pending).toHaveLength(2)

    await act(async () => {
      pending[0]?.resolve({ mediaId: "m1" })
      pending[1]?.resolve({ mediaId: "m2" })
    })

    expect(screen.getByLabelText("count").textContent).toBe("2")
  })

  it("releases the preview of a failed upload when it is dismissed", async () => {
    renderConsole(<Gallery />)
    await drop(["a.png"])
    await act(async () => {
      pending[0]?.reject(new Error("boom"))
    })

    fireEvent.click(screen.getByRole("button", { name: "action.dismiss" }))
    expect(camera.releaseCaptured).toHaveBeenCalledWith("blob:a.png")
  })

  it("aborts an in-flight upload and releases its preview on unmount", async () => {
    const view = renderConsole(<Gallery />)
    await drop(["a.png"])
    const signal = pending[0]?.signal
    expect(signal?.aborted).toBe(false)

    view.unmount()
    expect(signal?.aborted).toBe(true)
    expect(camera.releaseCaptured).toHaveBeenCalledWith("blob:a.png")
  })

  it("gives the remove control a 24px target", async () => {
    renderConsole(<Gallery />)
    await drop(["a.png"])
    await act(async () => {
      pending[0]?.resolve({ mediaId: "m1" })
    })
    const remove = screen.getByRole("button", { name: "upload.remove" })
    expect(remove.className).toMatch(/\bh-6\b/)
    expect(remove.className).toMatch(/\bw-6\b/)
  })
})
