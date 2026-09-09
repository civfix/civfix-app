/**
 * In-memory / no-op fake for the data seam, for unit tests, the primitives gallery, and web previews
 * that have no real backend. Mirrors the platform-capability fakes (../capabilities/fakes): deterministic
 * state, no I/O. `makeFakeDataContext()` assembles a complete DataContextValue suitable to pass straight
 * into <ApiProvider value={...}>.
 *
 * Defaults to SIGNED OUT (isAuthenticated:false, user:null, isPending:false). Override via options to
 * render a body in its signed-in or still-resolving state.
 */
import type { ApiClient } from "@civfix/shared/client"
import type {
  PostDTO,
  PostRefDTO,
  PersonDTO,
  LinkedEventRef,
  LinkedReportRef,
  PostComposeInput,
  FeedPageDTO,
} from "@civfix/shared"
import type { AuthState, ChatSocketLike, DataContextValue } from "./types"

/**
 * A stand-in ApiClient whose every endpoint method rejects with a clear "fake" error, EXCEPT the social-
 * feed post endpoints, which return believable seed data so the feed / thread / profile-posts bodies
 * render under `makeFakeDataContext` with no backend. The real ApiClient is a large generated
 * method-per-endpoint type; a body under test that actually calls an un-faked method should either
 * inject its own api (see `api` option) or stub the specific method. Built via a Proxy so any method name
 * resolves, with no per-method boilerplate to drift from the generated surface.
 */
export function makeFakeApiClient(): ApiClient {
  const postMethods = makeFakePostApi()
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return undefined // not a thenable; avoid await-unwrapping the proxy itself
        const key = String(prop)
        if (key in postMethods) return (postMethods as unknown as Record<string, unknown>)[key]
        return (..._args: unknown[]): Promise<never> =>
          Promise.reject(
            new Error(
              `makeFakeApiClient: no real backend. Method "${key}" was called; inject a real ` +
                "api or stub this method in the test/gallery harness.",
            ),
          )
      },
    },
  ) as ApiClient
}

// ---------------------------------------------------------------------------
// Fake social-feed data (seed posts + the post client methods)
// ---------------------------------------------------------------------------

/** ISO timestamp `days` from now (negative = the past). */
function fakeIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString()
}

function fakePerson(
  id: string,
  name: string,
  handle: string,
  extra: Partial<PersonDTO> = {},
): PersonDTO {
  return {
    id,
    name,
    handle,
    bio: null,
    avatar: null,
    avatarUrl: null,
    followers: 34,
    following: 21,
    isFollowing: false,
    ...extra,
  }
}

const FAKE_VIEWER = fakePerson("me", "You", "you")
const FAKE_MAYA = fakePerson("u_maya", "Maya Ortiz", "maya", { verified: true, followers: 812 })
const FAKE_LUIS = fakePerson("u_luis", "Luis Park", "luisp", { followers: 128 })
const FAKE_DANA = fakePerson("u_dana", "Dana Reyes", "danar", { followers: 57 })

const FAKE_EVENT: LinkedEventRef = {
  id: "evt_lake",
  title: "Echo Park Lake Cleanup",
  eventKind: "cleanup",
  status: "upcoming",
  scheduledAt: fakeIso(3),
  lat: 34.0722,
  lng: -118.2601,
  going: 14,
  organizer: FAKE_MAYA,
  linkedAt: fakeIso(-1),
}

const FAKE_REPORT: LinkedReportRef = {
  id: "rep_graffiti",
  category: "graffiti",
  title: "Graffiti on the Sunset underpass",
  status: "resolved",
  lat: 34.0908,
  lng: -118.2812,
  addr: "1200 Sunset Blvd",
  thumbUrl: null,
  linkedAt: fakeIso(-2),
}

function fakeCounts(likes: number, reposts: number, replies: number, saves: number): PostDTO["counts"] {
  return { likes, reposts, replies, saves }
}

