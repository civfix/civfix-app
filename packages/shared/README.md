# @civfix/shared

The contract package for the civfix civic-tech platform. It is the single source of truth shared by
the backend, the admin dashboard, the web app and the mobile app. It contains no app code and no
vendor SDKs: only Zod schemas, inferred TypeScript types, vendor-neutral interfaces, dependency-free
in-memory fakes, design tokens, and a typed API client.

The only runtime dependency is `zod`. The package builds to ESM, CJS, and `.d.ts` via tsup, so it is
consumable from Next.js (web), Metro (React Native), and Node.

> **This is one of the two packages in the `civfix-app` monorepo**
> (`pnpm-workspace.yaml` -> `packages: ["apps/*", "packages/*"]`): this package,
> `packages/shared` = **`@civfix/shared`** (the contract; React-free), and a sibling
> `packages/ui` = **`@civfix/ui`** (the shared React Native UI rendered on web via
> react-native-web; private, consumed only by the two apps in this repo). `@civfix/ui` depends on
> `@civfix/shared`; the contract knows nothing about the UI, and the backend MUST NEVER depend on
> `@civfix/ui`. See [`packages/ui/README.md`](../ui/README.md) for the UI architecture.

## Consumption

Inside this repo, `apps/community-web` and `apps/community-mobile` take it as `"@civfix/shared":
"workspace:*"`. Consumers resolve its `exports` from the BUILT `dist` (gitignored), so it must be
built before anything can resolve it; turbo's `^build` handles that for every root task, and the
mobile app's `postinstall` runs `pnpm --filter @civfix/shared build` so EAS builders get one too.

Outside this repo (`civfix-backend`'s `services/api` + `services/media-worker`, `civfix-admin`, the
gov plane) it is installed from the **private Verdaccio registry at `https://repo.civfix.org`**
(scope `@civfix`, anonymous read, authenticated publish) as a normal npm dependency:

1. Scope `@civfix` to the registry in that repo's root `.npmrc`:

   ```
   @civfix:registry=https://repo.civfix.org/
   ```

2. Depend on a published version in its `package.json` (the registry allows anonymous read, so
   `pnpm install` needs no credentials):

   ```json
   {
     "dependencies": {
       "@civfix/shared": "^0.41.0"
     }
   }
   ```

The published tarball already contains the built `dist`, so those consumers do not build the
contract.

Consumers import either everything from the root or only what they need from a subpath:

```ts
import { ReportDTO, CreateReportRequestSchema, AppError } from "@civfix/shared"
import { tokens, categoryColor } from "@civfix/shared/tokens"
import type { Storage, Mailer } from "@civfix/shared/interfaces"
import { FakeStorage, FakeMailer } from "@civfix/shared/fakes"
import { createApiClient } from "@civfix/shared/client"
```

## Exported surface

| Entry         | Import specifier            | Contents                                                                                                                                                                       |
| ------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Root barrel   | `@civfix/shared`            | All schemas + inferred types, entity/domain types, error taxonomy, WS frame schemas, roles, geo helpers, and convenience re-exports of every subpath below.                    |
| Design tokens | `@civfix/shared/tokens`     | `tokens` const plus named scale exports (`color`, `fontSize`, ...), `categoryColor`, `CategoryColorKey`, `cleanupColor`, `colorSchemes`, `qrInk`/`qrPaper`.                    |
| Interfaces    | `@civfix/shared/interfaces` | The 11 vendor-neutral interfaces (types only): Storage, Mailer, SmsSender, InboundMail, Geocoder, ChatService, UserChannel, PushSender, RoutingProvider, AbuseChecks, Jobs, and their supporting types. |
| Fakes         | `@civfix/shared/fakes`      | A dependency-free in-memory implementation of each interface for unit tests and credential-free boot.                                                                          |
| Client        | `@civfix/shared/client`     | `endpoints` registry and `createApiClient` typed client factory.                                                                                                               |
| Avatar        | `@civfix/shared/avatar`     | Deterministic avatar pair helpers.                                                                                                                                             |
| Datetime      | `@civfix/shared/datetime`   | Framework-free date/time formatting and relative-time helpers.                                                                                                                 |
| Geocode       | `@civfix/shared/geocode`    | Address/coordinate normalization helpers shared by client and server.                                                                                                          |
| Chat          | `@civfix/shared/chat`       | Chat message merging, ordering and system-message helpers.                                                                                                                     |
| WS            | `@civfix/shared/ws`         | WebSocket frame schemas and the reconnect backoff policy.                                                                                                                      |
| Host          | `@civfix/shared/host`       | Host-platform pure logic: the capability matrix, k-anonymity suppression, the `derive` read-model selectors, grapheme helpers, broadcast rendering + link inspection, `GUEST_RSVP_TURNSTILE_ACTION`, and the shared safe-URL predicate. |
| Markdown      | `@civfix/shared/markdown`   | The constrained markdown SUBSET parser and its AST, `markdownToPlainText`, and the `isSafeHttpsUrl`/`isSafeMarkdownHref` link predicate.                                        |
| ICS           | `@civfix/shared/ics`        | `buildIcs` (RFC 5545, UTC stamps) and `eventIcsUid`, the one calendar identity every surface builds for an event.                                                               |
| Legal         | `@civfix/shared/legal`      | The legal document set (terms, privacy, ...) with each document's version, effective date, URL and SHA-256.                                                                   |
| Chip contrast | `@civfix/shared/chip-contrast` | The WCAG 2.x contrast helpers behind the chip inks.                                                                                                                         |

