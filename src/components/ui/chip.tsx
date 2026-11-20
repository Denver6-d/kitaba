import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/**
 * Small pill labels (DESIGN.md V3). `level` is the CEFR chip: the active one is
 * gold, which is one of the few places gold is allowed. Chips are static
 * labels; a chip that does something is a button with `chipVariants`.
 */
const chipVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-line-strong/60 text-fg-2",
        level: "border-line-strong/60 text-fg",
        "level-active": "border-gold bg-gold text-on-gold",
        error: "border-error/50 text-error",
      },
      size: {
        sm: "min-h-7 px-2.5 text-xs",
        default: "min-h-8 px-3 text-sm",
        lg: "min-h-11 px-4 text-base",
      },
    },
    defaultVariants: { tone: "neutral", size: "default" },
  }
)

function Chip({ className, tone, size, ...props }: React.ComponentProps<"span"> & VariantProps<typeof chipVariants>) {
  return <span data-slot="chip" data-tone={tone ?? "neutral"} className={cn(chipVariants({ tone, size }), className)} {...props} />
}

/** A CEFR level chip; level codes are Latin, so they are set in the Latin face. */
function LevelChip({ level, active = false, className, ...props }: { level: string; active?: boolean } & Omit<React.ComponentProps<"span">, "children">) {
  return (
    <Chip tone={active ? "level-active" : "level"} className={cn("font-latin tabular", className)} lang="en" dir="ltr" {...props}>
      {level}
    </Chip>
  )
}

export { Chip, LevelChip, chipVariants }