function fakeViewer(
  liked = false,
  reposted = false,
  saved = false,
): PostDTO["viewer"] {
  return { liked, reposted, saved }
}

/** A compact preview of another post (a repost target / reply parent). */
function fakeRef(post: PostDTO): PostRefDTO {
  return {
    id: post.id,
    author: post.author,
    kind: post.kind,
    // The ref carries the referenced post's own media, so a quote card can show what it quotes.
    media: post.media,
    excerpt: (post.body ?? "").slice(0, 140),
    createdAt: post.createdAt,
  }
}

// 1. Plain text post.
const POST_TEXT: PostDTO = {
  id: "post_text",
  author: FAKE_LUIS,
  kind: "post",
  body: "Picked up three bags along the river this morning. Small dent, but it adds up. Who's in next weekend?",
  createdAt: fakeIso(-0.2),
  counts: fakeCounts(8, 1, 2, 3),
  viewer: fakeViewer(),
  media: [],
  mentions: [],
  event: null,
  report: null,
  repostOf: null,
  replyToId: null,
  threadRootId: null,
}

// 2. Post with an attached event (LinkedEventRef).
const POST_EVENT: PostDTO = {
  id: "post_event",
  author: FAKE_MAYA,
  kind: "post",
  body: "Hosting a lake cleanup this Saturday - gloves and bags provided. Bring a friend!",
  createdAt: fakeIso(-0.5),
  counts: fakeCounts(23, 5, 4, 11),
  viewer: fakeViewer(false, false, true),
  media: [],
  mentions: [],
  event: FAKE_EVENT,
  report: null,
  repostOf: null,
  replyToId: null,
  threadRootId: null,
}

// 3. A repost (kind:"repost" + repostOf preview) of the plain text post.
const POST_REPOST: PostDTO = {
  id: "post_repost",
  author: FAKE_DANA,
  kind: "repost",
  body: null,
  createdAt: fakeIso(-0.1),
  counts: fakeCounts(0, 0, 0, 0),
  viewer: fakeViewer(),
  media: [],
  mentions: [],
  event: null,
  report: null,
  repostOf: fakeRef(POST_TEXT),
  replyToId: null,
  threadRootId: null,
}

// 4. A reply to the plain text post.
const POST_REPLY: PostDTO = {
  id: "post_reply",
  author: FAKE_DANA,
  kind: "reply",
  body: "Count me in - I can bring extra gloves for a few people.",
  createdAt: fakeIso(-0.15),
  counts: fakeCounts(2, 0, 0, 0),
  viewer: fakeViewer(true),
  media: [],
  mentions: [{ id: FAKE_LUIS.id, handle: FAKE_LUIS.handle ?? "luisp", displayName: FAKE_LUIS.name }],
  event: null,
  report: null,
  repostOf: null,
  replyToId: POST_TEXT.id,
  threadRootId: POST_TEXT.id,
}

// 5. A "fix confirmed" post with an attached report (LinkedReportRef).
const POST_FIX: PostDTO = {
  id: "post_fix",
  author: FAKE_MAYA,
  kind: "post",
  body: "Fix confirmed - the Sunset underpass graffiti is gone. Thanks to everyone who reported it!",
  createdAt: fakeIso(-1),
  counts: fakeCounts(41, 7, 6, 9),
  viewer: fakeViewer(false, false, true),
  media: [],
  mentions: [],
  event: null,
  report: FAKE_REPORT,
  repostOf: null,
  replyToId: null,
  threadRootId: null,
}

/** All seed posts. Timeline order (newest first) for the home feed. */
const SEED_POSTS: PostDTO[] = [POST_REPOST, POST_EVENT, POST_TEXT, POST_REPLY, POST_FIX]

function findSeed(id: string): PostDTO | undefined {
  return SEED_POSTS.find((p) => p.id === id)
}

