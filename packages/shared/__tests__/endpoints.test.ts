import { describe, it, expect } from "vitest"
import { endpoints } from "../src/client/endpoints.js"
import { extractParams, fillPath } from "../src/client/client.js"

function requestShape(schema: unknown): Record<string, unknown> | null {
  let current = schema
  for (let depth = 0; depth < 10 && current !== null && current !== undefined; depth++) {
    const shape = (current as { shape?: Record<string, unknown> }).shape
    if (shape) return shape
    const def = (current as { _def?: { schema?: unknown; innerType?: unknown } })._def
    const inner = def?.schema ?? def?.innerType
    if (inner === undefined) return null
    current = inner
  }
  return null
}


const NEW_NAMES = [
  "completeCleanup",
  "claimEventSlot",
  "getEventHours",
  "getMyHoursEntries",
  "getPublicVolunteerHours",
  "issueServiceHoursCertificate",
  "listMyServiceHoursCertificates",
  "revokeServiceHoursCertificate",
  "verifyServiceHoursCertificate",
] as const

const NEW_MUTATIONS = [
  "completeCleanup",
  "claimEventSlot",
  "issueServiceHoursCertificate",
  "revokeServiceHoursCertificate",
] as const

describe("service-hours endpoint registry", () => {
  it("resolves all nine new endpoint names", () => {
    for (const name of NEW_NAMES) {
      const e = endpoints[name]
      expect(e, name).toBeDefined()
      expect(typeof e.path, name).toBe("string")
      expect(e.version, name).toBe("v1")
    }
  })

  it("keeps every METHOD + path pair unique across the whole registry", () => {
    const seen = new Map<string, string>()
    for (const name of Object.keys(endpoints)) {
      const e = endpoints[name as keyof typeof endpoints]
      const key = `${e.method} ${e.path}`
      expect(
        seen.get(key),
        `${key} is claimed by both ${seen.get(key)} and ${name}`,
      ).toBeUndefined()
      seen.set(key, name)
    }
  })

  it("shares /cleanups/:id/hours between logEventHours (POST) and getEventHours (GET)", () => {
    expect(endpoints.logEventHours.method).toBe("POST")
    expect(endpoints.logEventHours.path).toBe("/cleanups/:id/hours")
    expect(endpoints.logEventHours.csrf).toBe(true)
    expect(endpoints.getEventHours.method).toBe("GET")
    expect(endpoints.getEventHours.path).toBe("/cleanups/:id/hours")
    expect(endpoints.getEventHours.csrf).toBe(false)
    expect(endpoints.getEventHours.auth).toBe("required")
  })

  it("keeps the three /me/volunteer-hours paths distinct and non-shadowing", () => {
    const paths = [
      endpoints.getMyHours.path,
      endpoints.getMyHoursEntries.path,
      endpoints.listMyServiceHoursCertificates.path,
    ]
    expect(endpoints.getMyHours.path).toBe("/me/volunteer-hours")
    expect(endpoints.getMyHoursEntries.path).toBe("/me/volunteer-hours/entries")
    expect(endpoints.listMyServiceHoursCertificates.path).toBe("/me/volunteer-hours/certificates")
    expect(new Set(paths).size).toBe(3)
    for (const p of paths) expect(p).not.toMatch(/:[A-Za-z0-9_]+/)
    expect(endpoints.getMyHoursEntries.path.startsWith(`${endpoints.getMyHours.path}/`)).toBe(true)
    expect(
      endpoints.listMyServiceHoursCertificates.path.startsWith(`${endpoints.getMyHours.path}/`),
    ).toBe(true)
  })

  it("issues and lists certificates on one path split only by method", () => {
    expect(endpoints.issueServiceHoursCertificate.method).toBe("POST")
    expect(endpoints.listMyServiceHoursCertificates.method).toBe("GET")
    expect(endpoints.issueServiceHoursCertificate.path).toBe(
      endpoints.listMyServiceHoursCertificates.path,
    )
    expect(endpoints.listMyServiceHoursCertificates.request).toBeNull()
  })

  it("makes verifyServiceHoursCertificate public and csrf-free", () => {
    const e = endpoints.verifyServiceHoursCertificate
    expect(e.auth).toBe("public")
    expect(e.csrf).toBe(false)
    expect(e.method).toBe("GET")
    expect(e.path).toBe("/service-hours/verify/:code")
  })

  it("sets csrf on every new mutation and clears it on every new read", () => {
    const mutations = new Set<string>(NEW_MUTATIONS)
    for (const name of NEW_NAMES) {
      const e = endpoints[name]
      expect(e.csrf, name).toBe(mutations.has(name))
      if (mutations.has(name)) expect(e.method, name).not.toBe("GET")
      else expect(e.method, name).toBe("GET")
    }
  })

  it("keeps the public hours transcript readable signed-out", () => {
    const e = endpoints.getPublicVolunteerHours
    expect(e.method).toBe("GET")
    expect(e.path).toBe("/people/:id/volunteer-hours")
    expect(e.auth).toBe("optional")
  })

  it("makes listUserPosts optional-auth so a signed-out profile can render its posts tab", () => {
    expect(endpoints.listUserPosts.auth).toBe("optional")
  })

  it("marks completeCleanup and claimEventSlot as host/member mutations returning the CleanupDTO", () => {
    expect(endpoints.completeCleanup.method).toBe("POST")
    expect(endpoints.completeCleanup.path).toBe("/cleanups/:id/complete")
    expect(endpoints.completeCleanup.auth).toBe("required")
    expect(endpoints.claimEventSlot.method).toBe("PUT")
    expect(endpoints.claimEventSlot.path).toBe("/cleanups/:id/slot")
    expect(endpoints.claimEventSlot.auth).toBe("required")
    expect(endpoints.completeCleanup.response).toBe(endpoints.getCleanup.response)
    expect(endpoints.claimEventSlot.response).toBe(endpoints.getCleanup.response)
  })

  it("declares every :param of a request-carrying endpoint as a key on that request schema", () => {
    const KNOWN: string[] = []
    const offenders: string[] = []
    for (const name of Object.keys(endpoints)) {
      const e = endpoints[name as keyof typeof endpoints]
      if (e.request === null) continue
      const params = [...e.path.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1] as string)
      if (params.length === 0) continue
      const shape = requestShape(e.request)
      if (!shape) continue
      for (const p of params) {
        const ok = p in shape || (p === "id" && Object.keys(shape).some((k) => /Id$/.test(k)))
        if (!ok) offenders.push(`${name}: :${p}`)
      }
    }
    expect(offenders.sort()).toEqual(KNOWN)
    for (const name of NEW_NAMES)
      expect(
        KNOWN.some((k) => k.startsWith(`${name}:`)),
        name,
      ).toBe(false)
  })

  it("fills :code from the request body — the *Id fallback cannot rescue it", () => {
    const revoke = endpoints.revokeServiceHoursCertificate
    const input = { code: "A1B2C3D4E5F6" }
    const { params, consumedKeys } = extractParams(revoke.path, input)
    expect(params).toEqual({ code: "A1B2C3D4E5F6" })
    expect(consumedKeys.has("code")).toBe(true)
    expect(fillPath(revoke.path, params)).toBe(
      "/me/volunteer-hours/certificates/A1B2C3D4E5F6/revoke",
    )

    const { params: bad } = extractParams(revoke.path, { certificateId: "A1B2C3D4E5F6" })
    expect(bad).toEqual({})
    expect(() => fillPath(revoke.path, bad)).toThrow()
  })

  it("fills :id on each new id-carrying endpoint and omits it from the GET query", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000"
    for (const name of [
      "completeCleanup",
      "claimEventSlot",
      "getEventHours",
      "getPublicVolunteerHours",
    ] as const) {
      const e = endpoints[name]
      const { params, consumedKeys } = extractParams(e.path, { id: uuid })
      expect(params, name).toEqual({ id: uuid })
      expect(consumedKeys.has("id"), name).toBe(true)
      expect(fillPath(e.path, params), name).toContain(uuid)
    }
  })

  it("leaves the param-free new endpoints with nothing to fill", () => {
    for (const name of [
      "getMyHoursEntries",
      "issueServiceHoursCertificate",
      "listMyServiceHoursCertificates",
    ] as const) {
      expect(endpoints[name].path, name).not.toMatch(/:[A-Za-z0-9_]+/)
    }
  })
})
