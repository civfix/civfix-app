import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Button primitive themed to the warm civfix palette. Variants map to design tokens via the
 * Tailwind semantic colors (primary = bloom/coral, accent = sun, secondary = paper2).
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-token-14 font-semibold transition-colors duration-d2 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Coral primary CTA (Report an issue).
        primary: "bg-primary text-primary-foreground shadow-s1 hover:bg-bloom-600",
        // Sun-yellow CTA with ink text (Host an event).
        sun: "bg-sun-500 text-ink shadow-s1 hover:bg-sun-600",
        secondary: "bg-secondary text-secondary-foreground hover:bg-ink-5",
        outline: "border border-ink-5 bg-cardflat text-ink hover:bg-paper2",
        ghost: "text-ink hover:bg-paper2",
        destructive:
          "bg-destructive text-destructive-foreground shadow-s1 hover:opacity-90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-sm px-3",
        lg: "h-11 rounded-md px-6",
        pill: "h-9 rounded-pill px-4",
        icon: "h-10 w-10",
        "icon-sm": "h-9 w-9 rounded-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