## Schemas

Schemas live under `src/schemas` grouped by domain (one file or folder per domain, e.g. `auth`,
`reports`, `cleanups`, `chat`, `posts`, `admin/`, `host/`) with shared primitives and the canonical
taxonomy in `common`. Cross-domain entity DTOs (Person, Report, Cleanup, ChatMessage, Media) live in
`schemas/entities` to break what would otherwise be an import cycle; the domain files re-export them.

Naming convention:

- `XxxRequest` / `XxxResponse` for endpoint payloads.
- `XxxDTO` for entities.
- Every schema is exported alongside its inferred type: `export type Foo = z.infer<typeof FooSchema>`.

## Interfaces and fakes

Every external dependency sits behind an interface in `src/interfaces`. The matching fake in
`src/fakes` is deterministic and uses no I/O, so the backend can boot and tests can run with zero
credentials. Examples: `FakeMailer` captures sent mail in `.sent`; `FakeAbuseChecks.verifyTurnstile`
returns false only for the token `"fail"`; `FakeJobs` runs a registered handler synchronously on
enqueue.

## Typed API client

`endpoints` is a strongly typed registry of every API endpoint (method, path, request schema or
null, response schema, auth level, csrf flag). `createApiClient` turns the registry into typed
methods that infer their request and response from the schemas, fill path params, attach the bearer
and CSRF headers when required, parse JSON, and throw a typed `AppError` on non-2xx responses. It is
isomorphic: pass `fetchImpl` to run anywhere without a global fetch.

```ts
const api = createApiClient({
  baseURL: "https://api.civfix.dev",
  getAuthHeader: () => ({ Authorization: `Bearer ${token}` }),
  getCsrfToken: () => csrf,
})

const report = await api.createReport({
  idempotencyKey: crypto.randomUUID(),
  category: "trash",
  type: "dump",
  lat: 34.05,
  lng: -118.24,
  geomSource: "device",
  mediaUploadIds: [],
})
```

## Scripts

- `pnpm build` - bundle to `dist` (ESM + CJS + d.ts) with tsup.
- `pnpm typecheck` - `tsc --noEmit`.
- `pnpm test` - vitest unit tests.
- `pnpm lint` - eslint flat config.
- `pnpm clean` - remove `dist` and build info.

## Publishing

This is the ONLY publishable package in the repo (`@civfix/ui` and both apps are private). It is
versioned and published with `@changesets/cli`. Follow [RELEASING.md](../../RELEASING.md) every time -
it is the full runbook. In short:

1. Record a changeset (`pnpm changeset`) naming `@civfix/shared` and the bump level (PATCH =
   backward-compatible add, MINOR = new endpoint/schema/module, MAJOR = breaking change). Commit it
   with the change.
2. `pnpm changeset version` applies the pending changesets (bumps `package.json` `version`, writes
   the `CHANGELOG.md`), reviewed and committed by hand (`config.json` has `"commit": false`).
3. Merge to `main`: `.github/workflows/publish-shared.yml` builds the package, runs
   `scripts/check-shared-version.mjs --release` (checks the version against the registry, then
   creates and pushes the per-package tag `@civfix/shared@X.Y.Z` on the main commit), and then
   `pnpm changeset publish --no-git-tag` (authenticated by the `NPM_TOKEN` repo secret for the
   `ci-publisher` account), which publishes when the version is ahead of the registry.
4. Bump the `@civfix/shared` range in every consumer OUTSIDE this repo (civfix-backend x2 manifests,
   civfix-admin, the gov plane) and refresh its lockfile. The two apps in this repo need nothing:
   they take `workspace:*`. No consumer may ever depend on `@civfix/ui`.

The contract's versions and tags are package-scoped (`@civfix/shared@X.Y.Z`). A `vX.Y.Z` GitHub
release is something else: it is the production deploy of community-web (a rebuild of the tagged
commit) and publishes nothing to the registry. Mobile production goes out through a manual
`deploy-mobile.yml` run with `profile=production`, never through a release. A push to `main` with no
applied version bump publishes nothing. See [RELEASING.md](../../RELEASING.md) for the exact steps,
the 0.x caret rule and the consumer manifests.

See DECISIONS.md for the taxonomy and structural decisions made while building this package.

## License

`@civfix/shared` is free software, licensed under the
[GNU Affero General Public License, version 3 only](LICENSE), as part of the
[civfix-app](https://github.com/civfix/civfix-app) repository.
