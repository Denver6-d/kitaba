import * as React from "react"
import { cn } from "cn"

/**
 * Cards (DESIGN.md V3).
 * - `surface`: the standard card on the dark canvas (hairline border, 24 px radius).
 * - `raised`: a nested or emphasised card.
 * - `moment`: the light mint card for rule explanations, results and the honest banner.
 */
type Tone = "surface" | "raised" | "moment"

const TONES: Record<Tone, string> = {
  surface: "panel",
  raised: "rounded-card border border-line bg-raised",
  moment: "moment",
}

function Card({ tone = "surface", className, ...props }: React.ComponentProps<"div"> & { tone?: Tone }) {
  return <div data-slot="card" data-tone={tone} className={cn(TONES[tone], "p-6 sm:p-8", className)} {...props} />
}

/** The small label at the top of a moment card (dark gold on mint, 6.45:1). */
function MomentLabel({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm font-medium text-mint-label", className)} {...props} />
}

export { Card, MomentLabel }
