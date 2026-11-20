import type { ReactNode } from "react";

/** Standard page frame: start-aligned title, optional intro, generous whitespace. */
export function Page({ title, intro, children, width = "wide", actions }: { title: string; intro?: ReactNode; children: ReactNode; width?: "narrow" | "wide"; actions?: ReactNode }) {
  return (
    <div className={`mx-auto px-4 pt-12 pb-10 sm:px-6 sm:pt-20 ${width === "narrow" ? "max-w-3xl" : "max-w-6xl"}`}>
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4 sm:mb-14">
        <div className="max-w-2xl space-y-3">
          <h1 className="text-[clamp(2rem,6vw,3rem)] leading-[1.1] font-light">{title}</h1>
          {intro && <p className="text-fg-2">{intro}</p>}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[60vh] items-start gap-3 py-12 text-fg-2">
      <span className="mt-2.5 size-2 animate-pulse rounded-full bg-gold" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorBlock({ title, body, onRetry, retryLabel }: { title: string; body: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div role="alert" className="rounded-card border border-error/40 bg-error-tint p-5">
      <p className="font-medium text-error">{title}</p>
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
    <div className="rounded-card border border-dashed border-line-strong p-8 text-center">
      <p className="mx-auto max-w-md text-fg-2">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
