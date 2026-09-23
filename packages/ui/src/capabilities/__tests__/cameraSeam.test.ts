import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { makeFakeCapabilities } from "../fakes"

/** Read as text because this package has no renderer to assert the shape with. */
const typesSource = readFileSync(new URL("../types.ts", import.meta.url), "utf8")

describe("the camera capability's renderable viewfinder slot", () => {
  it("is OPTIONAL, so hosts with no embeddable camera still satisfy the seam", () => {
    // Web (which keeps the tap-to-open file input) and the fakes have no embeddable camera surface, so
    // a required slot would break both at compile time.
    expect(typesSource).toContain("Viewfinder?: ComponentType<CameraViewfinderProps>")
  })

  it("is absent from the fake bundle - which is what every shared consumer must null-check against", () => {
    // The runtime check alone reads `undefined` for an undeclared or misspelled field too, so it is paired
    // with the proof that the field exists on the interface.
    expect(typesSource).toContain("Viewfinder?: ComponentType<CameraViewfinderProps>")
    expect(makeFakeCapabilities().camera.Viewfinder).toBeUndefined()
  })

  it("hands the host the lifecycle inputs the embedded surface needs", () => {
    // `active` false must release the capture session without unmounting, or iOS holds the camera on the
    // Report tab.
    expect(typesSource).toContain("active: boolean")
    expect(typesSource).toContain("onCaptured(media: CapturedMedia): void")
  })

  it("makes the drag-and-drop `acceptFile` seam OPTIONAL and absent from the fakes", () => {
    // Only the web host implements drops, and the wizard shows the drop affordance only when the method
    // exists: requiring it would break native, and a fake one would promise a drop that lands nowhere.
    expect(typesSource).toContain("acceptFile?(item: unknown): Promise<CapturedMedia | null>")
    expect(makeFakeCapabilities().camera.acceptFile).toBeUndefined()
  })

  it("makes `onCancel` OPTIONAL, because the embedded surface IS the capture step", () => {
    // Its presence signals the presentation: absent means the surface is the capture step and draws no
    // exit; present means a dismissable full-screen route that may draw one. Requiring it brings back a
    // second close button stacked over the surface's own.
    expect(typesSource).toContain("onCancel?(): void")
  })
})
