import Link from "next/link";
import type { ReactNode } from "react";
import { X } from "lucide-react";

/**
 * The top row of every game screen (DESIGN.md V3): a close button, a thin gold
 * progress bar (or, in timed rounds, whatever `status` holds), and the level chip.
 */
export function GameTopBar({
  exitHref,
  onExit,
  exitLabel,
  progress,
  progressLabel,
  status,
  chip,
}: {
  exitHref: string;
  /** When set, the close button calls this instead of navigating (a session embedded in a page). */
  onExit?: (() => void) | undefined;
  exitLabel: string;
  /** 0 to 1; omitted when `status` takes its place. */
  progress?: number | undefined;
  progressLabel?: string | undefined;
  status?: ReactNode;
  chip?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      {onExit ? (
        <button type="button" onClick={onExit} aria-label={exitLabel} className="grid size-11 shrink-0 place-items-center rounded-full border border-line text-fg-2 transition-colors hover:border-line-strong hover:text-fg">
          <X className="size-5" strokeWidth={1.5} aria-hidden="true" />
        </button>
      ) : (
        <Link href={exitHref} aria-label={exitLabel} className="grid size-11 shrink-0 place-items-center rounded-full border border-line text-fg-2 transition-colors hover:border-line-strong hover:text-fg">
          <X className="size-5" strokeWidth={1.5} aria-hidden="true" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        {progress !== undefined ? (
          <div
            role="progressbar"
            aria-label={progressLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            className="h-1 overflow-hidden rounded-full bg-line"
          >
            {/* Grows from the start edge: the bar fills right to left in Arabic. */}
            <div className="h-full rounded-full bg-gold transition-[width] duration-500 ease-out" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
          </div>
        ) : (
          status
        )}
      </div>
      {chip}
    </div>
  );
}

/** Title and "world / stage / word N of 10" under the top row. */
export function GameHeading({ title, meta, id }: { title: string; meta?: ReactNode; id?: string | undefined }) {
  return (
    <div className="space-y-1.5">
      <h2 id={id} className="text-[clamp(1.5rem,5vw,2rem)] leading-tight font-light">
        {title}
      </h2>
      {meta && <p className="text-sm text-fg-2 tabular">{meta}</p>}
    </div>
  );
}
