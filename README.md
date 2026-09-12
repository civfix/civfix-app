# civfix-app

The civfix consumer plane in one repo: the `@civfix/shared` contract, the `@civfix/ui` component set,
the public web app and the community mobile app. It is a pnpm workspace + Turbo monorepo.

The three former repos (`civfix-shared`, `civfix-web`, `civfix-mobile`) were merged into this one and
are retired. The other civfix repos (`civfix-backend`, `civfix-admin`, `civfix-infra`, the gov plane)
stay separate and consume `@civfix/shared` from the private registry.

## Layout

| Path | Package | What it is |
| --- | --- | --- |
| `packages/shared` | `@civfix/shared` | The contract: Zod schemas + inferred types, the vendor-neutral interface seams + in-memory fakes, design tokens, the typed API client. Framework-free; only runtime dep is `zod`. **Still published** to the private registry for the out-of-repo consumers. [README](packages/shared/README.md) |
| `packages/ui` | `@civfix/ui` (private) | The shared React Native UI (theme, primitives, shells, nav store, feature bodies, the Map seam) rendered on web via react-native-web. Never published. [README](packages/ui/README.md) |
| `apps/community-web` | `community-web` | Next.js 15 static-export SPA (React 19 + RN-web + shadcn) plus its Cloudflare Pages config and Functions. [README](apps/community-web/README.md) |
| `apps/community-mobile` | `community-mobile` | React Native + Expo SDK 54 user app; custom dev client only, never Expo Go. [README](apps/community-mobile/README.md) |
| `docs/superpowers` | — | Older design/plan documents, kept for history. |

## Toolchain

pnpm 9.12.0 (pinned via `packageManager`), Node 22 (`.nvmrc`), Turbo 2. `.npmrc` sets
`node-linker=hoisted` (Metro and the config plugins need a flat `node_modules`),
`prefer-workspace-packages` / `link-workspace-packages`, and scopes `@civfix` to
`https://repo.civfix.org/`.

## Commands

Root scripts are turbo-delegated across every workspace package:

```sh
pnpm install
pnpm build         # @civfix/shared -> dist (tsup), @civfix/ui -> dist-types, web -> out/
pnpm typecheck
pnpm lint
pnpm test
pnpm i18n:check    # @civfix/ui locale-key check
pnpm clean
pnpm doctor        # expo-doctor on the mobile app
```

Per package:

```sh
pnpm --filter @civfix/shared dev     # tsup --watch on the contract
pnpm --filter community-web dev      # next dev, http://localhost:3000
pnpm --filter community-mobile start # expo start --dev-client (Metro)
```

Recommended for local testing:
```sh
NEXT_PUBLIC_API_URL=https://api.civfix.dev pnpm --filter community-web dev
```

## Dev loop

1. `pnpm install`
2. `pnpm build` once (or `pnpm --filter @civfix/shared dev` to keep the contract's `dist` watched).
3. Web: `pnpm --filter community-web dev`.
4. Mobile: build the custom dev client first
   (`pnpm --filter community-mobile exec expo prebuild`, then
   `pnpm --filter community-mobile exec expo run:ios` / `run:android`), then
   `pnpm --filter community-mobile start`.

Editing `packages/shared` or `packages/ui` reaches both apps directly — there is no `link:` override
to add and no version bump to adopt inside this repo.

The umbrella's local e2e environment (`../dev/run.sh` in the civfix checkout) still drives the
backend, Postgres/Redis, the media worker and the seeded data for end-to-end runs.

## How the packages are consumed

- Both apps depend on `@civfix/shared` and `@civfix/ui` as `workspace:*`.
- `@civfix/shared` is **built**: consumers resolve its `exports` from `dist/` (gitignored), so it must
  be built before anything typechecks against it. `turbo`'s `^build` dependency handles that for
  `build`/`typecheck`/`lint`/`test`/`dev`; the mobile app also has a `postinstall` that runs
  `pnpm --filter @civfix/shared build` so EAS builders get a `dist` too.
- `@civfix/ui` ships untranspiled `.tsx` **source** through its exports map (Metro and Next transpile
  it; the `.web.tsx`/`.native.tsx` seams must stay unbundled) and emits only `dist-types/` for `tsc`.
  Turbo runs that build before any typecheck/lint/test, so there is no manual rebuild step.

## Branches and deploys

`main` is production, `dev` is staging — the same convention as the other civfix repos. PRs to either
branch run `.github/workflows/ci.yml` (three jobs: packages, web, mobile).

| Push | What happens |
| --- | --- |
| `main` | `deploy-web.yml` builds the web static export and publishes it to the Cloudflare Pages project `civfix-web` (production -> https://civfix.org). `publish-shared.yml` publishes `@civfix/shared` if its version is ahead of the registry. |
| `dev` | `deploy-web.yml` publishes the same build to the Pages preview branch (https://civfix.dev). |

The mobile app has **no** deploy CI: it ships only via a manual EAS build from
`apps/community-mobile` (see that app's README; `.github/workflows/eas-build.yml.example` is an
inactive template). Nothing mobile reaches a device until a build runs.

## Publishing `@civfix/shared`

`@civfix/ui` and both apps are private and are never published. `@civfix/shared` still is, because
`civfix-backend` (`services/api` + `services/media-worker`), `civfix-admin` and the gov plane install
it from `repo.civfix.org`.

Record a changeset while developing (`pnpm changeset`), apply it before merging
(`pnpm changeset version`), and merging to `main` publishes it. Full runbook, including how each
external consumer adopts the new version: [RELEASING.md](RELEASING.md).
