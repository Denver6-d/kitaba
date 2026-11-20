"use client"

import * as React from "react"
import { cn } from "cn"

/**
 * A labelled text input (DESIGN.md V3): the label is always visible above the
 * field, the hint and the error are tied to it with aria-describedby, and an
 * error is announced and underlined, and the field border turns dashed: never colour alone.
 */
function TextInput({ className, invalid, ...props }: React.ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      data-slot="input"
      aria-invalid={invalid || undefined}
      className={cn(
        "min-h-12 w-full min-w-0 rounded-field border border-line-strong bg-surface px-4 text-base text-fg transition-colors placeholder:text-fg-3 hover:border-fg-3 focus-visible:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold aria-invalid:border-error aria-invalid:border-dashed disabled:opacity-45",
        className
      )}
      {...props}
    />
  )
}

function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  className?: string
  /** Receives the ids to wire up: put them on the input. */
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => React.ReactNode
}) {
  const id = React.useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-fg">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && (
        <p id={hintId} className="text-sm text-fg-2">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-error underline decoration-dotted underline-offset-4">
          {error}
        </p>
      )}
    </div>
  )
}

export { Field, TextInput }
