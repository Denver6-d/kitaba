import type { ReactNode } from "react";

/** Standard page frame: start-aligned title, optional intro, generous whitespace. */
export function Page({ title, intro, children, width = "wide", actions }: { title: string; intro?: ReactNode; children: ReactNode; width?: "narrow" | "wide"; actions?: ReactNode }) {
  return (
    <div className={`mx-auto px-4 pt-10 pb-8 sm:px-6 sm:pt-14 ${width === "narrow" ? "max-w-3xl" : "max-w-6xl"}`}>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-10">
        <div className="max-w-2xl space-y-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          {intro && <p className="text-ink-soft">{intro}</p>}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 py-12 text-ink-soft">
      <span className="size-2 animate-pulse rounded-full bg-brass-fill" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorBlock({ title, body, onRetry, retryLabel }: { title: string; body: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div role="alert" className="rounded-xl border border-error/40 bg-[var(--error-wash)] p-5">
      <p className="font-semibold text-error">{title}</p>
      <p className="mt-1 text-sm">{body}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 text-sm font-medium underline underline-offset-4">
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export function EmptyBlock({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-rule-strong p-8 text-center">
      <p className="mx-auto max-w-md text-ink-soft">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
