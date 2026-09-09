import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { makeFakeCapabilities } from "../fakes"

/** The seam's source, for the shape claims this package has no renderer to assert. */
const typesSource = readFileSync(new URL("../types.ts", import.meta.url), "utf8")

describe("the camera capability's renderable viewfinder slot", () => {
  it("is OPTIONAL, so hosts with no embeddable camera still satisfy the seam", () => {
    // Web has no embeddable camera surface (it keeps the tap-to-open <input type=file capture>), and the
    // fakes have none either. Making the slot REQUIRED would break both hosts' bundles at compile time -
    // this assertion is the standing reason it is a `?`.
    expect(typesSource).toContain("Viewfinder?: ComponentType<CameraViewfinderProps>")
  })

  it("is absent from the fake bundle - which is what every shared consumer must null-check against", () => {
    // A bare `.camera.Viewfinder` runtime check can't tell "the field isn't declared" from "the field
    // IS declared, optional, and the fake correctly leaves it unimplemented" - `undefined` is what JS
    // returns for both (including a typo'd property name). Pairing it with the source-text check below
    // (the field must actually exist on the interface) is what makes this a real regression guard.
    expect(typesSource).toContain("Viewfinder?: ComponentType<CameraViewfinderProps>")
    expect(makeFakeCapabilities().camera.Viewfinder).toBeUndefined()
  })

  it("hands the host the lifecycle inputs the embedded surface needs", () => {
    // `active` is the session gate: false must PAUSE/RELEASE the capture session WITHOUT unmounting, or
    // iOS holds the camera on the Report tab. `onCaptured` is the surface's exit on the embedded path.
    expect(typesSource).toContain("active: boolean")
    expect(typesSource).toContain("onCaptured(media: CapturedMedia): void")
  })

  it("makes the drag-and-drop `acceptFile` seam OPTIONAL and absent from the fakes", () => {
    // Dropping a file is a desktop-browser idiom: only the web host can adopt one, and only it implements
    // this. The wizard gates the whole affordance - ring AND caption - on the method being present, so a
    // host without it shows no drop promise at all. Requiring it would break native's bundle; declaring it
    // on the fakes would put a caption on the dev gallery for a drop that lands nowhere.
    expect(typesSource).toContain("acceptFile?(item: unknown): Promise<CapturedMedia | null>")
    expect(makeFakeCapabilities().camera.acceptFile).toBeUndefined()
  })

  it("makes `onCancel` OPTIONAL, because the embedded surface IS the capture step", () => {
    // It used to be required, and the shared wizard drew its OWN close chip on top of the injected surface
    // "so an exit always exists" - while the mobile surface drew one too, 4pt away. Reporters saw two
    // stacked X buttons, and tapping either dropped them onto the cream web-shaped capture card the
    // embedded camera exists to replace. There is nothing to back out TO on that step, so the prop is now
    // the SIGNAL for which presentation the surface is in: absent means "you are the screen, draw no
    // exit"; present means a dismissable presentation (mobile's imperative full-screen /report/camera
    // route) that may draw one. Making it required again would re-open the whole defect.
    expect(typesSource).toContain("onCancel?(): void")
  })
})
