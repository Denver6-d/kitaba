import { PRODUCT_NAME } from "@/config/brand";

/** Wordmark: a small gold nib over a hairline baseline, then the name in Inter. Decorative SVG is hidden from AT. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 shrink-0" fill="none">
        <path d="M3 20.5h18" stroke="var(--fg-3)" strokeOpacity="0.6" strokeWidth="1.25" strokeLinecap="round" />
        <path d="M14.5 3.5l4 4-8.2 8.2-4.9 1 1-4.9 8.1-8.3z" fill="var(--gold)" />
        <path d="M6.4 16.7l3.1-3.1" stroke="var(--canvas)" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <span className="font-latin text-xl leading-none font-normal tracking-[-0.01em] text-fg" lang="en" dir="ltr">
        {PRODUCT_NAME}
      </span>
    </span>
  );
}
