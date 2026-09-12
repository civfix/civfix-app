"use client"

// STAGE 2 PRIMITIVES GALLERY / VERIFICATION SURFACE (UI-unification, documents/18-ui-unification.md).
//
// This web-app-local component (NOT shipped from @civfix/ui) renders EVERY shared @civfix/ui primitive
// through react-native-web in representative states, so increment 2D - the Stage 2 exit gate - can
// VISUALLY VERIFY that the shared RN-authored primitives render faithfully on web at both breakpoints:
// correct contract fonts (the 12 self-hosted @expo-google-fonts family names), lucide glyphs as SVG,
// a real backdrop-filter BlurSurface, and clean layout/colors. It is reachable only at the isolated
// /skeleton route and is NOT part of product navigation; it is removed or gated in Stage 5.
//
// The whole tree is wrapped in <CapabilitiesProvider value={makeFakeCapabilities()}> so any
// capability-touching primitive renders against the in-memory fakes (no native modules on web).
//
// IMPORTANT: every COMPONENT UNDER TEST is a shared @civfix/ui primitive (rendered via RNW). The
// surrounding layout chrome (sections, rows, the colorful blur backdrop) is intentionally plain DOM /
// inline styles, NOT react-native View: the web app's own tsconfig does not carry react-native types
// (RN is only a webpack alias to react-native-web at bundle time, owned by the @civfix/ui source). The
// chrome does not affect the verification - it only positions the real primitives.

import React, { useState } from "react"
import {
  Brand,
  Text,
  PrimaryButton,
  SecondaryButton,
  Avatar,
  StatusBadge,
  CategoryChip,
  CountBadge,
  Toggle,
  SettingsToggle,
  MetaDot,
  TextField,
  SegmentedCodeInput,
  LoadingState,
  EmptyState,
  SignInPrompt,
  DateBadge,
  BlurSurface,
  iconMap,
  themeFor,
  useTheme,
  ThemeProvider,
  SectionCard,
  SegmentedControl,
  FilterChip,
  StatTile,
  StatTileRow,
  HeroStat,
  Meter,
  TrendSparkline,
  PhaseHeader,
  HeroSkeleton,
  TilesSkeleton,
  RowsSkeleton,
  type ColorSchemeName,
  type SparkPoint,
} from "@civfix/ui"
import { CapabilitiesProvider, makeFakeCapabilities } from "@civfix/ui/capabilities"
import type { ReportStatus, ReportCategory } from "@civfix/shared"

const noop = () => {}

const TEXT_VARIANTS = [
  "display",
  "title",
  "heading",
  "body",
  "bodyStrong",
  "label",
  "caption",
  "mono",
] as const

const STATUSES: ReportStatus[] = [
  "submitted",
  "acknowledged",
  "held",
  "in_progress",
  "published",
  "resolved",
  "rejected",
]

const CATEGORIES: ReportCategory[] = ["trash", "recycling", "graffiti", "hazard", "encampment", "water", "other"]

// A near-future date for the DateBadge (relative to "today" so it stays representative over time).
const NEAR_FUTURE_ISO = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()

// A small inline data-URI SVG so a real photoUrl Avatar renders without any network dependency
// (a teal->magenta gradient avatar). Keeps the gallery hermetic for the verification run.
const PHOTO_URL =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#14b8a6"/><stop offset="1" stop-color="#db2777"/>' +
      "</linearGradient></defs>" +
      '<rect width="80" height="80" fill="url(#g)"/>' +
      '<circle cx="40" cy="30" r="14" fill="#ffffff" fill-opacity="0.85"/>' +
      '<rect x="16" y="48" width="48" height="28" rx="14" fill="#ffffff" fill-opacity="0.85"/>' +
      "</svg>",
  )

// Exercises the new Avatar `style` passthrough (the s1 drop shadow 2C wanted on the web profile avatar).
const staticTheme = themeFor("light")

const avatarShadowStyle = staticTheme.shadows.s1

