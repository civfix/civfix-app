import { test } from "node:test"
import assert from "node:assert/strict"
import { openTicketedSocket, type WsTransportDeps } from "./wsTransport.ts"

const BEARER = "session-bearer-0123456789"

function harness(overrides: Partial<WsTransportDeps<string>> = {}) {
  const urls: string[] = []
  const deps: WsTransportDeps<string> = {
    apiUrl: "https://api.civfix.org",
    readToken: async () => BEARER,
    mintTicket: async () => "tkt-1",
    connect: (url) => {
      urls.push(url)
      return `socket:${url}`
    },
    ...overrides,
  }
  return { deps, urls }
}

test("a minted ticket is the only handshake credential in the socket URL", async () => {
  const { deps, urls } = harness()
  const opened = await openTicketedSocket(deps)
  assert.deepEqual(urls, ["wss://api.civfix.org/ws?ticket=tkt-1"])
  assert.equal(opened?.authKey, BEARER)
})

test("the http API base maps to a ws:// endpoint", async () => {
  const { deps, urls } = harness({ apiUrl: "http://localhost:8080/" })
  await openTicketedSocket(deps)
  assert.deepEqual(urls, ["ws://localhost:8080/ws?ticket=tkt-1"])
})

test("a failed ticket mint never puts the bearer in the socket URL and opens nothing", async () => {
  const { deps, urls } = harness({
    mintTicket: async () => {
      throw new Error("ticket endpoint down")
    },
  })
  const opened = await openTicketedSocket(deps)
  assert.equal(opened, null)
  assert.ok(urls.every((url) => !url.includes(BEARER) && !url.includes("token=")))
  assert.deepEqual(urls, [])
})

test("an empty ticket response is treated as unavailable, not as a reason to send the bearer", async () => {
  const { deps, urls } = harness({ mintTicket: async () => null })
  assert.equal(await openTicketedSocket(deps), null)
  assert.deepEqual(urls, [])
})

test("no readable bearer means no ticket request and no socket", async () => {
  let minted = 0
  const { deps, urls } = harness({
    readToken: async () => null,
    mintTicket: async () => {
      minted += 1
      return "tkt-1"
    },
  })
  assert.equal(await openTicketedSocket(deps), null)
  assert.equal(minted, 0)
  assert.deepEqual(urls, [])
})
