# @civfix/ui

Shared user-facing UI for the civfix community clients: ONE set of components authored in React Native
primitives (`View` / `Text` / `Pressable`), rendered on native via Metro and on web via
react-native-web. The layout adapts to ORIENTATION (landscape -> expanded sidebar shell; portrait ->
compact bottom-sheet shell), not to platform, so every screen is written once instead of twice.

It depends only on `@civfix/shared` (design tokens + DTOs). It sits beside the contract in the
`civfix-app` monorepo, but is a SEPARATE package so the React/RN peer deps stay isolated and the
publishable contract never re-releases on UI churn. It is `"private": true` and is NEVER published;
`apps/community-web` and `apps/community-mobile` take it as `workspace:*`, and no repo outside this
one may depend on it - least of all the backend.

This README is the orientation and the authoring reference: the five seams, the theming recipe, the
loading-state and haptics vocabularies, and the dist-types rule below are the contracts a body author
works against.

## How it ships: SOURCE, not a bundle

Unlike `@civfix/shared` (a pre-bundled `dist`), `@civfix/ui` ships untranspiled `.tsx` SOURCE and emits
only type declarations (`dist-types/`). Pre-bundling would collapse the `.web.tsx` / `.native.tsx`
platform seam files and bake `from "react-native"` into the output before react-native-web or Metro
could resolve it per platform.

- `source` / `main` / `module` / `react-native` all point at `./src/index.ts`; `types` at
  `./dist-types/index.d.ts`; per-subpath `exports` resolve the `react-native` / `default` condition to
  source and `types` to `dist-types`. `"files": ["src", "dist-types"]`.
- `build` = `tsc --emitDeclarationOnly --outDir dist-types`.
- Consumers transpile the source themselves: Metro honors the `react-native` export condition on mobile;
  web adds `@civfix/ui` (and the RN stack) to `transpilePackages` and aliases `react-native` to
  `react-native-web`.

