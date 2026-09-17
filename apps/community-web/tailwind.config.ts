import type { Config } from "tailwindcss"
import { tokens } from "@civfix/shared/tokens"


const { color, fontSize, radius, shadow, space } = tokens

const px = (n: number): string => `${n}px`

const ms = (n: number): string => `${n}ms`

export type SchemeColor = (utils: { opacityValue?: string }) => string

const schemeVar = (name: string): string =>
  ((({ opacityValue }: { opacityValue?: string }) =>
    opacityValue === undefined
      ? `var(${name})`
      : `color-mix(in srgb, var(${name}) calc(${opacityValue} * 100%), transparent)`) satisfies SchemeColor) as unknown as string

function fontSizeScale(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(fontSize)) out[k] = v
  return out
}

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: px(space["4"]),
    },
    extend: {
      colors: {
        border: "hsl(var(--shadcn-border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--shadcn-accent))",
          foreground: "hsl(var(--shadcn-accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--shadcn-card))",
          foreground: "hsl(var(--shadcn-card-foreground))",
        },

        bloom: {
          50: schemeVar("--bloom-50"),
          100: schemeVar("--bloom-100"),
          300: schemeVar("--bloom-300"),
          500: schemeVar("--bloom"),
          600: schemeVar("--bloom-600"),
          700: schemeVar("--bloom-700"),
        },
        moss: {
          50: schemeVar("--moss-50"),
          100: schemeVar("--moss-100"),
          300: schemeVar("--moss-300"),
          500: schemeVar("--moss"),
          600: schemeVar("--moss-600"),
          700: schemeVar("--moss-700"),
        },
        sun: {
          50: schemeVar("--sun-50"),
          100: schemeVar("--sun-100"),
          300: schemeVar("--sun-300"),
          500: schemeVar("--sun"),
          600: schemeVar("--sun-600"),
          700: schemeVar("--sun-700"),
        },
        sky: {
          50: schemeVar("--sky-50"),
          100: schemeVar("--sky-100"),
          300: schemeVar("--sky-300"),
          500: schemeVar("--sky"),
          600: schemeVar("--sky-600"),
          700: schemeVar("--sky-700"),
        },
        lilac: {
          50: schemeVar("--lilac-50"),
          500: schemeVar("--lilac"),
          600: schemeVar("--lilac-600"),
          700: schemeVar("--lilac-700"),
        },

        brand: color.brand,

        paper: schemeVar("--paper"),
        paper2: schemeVar("--paper-2"),
        cardflat: schemeVar("--card"),
        cardTint: schemeVar("--card-tint"),
        ink: {
          DEFAULT: schemeVar("--ink"),
          2: schemeVar("--ink-2"),
          3: schemeVar("--ink-3"),
          4: schemeVar("--ink-4"),
          5: schemeVar("--ink-5"),
        },

        cat: {
          trash: schemeVar("--cat-trash"),
          recycling: schemeVar("--cat-recycling"),
          graffiti: schemeVar("--cat-graffiti"),
          hazard: schemeVar("--cat-hazard"),
          encampment: schemeVar("--cat-encampment"),
          water: schemeVar("--cat-water"),
          other: schemeVar("--cat-other"),
        },

        cleanup: schemeVar("--cat-cleanup"),

        console: {
          surface: schemeVar("--console-surface"),
          "surface-alt": schemeVar("--console-surface-alt"),
          tint: schemeVar("--console-tint"),
          canvas: schemeVar("--console-canvas"),
          line: schemeVar("--console-line"),
          "line-strong": schemeVar("--console-line-strong"),
          accent: schemeVar("--console-accent"),
          scrim: schemeVar("--console-scrim"),
          "toast-surface": schemeVar("--console-toast-surface"),
          "toast-ink": schemeVar("--console-toast-ink"),
          "toast-ink-dim": schemeVar("--console-toast-ink-dim"),
          ink: {
            DEFAULT: schemeVar("--console-ink"),
            2: schemeVar("--console-ink-2"),
            3: schemeVar("--console-ink-3"),
          },
          bloom: { soft: schemeVar("--console-hue-bloom-soft"), strong: schemeVar("--console-hue-bloom-strong") },
          moss: { soft: schemeVar("--console-hue-moss-soft"), strong: schemeVar("--console-hue-moss-strong") },
          sun: { soft: schemeVar("--console-hue-sun-soft"), strong: schemeVar("--console-hue-sun-strong") },
          sky: { soft: schemeVar("--console-hue-sky-soft"), strong: schemeVar("--console-hue-sky-strong") },
          lilac: { soft: schemeVar("--console-hue-lilac-soft"), strong: schemeVar("--console-hue-lilac-strong") },
        },
      },

      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },

      fontSize: Object.fromEntries(
        Object.entries(fontSizeScale()).map(([k, v]) => [`token-${k}`, v]),
      ),

      lineHeight: {
        tight: String(tokens.lineHeight.tight),
        snug: String(tokens.lineHeight.snug),
        base: String(tokens.lineHeight.base),
        loose: String(tokens.lineHeight.loose),
      },

      letterSpacing: {
        tightest: tokens.tracking.tight,
        snugger: tokens.tracking.snug,
        wider: tokens.tracking.wide,
      },

      spacing: Object.fromEntries(
        Object.entries(space).map(([k, v]) => [`token-${k}`, px(v)]),
      ),

      borderRadius: {
        lg: px(radius.lg),
        xl: px(radius.xl),
        "2xl": px(radius["2xl"]),
        md: px(radius.md),
        sm: px(radius.sm),
        xs: px(radius.xs),
        pill: px(radius.pill),
      },

      boxShadow: {
        s1: shadow.s1,
        s2: shadow.s2,
        s3: shadow.s3,
        s4: shadow.s4,
        pin: shadow.pin,
        sheen: shadow.sheenTop,
        ring: shadow.ring,
        "console-1": "var(--console-shadow-1)",
        "console-2": "var(--console-shadow-2)",
        "console-3": "var(--console-shadow-3)",
        "console-4": "var(--console-shadow-4)",
        "console-ring": "var(--console-shadow-ring)",
      },

      transitionTimingFunction: {
        out: tokens.motion.ease.out,
        spring: tokens.motion.ease.spring,
        "in-out": tokens.motion.ease.inOut,
      },

      transitionDuration: {
        d1: ms(tokens.motion.dur.d1),
        d2: ms(tokens.motion.dur.d2),
        d3: ms(tokens.motion.dur.d3),
        d4: ms(tokens.motion.dur.d4),
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "sheet-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
      },

      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "sheet-up": "sheet-up 0.32s cubic-bezier(0.22,1,0.36,1)",
      },
    },
  },
  corePlugins: {
    backgroundOpacity: false,
    textOpacity: false,
    borderOpacity: false,
    divideOpacity: false,
    ringOpacity: false,
    placeholderOpacity: false,
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
