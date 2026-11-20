"use client"

import * as React from "react"
import { cn } from "cn"
import { Switch as SwitchPrimitive } from "radix-ui"

/**
 * On/off switch. "On" is shown by the light track and the thumb's position,
 * never by colour alone. The invisible ::after extends the touch target to 44 px.
 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer group/switch relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-line-strong p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gold after:absolute after:-inset-2 data-checked:border-fg data-checked:bg-fg data-unchecked:bg-transparent data-disabled:cursor-not-allowed data-disabled:opacity-45",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-5 rounded-full transition-transform duration-200 data-checked:translate-x-[1.375rem] data-checked:bg-canvas data-unchecked:translate-x-0 data-unchecked:bg-fg-2 rtl:data-checked:-translate-x-[1.375rem]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