/** A labeled section card. data-section makes each block easy to target from preview_inspect. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme()
  return (
    <section
      data-section={title}
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        border: `1px solid ${theme.colors.border}`,
        padding: 16,
        marginTop: 12,
      }}
    >
      <Text variant="label" color={theme.colors.textSubtle}>
        {title.toUpperCase()}
      </Text>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "flex-end",
          gap: 20,
          marginTop: 12,
        }}
      >
        {children}
      </div>
    </section>
  )
}

/** A tiny caption above a single specimen so its state is self-describing in the screenshot. */
function Specimen({ note, children }: { note: string; children: React.ReactNode }) {
  const theme = useTheme()
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
      <Text variant="caption" color={theme.colors.textSubtle}>
        {note}
      </Text>
      {children}
    </div>
  )
}

/** A full-width stacking column (for the toggles / fields that read as vertical rows). */
function Stack({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flexBasis: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxWidth: 520,
      }}
    >
      {children}
    </div>
  )
}

/** A fixed box that frames the flex-filling StateView blocks. */
function StateBox({ children }: { children: React.ReactNode }) {
  const theme = useTheme()
  return (
    <div
      style={{
        display: "flex",
        width: 280,
        height: 240,
        borderRadius: theme.radius.md,
        border: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.bgAlt,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  )
}

/** A colorful striped backdrop that a BlurSurface floats over, so the backdrop-filter is visible. */
function BlurStage({ note, children }: { note: string; children: React.ReactNode }) {
  const theme = useTheme()
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Text variant="caption" color={theme.colors.textSubtle}>
        {note}
      </Text>
      <div
        style={{
          position: "relative",
          width: 220,
          height: 132,
          borderRadius: theme.radius.md,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          {["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"].map((c) => (
            <div key={c} style={{ flex: 1, height: "100%", backgroundColor: c }} />
          ))}
        </div>
        <div style={{ position: "relative" }}>{children}</div>
      </div>
    </div>
  )
}

const SIGNUP_TREND: SparkPoint[] = [
  { key: "d1", value: 2 },
  { key: "d2", value: 5 },
  { key: "d3", value: 5 },
  { key: "d4", value: 9 },
  { key: "d5", value: 0 },
  { key: "d6", value: 14 },
  { key: "d7", value: 18 },
  { key: "d8", value: null },
  { key: "d9", value: 23 },
  { key: "d10", value: 31 },
  { key: "d11", value: 38 },
  { key: "d12", value: 44 },
]

const ARRIVALS: SparkPoint[] = [
  { key: "a1", value: 1 },
  { key: "a2", value: 4 },
  { key: "a3", value: 9 },
  { key: "a4", value: 12 },
  { key: "a5", value: 7 },
  { key: "a6", value: 3 },
  { key: "a7", value: 2 },
]

const RANGE_OPTIONS = [
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "12mo", label: "12 mo" },
  { key: "all", label: "All" },
] as const

const SCOPE_OPTIONS = [
  { key: "personal", label: "Personal" },
  { key: "org", label: "Organization" },
] as const

function HostDashboardPanel({ scheme }: { scheme: ColorSchemeName }) {
  const t = themeFor(scheme)
  const [range, setRange] = useState<string>("90d")
  const [scope, setScope] = useState<string>("personal")
  const [filter, setFilter] = useState<string>("all")

  return (
    <ThemeProvider preference={scheme}>
      <div
        data-scheme={scheme}
        style={{
          flex: "1 1 360px",
          minWidth: 320,
          maxWidth: 560,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 24,
          padding: 16,
          borderRadius: t.radius.lg,
          border: `1px solid ${t.colors.border}`,
          backgroundColor: t.colors.bg,
        }}
      >
        <Text variant="label">{scheme} scheme</Text>

        <PhaseHeader
          phase="live"
          title="Ballona Creek cleanup"
          when="Sat, Mar 14 · 9:00 AM · Ballona Creek"
          relative="Started 40 min ago"
          cta={{ label: "Check in", icon: iconMap.ScanLine, onPress: noop }}
          secondary={{ label: "Message attendees", icon: iconMap.Megaphone, onPress: noop }}
        />

        <HeroStat
          label="Checked in"
          value={38}
          limit={42}
          limitLabel="of 42 registered"
          caption="As of 9:41 AM"
        />

        <StatTileRow columns={2}>
          <StatTile label="Still expected" value="4" />
          <StatTile label="Walk-ups" value="6" tone="success" />
          <StatTile label="No-shows" value="2" tone="danger" hint="2 of 42" />
          <StatTile label="Waitlist" value={null} />
        </StatTileRow>

        <SectionCard
          label="Numbers"
          trailing={
            <SegmentedControl
              size="sm"
              label="Range"
              options={RANGE_OPTIONS}
              selected={range}
              onSelect={setRange}
            />
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <StatTileRow columns={2}>
              <StatTile label="Registrations" value="1,284" trend={SIGNUP_TREND} />
              <StatTile label="Attendance rate" value="82%" />
            </StatTileRow>
            <TrendSparkline
              points={SIGNUP_TREND}
              kind="bars"
              height={24}
              endLabel="44 on Mar 12"
              accessibilityLabel="Registrations, last 90 days, latest 44 on Mar 12"
            />
            <TrendSparkline
              points={ARRIVALS}
              kind="line"
              height={56}
              endLabel="2 at 10:30 AM"
              accessibilityLabel="Arrivals, 15-minute blocks, latest 2 at 10:30 AM"
            />
          </div>
        </SectionCard>

        <SectionCard label="Attendees">
          <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[
              { key: "all", label: "All", count: 42 },
              { key: "checked_in", label: "Checked in", count: 38 },
              { key: "waitlist", label: "Waitlist", count: 0 },
            ].map((chip) => (
              <FilterChip
                key={chip.key}
                label={chip.label}
                count={chip.count}
                selected={filter === chip.key}
                onPress={() => setFilter(chip.key)}
              />
            ))}
          </div>
        </SectionCard>

        <SegmentedControl
          label="Scope"
          options={SCOPE_OPTIONS}
          selected={scope}
          onSelect={setScope}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Meter value={18} max={40} accessibilityLabel="18 of 40 spots" />
          <Meter value={38} max={40} accessibilityLabel="38 of 40 spots" />
          <Meter value={40} max={40} accessibilityLabel="40 of 40 spots" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PrimaryButton label="Share event" icon={iconMap.Share} onPress={noop} />
          <PrimaryButton label="Cancel event" variant="destructive" icon={iconMap.Ban} onPress={noop} />
          <SecondaryButton label="Edit event" icon={iconMap.Pencil} onPress={noop} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <HeroSkeleton />
          <TilesSkeleton columns={2} />
          <RowsSkeleton rows={3} />
        </div>
      </div>
    </ThemeProvider>
  )
}

export default function PrimitivesGallery() {
  const theme = useTheme()
  // Interactive state so the Toggle / SettingsToggle / inputs are tappable during verification.
  const [toggleA, setToggleA] = useState(true)
  const [toggleB, setToggleB] = useState(false)
  const [settingsA, setSettingsA] = useState(true)
  const [settingsB, setSettingsB] = useState(false)
  const [code, setCode] = useState("12")

  return (
    <CapabilitiesProvider value={makeFakeCapabilities()}>
      <main
        style={{
          minHeight: "100vh",
          boxSizing: "border-box",
          padding: 24,
          paddingBottom: 96,
          backgroundColor: theme.colors.bg,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          <Text variant="display">Primitives gallery</Text>
          <Text variant="body" color={theme.colors.textMuted}>
            Stage 2 exit gate - every shared @civfix/ui primitive via react-native-web.
          </Text>
        </div>

        <section
          data-section="Host dashboard primitives (light + dark)"
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.lg,
            border: `1px solid ${theme.colors.border}`,
            padding: 16,
            marginTop: 12,
          }}
        >
          <Text variant="label" color={theme.colors.textSubtle}>
            HOST DASHBOARD PRIMITIVES (LIGHT + DARK)
          </Text>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "flex-start",
              gap: 20,
              marginTop: 12,
            }}
          >
            <HostDashboardPanel scheme="light" />
            <HostDashboardPanel scheme="dark" />
          </div>
        </section>

        <Section title="Brand (sizes 24 / 40 / 64)">
          <Specimen note="size 24">
            <Brand size={24} />
          </Specimen>
          <Specimen note="size 40 (default)">
            <Brand size={40} />
          </Specimen>
          <Specimen note="size 64">
            <Brand size={64} />
          </Specimen>
        </Section>

        <Section title="Text (all 8 variants)">
          {TEXT_VARIANTS.map((v) => (
            <Specimen key={v} note={v}>
              <Text variant={v}>The quick brown fox 0123456789</Text>
            </Specimen>
          ))}
        </Section>

        <Section title="PrimaryButton">
          <Specimen note="primary">
            <PrimaryButton label="Submit report" onPress={noop} />
          </Specimen>
          <Specimen note="dark">
            <PrimaryButton label="Continue" variant="dark" onPress={noop} />
          </Specimen>
          <Specimen note="outline">
            <PrimaryButton label="Cancel" variant="outline" onPress={noop} />
          </Specimen>
          <Specimen note="ghost">
            <PrimaryButton label="Skip" variant="ghost" onPress={noop} />
          </Specimen>
          <Specimen note="loading">
            <PrimaryButton label="Submitting" loading onPress={noop} />
          </Specimen>
          <Specimen note="with icon (Check)">
            <PrimaryButton label="Mark resolved" icon={iconMap.Check} onPress={noop} />
          </Specimen>
        </Section>

        <Section title="SecondaryButton">
          <Specimen note="sm">
            <SecondaryButton label="Filter" size="sm" onPress={noop} />
          </Specimen>
          <Specimen note="md (default)">
            <SecondaryButton label="Add member" size="md" onPress={noop} />
          </Specimen>
          <Specimen note="lg">
            <SecondaryButton label="Set location" size="lg" onPress={noop} />
          </Specimen>
          <Specimen note="with icon (UserPlus)">
            <SecondaryButton label="Invite" icon={iconMap.UserPlus} onPress={noop} />
          </Specimen>
        </Section>

        <Section title="Avatar">
          <Specimen note="monogram (default 36)">
            <Avatar name="Sam Rivera" />
          </Specimen>
          <Specimen note="size 22">
            <Avatar name="Ada Lovelace" seed="ada" size={22} />
          </Specimen>
          <Specimen note="size 36">
            <Avatar name="Grace Hopper" seed="grace" size={36} />
          </Specimen>
          <Specimen note="size 64">
            <Avatar name="Lin Manuel" seed="lin" size={64} />
          </Specimen>
          <Specimen note="photoUrl (64)">
            <Avatar name="Jo Doe" photoUrl={PHOTO_URL} size={64} />
          </Specimen>
          <Specimen note="style passthrough (s1 shadow)">
            <Avatar name="Mara Vance" seed="mara" size={64} style={avatarShadowStyle} />
          </Specimen>
        </Section>

        <Section title="StatusBadge (one per status)">
          {STATUSES.map((s) => (
            <Specimen key={s} note={s}>
              <StatusBadge status={s} />
            </Specimen>
          ))}
        </Section>

        <Section title="CategoryChip (icon only)">
          {CATEGORIES.map((c) => (
            <Specimen key={c} note={c}>
              <CategoryChip category={c} />
            </Specimen>
          ))}
        </Section>

        <Section title="CategoryChip (showLabel)">
          {CATEGORIES.map((c) => (
            <Specimen key={c} note={c}>
              <CategoryChip category={c} showLabel />
            </Specimen>
          ))}
        </Section>

        <Section title="CountBadge">
          {([1, 9, 99, 100] as const).map((n) => (
            <Specimen key={`sm-${n}`} note={`sm / ${n}`}>
              <CountBadge count={n} size="sm" />
            </Specimen>
          ))}
          {([1, 9, 99, 100] as const).map((n) => (
            <Specimen key={`md-${n}`} note={`md / ${n}`}>
              <CountBadge count={n} size="md" />
            </Specimen>
          ))}
        </Section>

        <Section title="Toggle (tap to flip)">
          <Stack>
            <Toggle
              label="Blocking the sidewalk"
              helper="Flag if pedestrians cannot pass"
              value={toggleA}
              onValueChange={setToggleA}
            />
            <Toggle label="Safety hazard" value={toggleB} onValueChange={setToggleB} />
          </Stack>
        </Section>

        <Section title="SettingsToggle (tap to flip)">
          <Specimen note={`on (value=${settingsA})`}>
            <SettingsToggle
              value={settingsA}
              onValueChange={setSettingsA}
              accessibilityLabel="Setting A"
            />
          </Specimen>
          <Specimen note={`off (value=${settingsB})`}>
            <SettingsToggle
              value={settingsB}
              onValueChange={setSettingsB}
              accessibilityLabel="Setting B"
            />
          </Specimen>
        </Section>

        <Section title="MetaDot (between two Text nodes)">
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
            <Text variant="caption" color={theme.colors.textMuted}>
              Wed
            </Text>
            <MetaDot />
            <Text variant="caption" color={theme.colors.textMuted}>
              3:30 PM
            </Text>
            <MetaDot />
            <Text variant="caption" color={theme.colors.textMuted}>
              Riverside Park
            </Text>
          </div>
        </Section>

        <Section title="TextField">
          <Stack>
            <TextField
              label="Email"
              helper="We send a 6-digit sign-in code."
              placeholder="you@example.com"
              defaultValue="resident@civfix.org"
            />
            <TextField
              label="Description"
              helper="What did you notice?"
              placeholder="Describe the issue"
              multiline
              defaultValue="Overflowing bin at the corner of 4th and Main."
            />
          </Stack>
        </Section>

        <Section title="SegmentedCodeInput (6-cell)">
          <SegmentedCodeInput value={code} onChangeText={setCode} length={6} autoFocus={false} />
        </Section>

        <Section title="StateView">
          <Specimen note="LoadingState">
            <StateBox>
              <LoadingState />
            </StateBox>
          </Specimen>
          <Specimen note="EmptyState (icon + title + body)">
            <StateBox>
              <EmptyState
                icon={iconMap.Trash2}
                title="No reports yet"
                body="Reports you submit will show up here for you to track."
              />
            </StateBox>
          </Specimen>
          <Specimen note="SignInPrompt (onSignIn no-op)">
            <StateBox>
              <SignInPrompt
                icon={iconMap.LogIn}
                title="Sign in to continue"
                body="Sign in to report issues and join cleanups in your neighborhood."
                onSignIn={noop}
              />
            </StateBox>
          </Specimen>
        </Section>

        <Section title="DateBadge (near-future)">
          <Specimen note="size 56 (default)">
            <DateBadge iso={NEAR_FUTURE_ISO} />
          </Specimen>
          <Specimen note="size 44 (compact)">
            <DateBadge iso={NEAR_FUTURE_ISO} size={44} />
          </Specimen>
        </Section>

        <Section title="BlurSurface (over a colorful backdrop)">
          <BlurStage note="kind=button">
            <BlurSurface kind="button" style={blurButtonStyle}>
              <Text variant="bodyStrong">button</Text>
            </BlurSurface>
          </BlurStage>
          <BlurStage note="kind=sheet">
            <BlurSurface kind="sheet" style={blurSheetStyle}>
              <Text variant="bodyStrong">sheet glass</Text>
            </BlurSurface>
          </BlurStage>
          <BlurStage note="kind=popover">
            <BlurSurface kind="popover" style={blurPopoverStyle}>
              <Text variant="bodyStrong">popover</Text>
            </BlurSurface>
          </BlurStage>
        </Section>
      </main>
    </CapabilitiesProvider>
  )
}

// BlurSurface style props (it forwards `style` onto its react-native-web View). Plain objects are an
// accepted RN ViewStyle shape; keeping them outside the JSX keeps the render tree readable.
const blurButtonStyle = {
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: staticTheme.radius.pill,
  alignItems: "center",
  justifyContent: "center",
} as const

const blurSheetStyle = {
  paddingHorizontal: 24,
  paddingVertical: 16,
  borderRadius: staticTheme.radius.lg,
  alignItems: "center",
  justifyContent: "center",
} as const

const blurPopoverStyle = {
  paddingHorizontal: 18,
  paddingVertical: 12,
  borderRadius: staticTheme.radius.md,
  alignItems: "center",
  justifyContent: "center",
} as const
