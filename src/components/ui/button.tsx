import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

/**
 * Pill buttons (DESIGN.md V3). `primary` is the gold one: at most one per
 * screen, so it is never the default. Every size keeps a 44 px touch target.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-full border font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 select-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gold active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.1em]",
  {
    variants: {
      variant: {
        primary: "border-transparent bg-gold text-on-gold hover:bg-gold-hover",
        outline: "border-line-strong bg-transparent text-fg hover:border-fg-2 hover:bg-raised aria-expanded:bg-raised",
        quiet: "border-transparent bg-transparent text-fg-2 hover:bg-raised hover:text-fg aria-expanded:bg-raised",
        link: "min-h-11 border-transparent px-1 text-fg-2 underline decoration-line-strong underline-offset-4 hover:text-fg hover:decoration-fg-2",
        destructive: "border-error/50 bg-transparent text-error hover:bg-error-tint",
      },
      size: {
        sm: "min-h-11 px-4 text-sm",
        default: "min-h-12 px-6 text-base",
        lg: "min-h-14 px-8 text-lg",
        icon: "size-11 p-0",
      },
    },
    compoundVariants: [{ variant: "link", className: "px-1" }],
    defaultVariants: {
      variant: "outline",
      size: "default",
    },
  }
)

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

function Button({ className, variant = "outline", size = "default", asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
