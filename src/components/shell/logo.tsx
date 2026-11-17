import { PRODUCT_NAME } from "@/config/brand";

/** Wordmark: the product name on a ruled baseline with a brass nib. Decorative SVG is hidden from AT. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-end gap-2 ${className}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 shrink-0" fill="none">
        <path d="M3 20.5h18" stroke="var(--rule-strong)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M14.5 3.5l4 4-8.2 8.2-4.9 1 1-4.9 8.1-8.3z" fill="var(--brass-fill)" />
        <path d="M6.4 16.7l3.1-3.1" stroke="var(--sheet)" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <span className="font-latin-display text-xl leading-none font-semibold tracking-tight" lang="en" dir="ltr">
        {PRODUCT_NAME}
      </span>
    </span>
  );
}
