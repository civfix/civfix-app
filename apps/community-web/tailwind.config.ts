import type { Config } from "tailwindcss"
import { tokens } from "@civfix/shared/tokens"


const { color, fontSize, radius, shadow, space } = tokens

const px = (n: number): string => `${n}px`

const schemeVar = (name: string): string =>
  `color-mix(in srgb, var(${name}) calc(<alpha-value> * 100%), transparent)`

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
        border: "hsl(var(--border))",
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
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        bloom: color.bloom,
        moss: color.moss,
        sun: color.sun,
        sky: color.sky,
        lilac: color.lilac,

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

        cat: color.category,

        cleanup: color.cleanup,

        console: {
          surface: "var(--console-surface)",
          "surface-alt": "var(--console-surface-alt)",
          tint: "var(--console-tint)",
          canvas: "var(--console-canvas)",
          line: "var(--console-line)",
          "line-strong": "var(--console-line-strong)",
          accent: "var(--console-accent)",
          scrim: "var(--console-scrim)",
          "toast-surface": "var(--console-toast-surface)",
          "toast-ink": "var(--console-toast-ink)",
          "toast-ink-dim": "var(--console-toast-ink-dim)",
          ink: {
            DEFAULT: "var(--console-ink)",
            2: "var(--console-ink-2)",
            3: "var(--console-ink-3)",
          },
          bloom: { soft: "var(--console-hue-bloom-soft)", strong: "var(--console-hue-bloom-strong)" },
          moss: { soft: "var(--console-hue-moss-soft)", strong: "var(--console-hue-moss-strong)" },
          sun: { soft: "var(--console-hue-sun-soft)", strong: "var(--console-hue-sun-strong)" },
          sky: { soft: "var(--console-hue-sky-soft)", strong: "var(--console-hue-sky-strong)" },
          lilac: { soft: "var(--console-hue-lilac-soft)", strong: "var(--console-hue-lilac-strong)" },
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
        d1: String(tokens.motion.dur.d1),
        d2: String(tokens.motion.dur.d2),
        d3: String(tokens.motion.dur.d3),
        d4: String(tokens.motion.dur.d4),
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
  plugins: [require("tailwindcss-animate")],
}

export default config