function page(items: PostDTO[]): FeedPageDTO {
  return { items, nextCursor: null }
}

/** Return the seed post with the given field toggled on/off + its paired count nudged (fake echo). */
function toggledSeed(
  id: string,
  field: "liked" | "reposted" | "saved",
  next: boolean,
): PostDTO {
  const base = findSeed(id) ?? POST_TEXT
  const countKey = field === "liked" ? "likes" : field === "reposted" ? "reposts" : "saves"
  const delta = next ? 1 : -1
  return {
    ...base,
    id,
    viewer: { ...base.viewer, [field]: next },
    counts: { ...base.counts, [countKey]: Math.max(0, base.counts[countKey] + delta) },
  }
}

let fakePostSeq = 0

/** A pagination query, optionally carrying a path `:id` (the client reads it at runtime, not from the schema). */
type FakePageQuery = { id?: string; cursor?: string; limit?: number }

/**
 * The fake post client surface. Typed locally (NOT `Pick<ApiClient>`) because the generated client's
 * list-method inputs are the pagination QUERY only - the `:id` path param is read from the input at
 * runtime and is absent from the typed input - so these fakes accept `{ id, cursor, limit }` to serve
 * per-post / per-user reads. The Proxy in `makeFakeApiClient` casts the whole thing to `ApiClient`.
 */
export interface FakePostApi {
  homeFeed: (query: { filter?: "all" | "events" | "fixes"; cursor?: string; limit?: number }) => Promise<FeedPageDTO>
  getPost: (args: { id: string }) => Promise<PostDTO>
  listReplies: (args: FakePageQuery) => Promise<FeedPageDTO>
  listUserPosts: (args: FakePageQuery) => Promise<FeedPageDTO>
  listSaves: (args?: FakePageQuery) => Promise<FeedPageDTO>
  createPost: (input: PostComposeInput) => Promise<PostDTO>
  deletePost: (args: { id: string }) => Promise<{ ok: true }>
  likePost: (args: { id: string }) => Promise<PostDTO>
  unlikePost: (args: { id: string }) => Promise<PostDTO>
  savePost: (args: { id: string }) => Promise<PostDTO>
  unsavePost: (args: { id: string }) => Promise<PostDTO>
  repostPost: (args: { id: string }) => Promise<PostDTO>
  unrepostPost: (args: { id: string }) => Promise<PostDTO>
}

/**
 * The fake implementations of the social-feed post client methods. Returned as a plain record and mixed
 * into `makeFakeApiClient`'s Proxy so `makeFakeDataContext()` serves the feed / thread / saves / profile
 * bodies believable data with no backend. Each list method returns a single page with `nextCursor: null`.
 */
export function makeFakePostApi(): FakePostApi {
  return {
    homeFeed: async (query) => {
      const filter = query?.filter ?? "all"
      const top = SEED_POSTS.filter((p) => p.kind !== "reply")
      if (filter === "events") return page(top.filter((p) => p.event))
      if (filter === "fixes") return page(top.filter((p) => p.report))
      return page(top)
    },
    getPost: async ({ id }) => findSeed(id) ?? POST_TEXT,
    listReplies: async ({ id }) => page(SEED_POSTS.filter((p) => p.replyToId === id)),
    listUserPosts: async ({ id }) =>
      page(SEED_POSTS.filter((p) => p.author.id === id && p.kind !== "reply")),
    listSaves: async () => page(SEED_POSTS.filter((p) => p.viewer.saved)),
    createPost: async (input: PostComposeInput) => ({
      id: `post_new_${fakePostSeq++}`,
      author: FAKE_VIEWER,
      kind: input.kind ?? "post",
      body: input.body ?? null,
      createdAt: new Date().toISOString(),
      counts: fakeCounts(0, 0, 0, 0),
      viewer: fakeViewer(),
      media: [],
      mentions: [],
      event: input.eventId ? FAKE_EVENT : null,
      report: input.reportId ? FAKE_REPORT : null,
      repostOf: input.repostOfId ? fakeRef(findSeed(input.repostOfId) ?? POST_TEXT) : null,
      replyToId: input.replyToId ?? null,
      threadRootId: input.replyToId ?? null,
    }),
    deletePost: async () => ({ ok: true as const }),
    likePost: async ({ id }) => toggledSeed(id, "liked", true),
    unlikePost: async ({ id }) => toggledSeed(id, "liked", false),
    savePost: async ({ id }) => toggledSeed(id, "saved", true),
    unsavePost: async ({ id }) => toggledSeed(id, "saved", false),
    repostPost: async ({ id }) => toggledSeed(id, "reposted", true),
    unrepostPost: async ({ id }) => toggledSeed(id, "reposted", false),
  }
}

