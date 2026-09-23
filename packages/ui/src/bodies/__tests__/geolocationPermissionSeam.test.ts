import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { makeFakeCapabilities } from "../../capabilities/fakes"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const capabilityTypes = strip(read("../../capabilities/types.ts"))
const capabilityFakes = strip(read("../../capabilities/fakes/index.ts"))
const locationHook = strip(read("../../data/hooks/location.ts"))
const reportFlow = strip(read("../ReportFlowBody.tsx"))
const addressSearch = strip(read("../AddressSearch.tsx"))
const createCleanup = strip(read("../CreateCleanupBody.tsx"))

const SOURCE_EXT = /\.tsx?$/
const isSource = (name: string) => SOURCE_EXT.test(name) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx")

function sourceFiles(dirUrl: string): string[] {
  const root = fileURLToPath(new URL(dirUrl, import.meta.url))
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== "__tests__") walk(full)
      } else if (isSource(entry.name)) {
        out.push(full)
      }
    }
  }
  walk(root)
  return out
}

const sharedReaderSources = [...sourceFiles("../../bodies"), ...sourceFiles("../../data")]

describe("the geolocation capability's permission seam", () => {
  it("declares requestPermission as OPTIONAL, so a host that prompts implicitly still satisfies it", () => {
    expect(capabilityTypes).toContain("requestPermission?(): Promise<boolean>")
  })

  it("is implemented by the fake, which reports the permission as not granted", async () => {
    const geo = makeFakeCapabilities().geolocation
    expect(typeof geo.requestPermission).toBe("function")
    expect(capabilityFakes).toContain("requestPermission(): Promise<boolean>")
    await expect(geo.requestPermission?.()).resolves.toBe(false)
  })
})

describe("every shared reader of the geolocation seam is PASSIVE", () => {
  it("finds the reader sources it is meant to be scanning", () => {
    expect(sharedReaderSources.length).toBeGreaterThan(50)
    expect(sharedReaderSources.some((f) => f.endsWith("/data/hooks/location.ts"))).toBe(true)
    expect(sharedReaderSources.some((f) => f.endsWith("/bodies/ReportFlowBody.tsx"))).toBe(true)
  })

  it("never requests the OS permission anywhere under bodies/ or data/ - only the host asks", () => {
    const requesters = sharedReaderSources.filter((f) => strip(readFileSync(f, "utf8")).includes("requestPermission"))
    expect(requesters).toEqual([])
  })

  it("reads the injected fix directly, so the guard above is not vacuous", () => {
    expect(locationHook).toContain("geo.getCurrentPosition()")
    expect(reportFlow).toContain("geo.getCurrentPosition()")
    expect(addressSearch).toContain("geo.getCurrentPosition()")
    expect(createCleanup).toContain("useUserLocation()")
  })

  it("keeps the passive readers' denial fallback intact - a rejected fix degrades to the API's approximate location", () => {
    expect(locationHook).toContain("await withTimeout(geo.getCurrentPosition(), DEVICE_FIX_TIMEOUT_MS)")
    expect(reportFlow).toContain("await withTimeout(geo.getCurrentPosition(), DEVICE_FIX_TIMEOUT_MS)")
    expect(addressSearch).toContain("await settleWithin(geo.getCurrentPosition(), PROXIMITY_FIX_TIMEOUT_MS)")
    expect(locationHook).toContain("fetchApproximateLocation(api, qc)")
    expect(reportFlow).toContain("fetchApproximateLocation(api, qc)")
    expect(addressSearch).toContain("fetchApproximateLocation(api, qc)")
    expect(createCleanup).toContain("useUserLocation()")
  })
})