Consequence (the #1 gotcha): bundlers consume the SOURCE, but `tsc` consumes the `dist-types`. The
declaration types must be rebuilt before a consumer typecheck sees a change (the dist-types rule,
below).

## Dependencies

React, React Native, react-native-web, react-native-reanimated/svg/gesture-handler/safe-area-context,
@gorhom/bottom-sheet, the maplibre libraries, lucide-react-native, @tanstack/react-query, and zustand
are `peerDependencies` so each app keeps a single copy (the singletons it owns). `react-native` is
optional (web satisfies it through the react-native-web alias, not a native install); the native map /
video and `maplibre-gl` are optional too (web never installs the native map; native never installs
`maplibre-gl`). The only hard dependency is `@civfix/shared` (`workspace:*` inside this repo).

## The source tree (`src/`)

| Subdir | What lives here |
| --- | --- |
| `theme/` | the design-token -> RN adapter (fontSize/fontFamily/colors/glass/shadow/radius/space); `useLayoutMode` (orientation: landscape -> expanded, portrait -> compact); `supportsBlur`; the web affordances (cursor / focus-visible ring / hover / text-selection, native-safe no-ops) |
| `typography/` | the shared `Text` variant component; `TextLink` (the one inline prose link); the lucide `Icon` wrapper + `LucideIcon` type; the semantic `iconMap` vocabulary |
| `surface/` | `BlurSurface` - the glass seam (`.web` CSS backdrop-filter / `.native` expo-blur) |
| `capabilities/` | the `PlatformCapabilities` shape + `CapabilitiesProvider` + the `useCamera()`/`useGeolocation()`/`usePush()`/`useSecureStore()`/`usePersistence()`/`useBlurSurface()`/`useHaptics()`/`useOpenExternal()` hooks + the in-memory fakes |
| `data/` | the `DataContextValue` + `ApiProvider` + `useApi`/`useAuthState`/`useRequireAuth`/`useLogout`/`useChatSocket`/`useSubmitReport`; the shared React Query feature hooks; the single `queryKeys` factory; the optimistic-cache helpers; the fakes |
| `nav/` | the unified zustand `useNavStore` (compact-replace vs expanded-append) + the pure route helpers (`pathForEntry`/`entryFromPath`/`seedFor`) + the nav types |
| `shell/` | `AppShell` + `ExpandedShell` (sidebar) + `CompactShell` (`.native` gorhom sheet / `.web` worklet-free PanResponder sheet) + `BodyRouter` + the pure `bodyRoutes`/`bodyLayout` tables + the `ScrollHost` seam + the header seams |
| `primitives/` | the ~25 reusable presentational RN controls (buttons, chips, avatars, badges, fields, toggles, cards, ...) |
| `bodies/` | the feature bodies (one per surface: social/reports/feed/events/cleanups/notifications/messaging/conversation/report-flow + detail bodies) + body-local helpers |
| `map/` | the `Map` seam (`.web` maplibre-gl / `.native` @maplibre/maplibre-react-native behind one contract), the unified react-native-svg pins, `mapStyle`, the `filterStore`, the map controls + popovers |
| `report/` | the report `draftStore`, the `submit` pipeline, and the report-type taxonomy |


## Theming (light / dark)

`@civfix/ui/theme` ships TWO themes built from the shared tokens: `themes.light` (= the historical static
`theme` export, still exported and still the light theme) and `themes.dark` (built from
`darkColor`/`darkShadow` in `@civfix/shared/tokens`). Both have the identical shape (`Theme`): the same
`colors.*` aliases, `glass.*` fills, `shadows.*`, `imageFrame`, plus a `scheme` field.

- **Resolution.** The host mounts `<ThemeProvider>` near the root. It resolves `scheme` from the
  `AppearancePreference` (`"system" | "light" | "dark"`, default `DEFAULT_APPEARANCE_PREFERENCE` =
  `"light"` - `"system"` only once the user picks it) and react-native's
  `useColorScheme()`. `useTheme()` returns `themes[scheme]`; `useColorSchemeName()` returns the scheme.
  Outside a provider everything resolves to light, so tests and isolated renders keep working.
- **Preference seam.** The host owns persistence and registers its store once, at module scope:
  `setAppearancePreferenceStore({ get, set, subscribe })` (mobile: a zustand+MMKV store; web: a
  zustand+localStorage store). Shared code reads it with `useAppearancePreference()` and writes with
  `setAppearancePreference(p)`. With no host store registered an in-memory store stands in. The
  Appearance row in `SettingsBody` opens `AppearanceSettingsBody` (`/settings/appearance`), the
  three-option picker.
- **Styles: the conversion recipe (`makeThemedStyles`).** A module-scope `StyleSheet.create` that reads
  `theme.colors.*` / `theme.glass.*` / `theme.shadows.*` / `theme.imageFrame` is frozen to light. Convert
  it mechanically:

  ```tsx
  // before
  import { theme } from "../theme"
  const styles = StyleSheet.create({ card: { backgroundColor: theme.colors.surface, ...theme.shadows.s1 } })
  export function Card() { return <View style={styles.card} /> }

  // after
  import { makeThemedStyles, useTheme } from "../theme"
  const useStyles = makeThemedStyles((t) => ({ card: { backgroundColor: t.colors.surface, ...t.shadows.s1 } }))
  export function Card() {
    const styles = useStyles()
    return <View style={styles.card} />
  }
  ```

  `makeThemedStyles` runs the factory once per scheme (two module-level cache slots per call site) and
  returns a hook, so the hot path is a context read plus an object lookup - no per-render allocation.
  `useStyles.for("dark")` gives the sheet outside a component (tests, worklets). Inline colors in JSX
  (`color={theme.colors.textSubtle}`, `tint(theme.colors.brand.bloom, 0.2)`) switch to
  `const t = useTheme()` inside the component. Pure helpers and non-component modules that take a color
  should take it as a parameter or accept a `Theme`; `categoryColor(category, scheme)` and
  `cleanupColorFor(scheme)` take the scheme explicitly. `space`/`radius`/`fontSize`/`fontFamily`/
  `motion`/`lineHeight` are scheme-independent and may still be read from the static `theme` at module
  scope.

## Inline links: `TextLink`

Any TAPPABLE TEXT THAT SITS INSIDE PROSE uses `TextLink` (`src/typography/TextLink.tsx`, exported from
the root barrel and `@civfix/ui/typography` next to `Text`). Button-shaped actions - anything with a
box, a pill, a 44pt target, a focus ring - use the button primitives (`PrimaryButton`,
`SecondaryButton`, `GlassButton`) or a `Pressable`, NOT this.

One tone, matching the profile followers/following affordance: `theme.fontFamily.bodySemiBold` +
`theme.colors.textMuted` + `textDecorationLine: "underline"`, `opacity: 0.7` while pressed. There is
deliberately no coral inline-link tone.

Props: `children`, `onPress`, `variant` (any `Text` variant, default `body`), `disabled`, `style`
(size/spacing fit inside a smaller sentence), `numberOfLines`, `standalone`, `accessibilityLabel`,
`testID`. A link that stands ALONE rather than inside a sentence ("View all", "Load more") passes
`standalone`, which wraps the label in a `Pressable` that owns the press, the role/label/state and a 44pt
`minHeight` box - RN `Text` DROPS `hitSlop` on native and on react-native-web, so only a real box is a
real target; inline-sentence uses leave `standalone` off. It
renders a nested-capable `Text`, so it can sit mid-sentence on web (RN-web `Text` onPress) and native.
With `onPress` it is `accessible` + `accessibilityRole="link"` and shows the pointer cursor on web;
WITHOUT `onPress` it is the same styling with no a11y role - for the case where an ancestor `Pressable`
owns the press and the 44pt box (`ProfileStatsRow`).

```tsx
<Text variant="body" color={theme.colors.textMuted}>
  {before}
  <TextLink onPress={onSignIn}>{t("feed.sign_in")}</TextLink>
  {after}
</Text>
```

## Loading states

Content with a KNOWN SHAPE - any list, any detail page, any profile - shows a SKELETON in the real
layout, never a spinner. Rows and blocks carry the geometry of the loaded content: an avatar circle plus
two text bars for a people row, a thumbnail plus lines for a report row, a hero block plus title bars for
a detail page. Header/chrome keeps rendering during the load, so the screen does not reflow when the data
lands.

`ActivityIndicator` survives in exactly two places: INSIDE A BUTTON (a submit/loading state, e.g.
`PrimaryButton loading`, `FollowButton`, `RsvpPill`) and for SUB-SECOND INLINE WORK (a "load more"
list footer, a search-as-you-type indicator). It is never the full-content loading state.

The pieces live in `src/primitives/skeleton` and are exported from the root barrel:

| Piece | What it draws |
| --- | --- |
| `SkeletonBlock` | one rect - `width`, `height`, `radius`, `style` |
| `SkeletonText` | one text line - `width` (a %), `height` (radius follows) |
| `SkeletonRow` | one list row for a `kind` - avatar/thumb + lines (+ trailing pill) |
| `SkeletonList` | `rows` copies of a `SkeletonRow` of that `kind` |
| `SkeletonGroup` | an a11y-hidden container for a bespoke composition |
| `SkeletonDetail` | hero block + title/body bars, optionally trailed by rows |

`kind` is one of `person | report | notification | settings | text`; each is a row geometry, not a
colour, and `SKELETON_ROW_KINDS` holds the specs. Fill is `theme.colors.bgAlt`; every piece pulses on one
shared, ref-counted `Animated.Value` (`useSkeletonPulse`) so all the rows breathe together, and
`useReducedMotion()` renders them STATIC. Every piece is `accessibilityElementsHidden` +
`importantForAccessibility="no-hide-descendants"` and announces nothing - a screen's own loading label
(e.g. the search results `accessibilityRole="progressbar"` wrapper) is what speaks.

`StateView`'s `LoadingState` takes `skeleton` (a `SkeletonRowKind`) + `rows` and renders the list form;
its bare spinner is now only for surfaces with no predictable geometry.

```tsx
<LoadingState skeleton="person" rows={8} />

<SkeletonGroup style={styles.header}>
  <SkeletonText width="76%" height={22} />
  <SkeletonBlock width="100%" height={160} radius={theme.radius.lg} />
</SkeletonGroup>
```

## Haptics

Four semantic verbs, one vocabulary, injected as a capability (`HapticsCapability`) and read through
`useHaptics()` - which always returns all four, as no-ops where the host provides none (web), so no call
site null-checks. The mobile adapter (`apps/community-mobile/src/lib/nativeHaptics.ts`) maps them onto
expo-haptics; the OS-level haptics setting is honoured there, not here. Reduce-motion does NOT gate
haptics - they are not motion.

| Verb | Feel | Fires on |
| --- | --- | --- |
| `selection()` | light tick (`selectionAsync`) | tab change, wizard step advance/back, map pin selected |
| `impactLight()` | a surface arriving (`impactAsync(Light)`) | bottom-sheet snap settle, CreateMenu open, swipe-action reveal threshold, message context menu, drop-pin menu |
| `success()` | success notification | report submitted, event published, post created, RSVP confirmed |
| `error()` | error notification | report/event/post submit failure |

Nothing fires on an ordinary tap, a list row, a plain button, or scrolling. A blocked action only buzzes
`error()` where the control is TAPPABLE-but-refused; the wizards disable their Next buttons instead, so
they stay silent.

## Framed images

Every USER-CONTENT image gets one hairline frame so it reads as an attached photo instead of dissolving
into the paper fill: `StyleSheet.hairlineWidth` in `theme.colors.border` (the same token the card edges
use; the tab-bar divider is its own 1.5px `theme.colors.textMuted` rule), following the image's existing
radius. Two shapes, one token:

- The image IS the layout node (it owns width/height/radius) -> render `<FramedImage/>`
  (`src/primitives/FramedImage.tsx`, root barrel). Same props as RN `Image` plus `framed` (default
  `true`; pass `framed={false}` to opt out).
- The image is an ABSOLUTE-FILL child of a rounded, `overflow: "hidden"` box -> the border belongs on
  that BOX (spread `theme.imageFrame` into the container style), or the clip eats it. Frame the box
  only when a photo is actually showing, so a glyph/monogram placeholder stays unframed.

`MediaPreview` (report media, post images, DM bubbles, composer thumbs, media-grid tiles) is framed by
default and takes the same `framed` prop - the full-screen lightbox stage passes `framed={false}`.

NOT framed: icons, the map, illustrations/brand assets (store badges, the onboarding tour art), and any
image whose container already carries a deliberate ring - `Avatar`'s white separator ring and the report
gallery's 2px selection ring keep their own ring instead of doubling up.

## The five seams (the extensibility mechanism)

A body author never reaches across the platform line; everything platform-specific crosses one of five
seams:

1. **Platform file seams** (`.web.tsx` / `.native.tsx` with an extension-less default selector that
   re-exports the `.web` file for plain `tsc`/Node). Anything importing a platform-bound module
   (expo-*, maplibre, gorhom, reanimated, react-native-video, DOM) lives in a seam file.
2. **The capability context** (`capabilities/`) - the host app injects camera/GPS/push/secure-store/
   persistence/blur/haptics/open-external; shared UI consumes them through typed hooks, so no expo-*
   dependency enters shared source.
3. **The data context** (`data/`) - the host injects its API-client singleton + auth + chat socket;
   shared bodies/hooks consume them via `useApi()`/`useAuthState()`/etc., so the shared layer never
   touches auth transport (web cookie+CSRF vs mobile Bearer).
4. **The ScrollHost** (`shell/ScrollHost.tsx`) - the shell injects the scroll container (gorhom's
   scroll components inside the native sheet; plain RN `ScrollView`/`FlatList` in the expanded panel
   and on web), because the right container depends on the SHELL, not just the platform.
5. **The unified nav store** (`nav/useNavStore.ts`) - one zustand store drives both layouts; per-app
   URL / deep-link adapters stay app-side (the only code allowed to touch `window.history` /
   `expo-router`).

An ESLint import-guard (`packages/ui/eslint.config.js`) enforces the platform-isolation half: plain
shared source may not import expo-*, maplibre, gorhom, reanimated, react-native-video, `@expo/vector-icons`,
or `next/*`; the seam files relax only what they need (`maplibre-gl` in `.web`; expo/reanimated/gorhom/
video/native maplibre in `.native`).

## The dev loop and the dist-types rule

`@civfix/ui` lives in the same monorepo as its consumers and is never published, so there is no
override to add and no version to adopt: `apps/community-web` and `apps/community-mobile` depend on
`"@civfix/ui": "workspace:*"`, and an edit to `src/` is live in Metro / the Next dev server on the
next reload. Verify a single React Native with `pnpm why react-native` (expect exactly one).

THE DIST-TYPES RULE (the single most important gotcha): bundlers read the source live, but consumers
TYPECHECK against `dist-types/`, so stale declarations produce phantom type errors — or phantom green
— against the previous `@civfix/ui` shape. Turbo orders this for you (`typecheck`, `lint`, `test` and
`dev` all `dependsOn: ["^build"]`), so run the task through turbo rather than calling `tsc` directly:

```sh
pnpm typecheck                                  # whole workspace, ui build first
pnpm turbo run typecheck --filter=community-web # or one consumer
pnpm --filter @civfix/ui build                  # tsc --emitDeclarationOnly -> dist-types/, by hand
```

## Scripts

- `pnpm build` - emit `dist-types/` (`tsc --emitDeclarationOnly`).
- `pnpm typecheck` - `tsc --noEmit`.
- `pnpm test` - vitest (the nav round-trip, the body-render totality, the cache-update tests, the
  filterStore test).
- `pnpm lint` - eslint flat config (the import-guard).
- `pnpm clean` - remove `dist-types` and build info.

## Releasing

`@civfix/ui` is `"private": true` and is NEVER published: it ships as part of whatever build its two
consumers make. A change here reaches `community-web` on the next deploy of that app
(`.github/workflows/deploy-web.yml`, push to `main` or `dev`) and reaches `community-mobile` only when
someone runs a manual EAS build. `changeset version` may still bump its version and changelog
(`privatePackages: { version: true, tag: false }`), but nothing is published or tagged for it —
`@civfix/shared` is the only publishable package; see [RELEASING.md](../../RELEASING.md).