/**
 * A NO-OP chat socket for tests / the gallery: never connects, reports "closed", and fans no frames. A
 * ConversationBody rendered with this shows whatever history the (fake) React Query cache holds plus the
 * composer; there is no live send/receive (that needs a real backend). All methods are inert; `subscribe`
 * / `onStatus` return unsubscribe fns (`onStatus` replays "closed" once, matching the real sockets).
 */
export function makeFakeChatSocket(): ChatSocketLike {
  return {
    retain: () => {},
    release: () => {},
    join: () => {},
    leave: () => {},
    send: () => {},
    markRoomRejected: () => {},
    subscribe: () => () => {},
    onStatus: (handler) => {
      handler("closed")
      return () => {}
    },
    getStatus: () => "closed",
  }
}

export interface FakeDataContextOptions {
  /** The auth state the fake `useAuthState` hook returns. Defaults to signed out. */
  auth?: Partial<AuthState>
  /** Inject a real/stub ApiClient (e.g. a test double). Defaults to the rejecting fake. */
  api?: ApiClient
  /** Override requireAuth. Default RUNS the action (treats the viewer as signed in) so a gallery body works. */
  requireAuth?: DataContextValue["requireAuth"]
  /** Override logout. Default is a no-op. */
  logout?: DataContextValue["logout"]
  /** Override the chat socket. Default is the inert no-op socket (no live send/receive). */
  chatSocket?: ChatSocketLike
  /**
   * Override the anti-bot token minter. Default is ABSENT, matching a host that injects none - so a
   * gallery renders the capability-gated guest-RSVP path in its OFF state unless a test opts in.
   */
  getTurnstileToken?: DataContextValue["getTurnstileToken"]
  /**
   * Override the publishable CARTO basemap api key. Default is ABSENT, matching a host that injects
   * none - the shared maps then build keyless (watermarked) tile URLs.
   */
  cartoApiKey?: DataContextValue["cartoApiKey"]
}

/** The signed-out default auth state. */
const SIGNED_OUT: AuthState = { isAuthenticated: false, user: null, isPending: false }

/**
 * Assemble a complete fake DataContextValue for a provider. The auth state is fixed (not reactive) -
 * the fake `useAuthState` hook just returns the configured value on every call, which is all a test or
 * a static gallery render needs.
 */
export function makeFakeDataContext(options: FakeDataContextOptions = {}): DataContextValue {
  const auth: AuthState = { ...SIGNED_OUT, ...options.auth }
  return {
    api: options.api ?? makeFakeApiClient(),
    useAuthState: () => auth,
    // Default: run the action straight through (the gallery treats the viewer as able to act).
    requireAuth: options.requireAuth ?? ((action: () => void) => action()),
    logout: options.logout ?? (() => {}),
    chatSocket: options.chatSocket ?? makeFakeChatSocket(),
    ...(options.getTurnstileToken === undefined
      ? {}
      : { getTurnstileToken: options.getTurnstileToken }),
    ...(options.cartoApiKey === undefined ? {} : { cartoApiKey: options.cartoApiKey }),
  }
}
