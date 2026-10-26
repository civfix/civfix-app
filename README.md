# civfix-app

The civfix consumer plane in one repo: the `@civfix/tokens` design tokens, the `@civfix/ui`
component set, the public web app and the community mobile app. It is a pnpm workspace + Turbo
monorepo.

The API contract is not here: it is `@civfix/contract`, published from
[`civfix/civfix-contract`](https://github.com/civfix/civfix-contract) to the private registry
(`https://repo.civfix.org`), and this repo installs it like every other consumer. Until 0.61.0 the
contract and the tokens shipped together as `@civfix/shared` from this repo.

The three former repos (`civfix-shared`, `civfix-web`, `civfix-mobile`) were merged into this one and
are retired. The other civfix repos (`civfix-backend`, `civfix-admin`, `civfix-infra`, the gov plane)
stay separate and install `@civfix/contract` and `@civfix/tokens` from the private registry.

## Layout

| Path | Package | What it is |
| --- | --- | --- |
| `packages/tokens` | `@civfix/tokens` | The design tokens (colour scales for both schemes, category and cleanup pin colours, type, spacing, radius and shadow scales) and the chip-contrast helpers. Framework-free, no runtime deps. **Published** to the private registry for civfix-admin and civfix-backend. [README](packages/tokens/README.md) |
| `packages/ui` | `@civfix/ui` (private) | The shared React Native UI (theme, primitives, shells, nav store, feature bodies, the Map seam, the app-only `helpers`) rendered on web via react-native-web. Never published. [README](packages/ui/README.md) |
| `apps/community-web` | `community-web` | Next.js 15 static-export SPA (React 19 + RN-web + shadcn) plus its Cloudflare Pages config and Functions. [README](apps/community-web/README.md) |
| `apps/community-mobile` | `community-mobile` | React Native + Expo SDK 54 user app; custom dev client only, never Expo Go. [README](apps/community-mobile/README.md) |

## Toolchain

pnpm 9.12.0 (pinned via `packageManager`), Node 22 (`.nvmrc`), Turbo 2. `.npmrc` sets
`node-linker=hoisted` (Metro and the config plugins need a flat `node_modules`),
`prefer-workspace-packages` / `link-workspace-packages`, and scopes `@civfix` to
`https://repo.civfix.org/`.

## Commands

Root scripts are turbo-delegated across every workspace package:

```sh
pnpm install
pnpm build         # @civfix/tokens -> dist (tsup), @civfix/ui -> dist-types, web -> out/
pnpm typecheck
pnpm lint
pnpm test
pnpm i18n:check    # locale keys complete across languages, and every t(...) call site in ui, web and mobile resolves
pnpm knip          # unused files, exports and dependencies
pnpm jscpd         # duplicated code, fails above the configured threshold
pnpm clean
pnpm run doctor:expo  # expo-doctor on the mobile app (`pnpm doctor` is pnpm's own command)
```

Per package:

```sh
pnpm --filter @civfix/tokens dev     # tsup --watch on the tokens
pnpm --filter community-web dev      # next dev, http://localhost:3000
pnpm --filter community-mobile start # expo start --dev-client (Metro)
```

Recommended for local testing:
```sh
NEXT_PUBLIC_API_URL=https://api.civfix.dev pnpm --filter community-web dev
```

## Dev loop

1. `pnpm install`
2. `pnpm build` once (or `pnpm --filter @civfix/tokens dev` to keep the tokens' `dist` watched).
3. Web: `pnpm --filter community-web dev`.
4. Mobile: build the custom dev client first
   (`pnpm --filter community-mobile exec expo prebuild`, then
   `pnpm --filter community-mobile exec expo run:ios` / `run:android`), then
   `pnpm --filter community-mobile start`.

Editing `packages/tokens` or `packages/ui` reaches both apps directly; there is no `link:` override
to add and no version bump to adopt inside this repo. A contract change is different: it is a PR in
`civfix-contract`, a publish, then an adoption PR here
([RELEASING.md](RELEASING.md#adopting-a-new-civfixcontract)).

The umbrella's local e2e environment (`../dev/run.sh` in the civfix checkout) still drives the
backend, Postgres/Redis, the media worker and the seeded data for end-to-end runs.

## How the packages are consumed

- `@civfix/ui` and both apps depend on `@civfix/contract` by caret range from the registry
  (`^0.62.0`) and on `@civfix/tokens` as `workspace:*`; both apps take `@civfix/ui` as `workspace:*`.
- `@civfix/contract` comes from the registry, so web and mobile run whatever version the lockfile
  pins. A new contract version reaches them only through an adoption PR (range edit on a new minor,
  or `pnpm update @civfix/contract` for an in-range patch, since a plain `pnpm install` leaves the
  lockfile unchanged).
- `@civfix/tokens` is **built**: consumers resolve its `exports` from `dist/` (gitignored), so it must
  be built before anything typechecks against it. `turbo`'s `^build` dependency handles that for
  `build`/`typecheck`/`lint`/`test`/`dev`; the mobile app also has a `postinstall` that runs
  `pnpm --filter @civfix/tokens build`, because `app.config.js` requires `@civfix/tokens` and EAS
  builders need its `dist` too.
- `@civfix/ui` ships untranspiled `.tsx` **source** through its exports map (Metro and Next transpile
  it; the `.web.tsx`/`.native.tsx` seams must stay unbundled) and emits only `dist-types/` for `tsc`.
  Turbo runs that build before any typecheck/lint/test, so there is no manual rebuild step.

## Branches and deploys

**`main` is staging. Production is a `v*` release.** There is no `dev` branch: every feature branch PRs
into `main`, and a merge must be production-ready, but it lands on staging first and reaches
production only when a release is cut. PRs into `main` run `.github/workflows/ci.yml` (three jobs:
packages, web, mobile).

| Event | What happens |
| --- | --- |
| push to `main` | `deploy-web.yml` builds the web static export against `api.civfix.dev` and publishes it to the `staging` branch of the Cloudflare Pages project `civfix-web` (alias `staging.civfix-web.pages.dev`, served as https://civfix.dev). `publish-tokens.yml` publishes `@civfix/tokens` if its version is ahead of the registry. |
| published `v*` release | `deploy-web.yml` rebuilds **the same commit** against `api.civfix.org` with Turnstile on, and publishes it to the Pages production branch (https://civfix.org). |

A static export inlines every `NEXT_PUBLIC_*` at build time, so production is a rebuild of the release
commit rather than a byte-copy of the staging artifact, unlike the backend, whose Docker images really
are promoted as-is. The workflow resolves those values once and then asserts they match the target, so a
build cannot ship the staging API URL to civfix.org or the production one to civfix.dev.

The mobile app deploys through `.github/workflows/deploy-mobile.yml` on the same lane: a push to
`main` that touches the app or the packages builds the `testflight` profile (staging API) on a
GitHub-hosted Mac and uploads it to App Store Connect, where TestFlight hands it to the internal
testers; a manual run with `profile=production` uploads a build that bakes no API URL at all and
picks one at runtime from its iOS install source (`api.civfix.dev` while it is handed out through
TestFlight, `api.civfix.org` once it is downloaded from the App Store), and attaching that build to
a version and submitting it for review stays a human step in App Store Connect. The runner executes
the same `scripts/store-build.sh` a developer runs locally (`eas build --local`, then a direct
`fastlane pilot upload` to App Store Connect, with no EAS Submit queue), so CI and laptop builds share
one EAS signing-credential store and one build-number counter. See that app's README for the
prerequisites (an `EXPO_TOKEN` secret, the App Store Connect API key secrets, EAS credentials, the
remote build number).
Android still ships only by hand.

## Publishing `@civfix/tokens`

`@civfix/ui` and both apps are private and are never published. `@civfix/tokens` is, because
`civfix-admin` and `civfix-backend` (the email layout) install it from `repo.civfix.org`.

Record a changeset while developing (`pnpm changeset`), apply it before merging
(`pnpm changeset version`), and merging to `main` publishes it. Full runbook, including how each
external consumer adopts the new version and how this repo adopts a new `@civfix/contract`:
[RELEASING.md](RELEASING.md). The contract's own release flow is `RELEASING.md` in
`civfix-contract`.

## License

civfix-app is free software, licensed under the
[GNU Affero General Public License, version 3 only](LICENSE). The apps built
from this repository are additionally conveyed under the
[App Store and Play distribution exception](LICENSE-EXCEPTIONS.md), because the
store binaries bundle `packages/tokens` and `packages/ui`. `@civfix/contract`, which the store
binaries also bundle, carries the same exception in its own repository. Every file is
covered by the declaration in [REUSE.toml](REUSE.toml); there are no per-file
license headers. Contributions are accepted under the
[Contributor License Agreement](CLA.md); see [CONTRIBUTING.md](CONTRIBUTING.md).
civfix is a project of Reach Out Los Angeles Inc.; the civfix name and logos are its
trademarks and are not covered by the license.
